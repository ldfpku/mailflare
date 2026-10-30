import { ImChatError } from "./chat-utils";

type Env = CloudflareEnv;
type ReminderRow = { id: string; user_id: string; todo_id: string; scheduled_at: number; created_at: number; title: string };
type PendingDelivery = { id: string; user_id: string; attempts: number };
const BATCH_SIZE = 200;
const MAX_BATCHES = 50;

const ACTIVE_REMINDER = `t.done = 0 AND t.remind_at = r.scheduled_at AND t.reminder_revision = r.revision
	AND (t.user_id = r.user_id OR t.assignee_id = r.user_id)`;

export async function listTodoReminders(env: Env, userId: string) {
	const result = await env.DB.prepare(
		`SELECT r.id, r.user_id, r.todo_id, r.scheduled_at, r.created_at, t.title
		FROM im_todo_reminders r JOIN im_todos t ON t.id = r.todo_id
		WHERE r.user_id = ? AND r.seen_at IS NULL AND ${ACTIVE_REMINDER}
		ORDER BY r.created_at DESC, r.id DESC LIMIT 200`,
	).bind(userId).all<ReminderRow>();
	return result.results.map((row) => ({ id: row.id, todoId: row.todo_id, title: row.title, scheduledAt: row.scheduled_at, createdAt: row.created_at }));
}

export async function dismissTodoReminder(env: Env, userId: string, value: unknown) {
	if (typeof value !== "string" || !value || value.length > 256) throw new ImChatError(400, "提醒标识无效");
	const row = await env.DB.prepare(
		`SELECT r.id FROM im_todo_reminders r JOIN im_todos t ON t.id = r.todo_id
		WHERE r.id = ? AND r.user_id = ? AND ${ACTIVE_REMINDER}`,
	).bind(value, userId).first<{ id: string }>();
	if (!row) throw new ImChatError(404, "提醒不存在");
	await env.DB.prepare("UPDATE im_todo_reminders SET seen_at = COALESCE(seen_at, ?) WHERE id = ? AND user_id = ?").bind(Date.now(), value, userId).run();
}

async function generateDueReminders(env: Env, now: number): Promise<number> {
	let count = 0;
	for (let batch = 0; batch < MAX_BATCHES; batch++) {
		const result = await env.DB.prepare(
			`INSERT OR IGNORE INTO im_todo_reminders (id, todo_id, user_id, revision, scheduled_at, created_at)
			SELECT lower(hex(randomblob(16))), candidate.todo_id, candidate.user_id, candidate.revision, candidate.scheduled_at, ?
			FROM (
				SELECT t.id AS todo_id, t.user_id, t.reminder_revision AS revision, t.remind_at AS scheduled_at
				FROM im_todos t JOIN users u ON u.id = t.user_id AND u.disabled = 0 AND u.deleted_at IS NULL
				WHERE t.done = 0 AND t.remind_at IS NOT NULL AND t.remind_at <= ?
				AND NOT EXISTS (SELECT 1 FROM im_todo_reminders r WHERE r.todo_id = t.id AND r.user_id = t.user_id AND r.revision = t.reminder_revision)
				UNION ALL
				SELECT t.id AS todo_id, t.assignee_id AS user_id, t.reminder_revision AS revision, t.remind_at AS scheduled_at
				FROM im_todos t JOIN users u ON u.id = t.assignee_id AND u.disabled = 0 AND u.deleted_at IS NULL
				WHERE t.done = 0 AND t.remind_at IS NOT NULL AND t.remind_at <= ? AND t.assignee_id <> t.user_id
				AND NOT EXISTS (SELECT 1 FROM im_todo_reminders r WHERE r.todo_id = t.id AND r.user_id = t.assignee_id AND r.revision = t.reminder_revision)
			) candidate LIMIT ? RETURNING id`,
		).bind(now, now, now, BATCH_SIZE).all<{ id: string }>();
		count += result.results.length;
		if (result.results.length < BATCH_SIZE) return count;
	}
	console.warn("[todo-reminders] Generation batch limit reached; remaining reminders will be retried");
	return count;
}

async function pendingDeliveries(env: Env, now: number): Promise<PendingDelivery[]> {
	const result = await env.DB.prepare(
		`SELECT r.id, r.user_id, r.attempts FROM im_todo_reminders r
		JOIN im_todos t ON t.id = r.todo_id JOIN users u ON u.id = r.user_id
		WHERE r.notified_at IS NULL AND r.seen_at IS NULL AND r.next_attempt_at <= ?
		AND u.disabled = 0 AND u.deleted_at IS NULL AND ${ACTIVE_REMINDER}
		ORDER BY r.created_at, r.id LIMIT ?`,
	).bind(now, BATCH_SIZE).all<PendingDelivery>();
	return result.results;
}

async function deliverDueReminders(env: Env, now: number) {
	const failures: unknown[] = [];
	for (let batch = 0; batch < MAX_BATCHES; batch++) {
		const rows = await pendingDeliveries(env, now);
		if (!rows.length) break;
		const groups = new Map<string, PendingDelivery[]>();
		for (const row of rows) groups.set(row.user_id, [...(groups.get(row.user_id) ?? []), row]);
		for (const [userId, entries] of groups) {
			try {
				if (!env.IM_HUB) throw new Error("IM notification hub is unavailable");
				const response = await env.IM_HUB.getByName(userId).fetch("https://mailflare-im/notify", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ type: "todoReminder", data: { ids: entries.map((entry) => entry.id) } }),
				});
				if (!response.ok) throw new Error(`IM reminder delivery returned ${response.status}`);
				for (let offset = 0; offset < entries.length; offset += 80) {
					const ids = entries.slice(offset, offset + 80).map((entry) => entry.id);
					await env.DB.prepare(`UPDATE im_todo_reminders SET notified_at = ? WHERE user_id = ? AND id IN (${ids.map(() => "?").join(",")})`)
						.bind(now, userId, ...ids).run();
				}
			} catch (error) {
				console.error("[todo-reminders] Delivery failed:", error);
				failures.push(error);
				for (const entry of entries) {
					const delay = Math.min(60_000 * 2 ** Math.min(entry.attempts, 6), 3_600_000);
					await env.DB.prepare("UPDATE im_todo_reminders SET attempts = attempts + 1, next_attempt_at = ? WHERE id = ? AND user_id = ?")
						.bind(now + delay, entry.id, userId).run();
				}
			}
		}
		if (rows.length < BATCH_SIZE) break;
	}
	if (failures.length) throw new AggregateError(failures, "部分待办提醒推送失败，将自动重试");
}

/** Minute cron persists each due reminder before attempting best-effort live delivery. */
export async function runTodoReminders(env: Env, now = Date.now()) {
	await generateDueReminders(env, now);
	await deliverDueReminders(env, now);
}
