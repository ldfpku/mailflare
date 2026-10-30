import { profileRecipients, reconcileVisiblePresence } from "./chat";
import { notifyImUsers } from "./notify";
import { IM_DEFAULT_USER_STATE_ID, IM_INVISIBLE_USER_STATE_ID } from "./users-utils";

type StateRow = { revision: number; state_id: string };
const MAX_INLINE_REVISIONS = 20;
const MAX_RETRY_BATCH = 50;
const RETRY_CONCURRENCY = 10;
const HUB_TIMEOUT_MS = 8_000;

/** Called serially by the user's hub. A newer state is never removed by an older delivery. */
export async function deliverPendingUserState(env: CloudflareEnv, userId: string): Promise<void> {
	for (let attempt = 0; attempt < MAX_INLINE_REVISIONS; attempt++) {
		const row = await env.DB.prepare(
			`SELECT q.revision, u.im_state_id AS state_id
			FROM im_state_outbox q JOIN users u ON u.id = q.user_id
			WHERE q.user_id = ? AND u.disabled = 0 AND u.deleted_at IS NULL`,
		).bind(userId).first<StateRow>();
		if (!row) {
			await env.DB.prepare(
				`DELETE FROM im_state_outbox WHERE user_id = ? AND NOT EXISTS
				(SELECT 1 FROM users WHERE id = ? AND disabled = 0 AND deleted_at IS NULL)`,
			).bind(userId, userId).run();
			return;
		}
		const recipients = await profileRecipients(env, userId);
		await notifyImUsers(env, [userId], {
			type: "userStateChange", data: { uid: userId, userStateId: row.state_id },
		}, { requireDelivery: true });
		await notifyImUsers(env, recipients.filter((id) => id !== userId), {
			type: "userStateChange",
			data: { uid: userId, userStateId: row.state_id === IM_INVISIBLE_USER_STATE_ID ? IM_DEFAULT_USER_STATE_ID : row.state_id },
		}, { requireDelivery: true });
		await reconcileVisiblePresence(env, userId, { replay: true, requireDelivery: true });
		const deleted = await env.DB.prepare("DELETE FROM im_state_outbox WHERE user_id = ? AND revision = ?")
			.bind(userId, row.revision).run();
		if (deleted.meta.changes) return;
	}
	throw new Error("IM user state changed too frequently to complete delivery");
}

export async function triggerPendingUserState(env: CloudflareEnv, userId: string): Promise<void> {
	if (!env.IM_HUB) throw new Error("IM notification hub is unavailable");
	const response = await env.IM_HUB.getByName(userId).fetch("https://mailflare-im/sync-user-state", {
		method: "POST",
		headers: { "X-Mailflare-Im-User": userId },
		signal: AbortSignal.timeout(HUB_TIMEOUT_MS),
	});
	if (!response.ok) throw new Error(`IM user state delivery returned ${response.status}`);
}

/** The cron also covers a process crash between the atomic database write and the hub call. */
export async function retryPendingUserStates(env: CloudflareEnv): Promise<void> {
	if (!env.IM_HUB) return;
	const rows = await env.DB.prepare("SELECT user_id, revision FROM im_state_outbox ORDER BY updated_at, user_id LIMIT ?")
		.bind(MAX_RETRY_BATCH).all<{ user_id: string; revision: number }>();
	for (let offset = 0; offset < rows.results.length; offset += RETRY_CONCURRENCY) {
		const results = await Promise.allSettled(rows.results.slice(offset, offset + RETRY_CONCURRENCY).map(async (row) => {
			try {
				await triggerPendingUserState(env, row.user_id);
			} catch (error) {
				console.error("[im-state] Retry failed:", error);
				await env.DB.prepare("UPDATE im_state_outbox SET updated_at = ? WHERE user_id = ? AND revision = ?")
					.bind(Date.now(), row.user_id, row.revision).run();
			}
		}));
		const failures = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
		if (failures.length) throw new AggregateError(failures.map((result) => result.reason), "IM user state retry bookkeeping failed");
	}
}
