import { createAuditLog } from "@/lib/mailboxes/audit";
import { notifyImUsers } from "./notify";
import {
	IM_ALL_STAFF_ROOM_ID,
	IM_PURGE_AUDIT_ACTION,
	IM_PURGE_CATEGORIES,
	IM_PURGE_CATEGORY_LABELS,
	IM_PURGE_DEFAULT_CATEGORIES,
	buildImPurgeUnits,
	imFileIdsInBody,
	imPurgeRoomChanges,
	mergeImPurgeRoomChanges,
	planImPurge,
	type ImPurgeCategory,
	type ImPurgeData,
	type ImPurgeRoomChange,
} from "./purge-utils";

/**
 * The admin "清理聊天测试数据" tool: removes chat history (rooms, messages, chat files, group file lists, mail cards,
 * meetings, to-dos) and leaves accounts, the directory, cards, avatars, settings and mail alone. Running it twice
 * removes nothing the second time. Each run is an audit log row, which is also how clients learn what to drop from
 * their local copies (`listImPurgeChanges`).
 */

/** D1 caps bound parameters per statement at 100. */
const ID_CHUNK = 90;

type Row = Record<string, unknown>;

async function all<T = Row>(env: CloudflareEnv, sql: string, ...params: unknown[]): Promise<T[]> {
	return (await env.DB.prepare(sql).bind(...params).all<T>()).results;
}

async function loadImPurgeData(env: CloudflareEnv): Promise<ImPurgeData> {
	const [rooms, members, messages, files, meetings, todos] = await Promise.all([
		all<{ id: string; type: number; name: string; avatar: string }>(env, "SELECT id, type, name, avatar FROM im_rooms"),
		all<{ room_id: string; user_id: string }>(env, "SELECT room_id, user_id FROM im_room_members"),
		all<{ id: number; room_id: string; from_uid: string; body: string; created_at: number }>(env, "SELECT id, room_id, from_uid, body, created_at FROM im_messages"),
		all<{ id: string; uploader_id: string; size: number | null; created_at: number }>(env, "SELECT id, uploader_id, size, created_at FROM im_files"),
		all<{ id: string; host_id: string; invitee_ids: string; created_at: number }>(env, "SELECT id, host_id, invitee_ids, created_at FROM im_meetings"),
		all<{ id: string; user_id: string; created_at: number }>(env, "SELECT id, user_id, created_at FROM im_todos"),
	]);
	const memberIds = new Map<string, string[]>();
	for (const member of members) memberIds.set(member.room_id, [...(memberIds.get(member.room_id) ?? []), member.user_id]);
	const roomAvatars = rooms.flatMap((room) => imFileIdsInBody(room.avatar ?? "").map((fileId) => ({ roomId: room.id, fileId })));
	return {
		rooms: rooms.map((room) => ({ id: room.id, type: room.type, name: room.name, memberIds: memberIds.get(room.id) ?? [] })),
		messages: messages.map((message) => ({ id: message.id, roomId: message.room_id, fromUid: message.from_uid, body: message.body, createdAt: message.created_at })),
		files: files.map((file) => ({ id: file.id, uploaderId: file.uploader_id, size: file.size ?? 0, createdAt: file.created_at })),
		meetings: meetings.map((meeting) => ({ id: meeting.id, hostId: meeting.host_id, inviteeIds: parseIds(meeting.invitee_ids), createdAt: meeting.created_at })),
		todos: todos.map((todo) => ({ id: todo.id, userId: todo.user_id, createdAt: todo.created_at })),
		roomAvatars,
	};
}

function parseIds(value: string): string[] {
	try {
		const parsed = JSON.parse(value);
		return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
	} catch {
		return [];
	}
}

async function resolveUserIds(env: CloudflareEnv, emails: string[]): Promise<Set<string>> {
	const ids = new Set<string>();
	for (let index = 0; index < emails.length; index += ID_CHUNK) {
		const chunk = emails.slice(index, index + ID_CHUNK);
		const rows = await all<{ id: string }>(env, `SELECT id FROM users WHERE lower(email) IN (${chunk.map(() => "?").join(",")})`, ...chunk);
		for (const row of rows) ids.add(row.id);
	}
	return ids;
}

async function loadPeople(env: CloudflareEnv): Promise<Map<string, { name: string; email: string }>> {
	const rows = await all<{ id: string; name: string; email: string }>(env, "SELECT id, name, email FROM users");
	return new Map(rows.map((row) => [row.id, { name: row.name, email: row.email }]));
}

/** Counts and samples for each category, for the page to show before anything is removed. */
export async function previewImPurge(env: CloudflareEnv, adminId: string, realEmails: string[], now = Date.now()) {
	const [data, realIds, people] = await Promise.all([loadImPurgeData(env), resolveUserIds(env, realEmails), loadPeople(env)]);
	const roomNames = new Map(data.rooms.map((room) => [room.id, room]));
	const units = buildImPurgeUnits(data, adminId, realIds);
	const categories = IM_PURGE_CATEGORIES.map((category) => {
		const plan = planImPurge(data, adminId, realIds, new Set([category]), now);
		const label = (id: string) => people.get(id)?.name || people.get(id)?.email || id;
		return {
			key: category,
			label: IM_PURGE_CATEGORY_LABELS[category],
			defaultChecked: IM_PURGE_DEFAULT_CATEGORIES.includes(category),
			rooms: plan.roomIds.length,
			messages: plan.messageIds.length,
			files: plan.fileIds.length,
			fileBytes: plan.fileBytes,
			meetings: plan.meetingIds.length,
			todos: plan.todoIds.length,
			conversations: units
				.filter((unit) => unit.category === category)
				.map((unit) => {
					const room = roomNames.get(unit.roomId);
					const title = unit.roomId === IM_ALL_STAFF_ROOM_ID
						? `${label(unit.senderId ?? "")} 发的消息（群本身保留）`
						: room?.name || unit.peopleIds.map(label).join("、");
					return {
						key: unit.key,
						title,
						kind: unit.roomId === IM_ALL_STAFF_ROOM_ID ? "allStaff" : room?.type === 1 ? "group" : "single",
						people: unit.peopleIds.map(label),
						messages: unit.messageIds.length,
						firstAt: unit.firstAt,
						lastAt: unit.lastAt,
					};
				}),
		};
	});
	return { realEmails, realAccounts: [...realIds].map((id) => people.get(id)?.email ?? id), categories, runs: await listImPurgeRuns(env) };
}

export type ImPurgeResult = {
	at: number;
	categories: ImPurgeCategory[];
	rooms: number;
	messages: number;
	files: number;
	fileBytes: number;
	roomFiles: number;
	mailShares: number;
	meetings: number;
	todos: number;
};

async function runChunked(env: CloudflareEnv, sql: (marks: string) => string, ids: (string | number)[]): Promise<number> {
	let changes = 0;
	const statements: D1PreparedStatement[] = [];
	for (let index = 0; index < ids.length; index += ID_CHUNK) {
		const chunk = ids.slice(index, index + ID_CHUNK);
		statements.push(env.DB.prepare(sql(chunk.map(() => "?").join(","))).bind(...chunk));
	}
	for (let index = 0; index < statements.length; index += 50) {
		const results = await env.DB.batch(statements.slice(index, index + 50));
		for (const result of results) changes += result.meta?.changes ?? 0;
	}
	return changes;
}

/** Removes what the categories cover, then tells the clients of everyone involved. */
export async function runImPurge(
	env: CloudflareEnv,
	adminId: string,
	realEmails: string[],
	categories: ImPurgeCategory[],
	now = Date.now(),
): Promise<ImPurgeResult> {
	const [data, realIds] = await Promise.all([loadImPurgeData(env), resolveUserIds(env, realEmails)]);
	const plan = planImPurge(data, adminId, realIds, new Set(categories), now);

	// Rows that point into the rooms or messages first, the rooms last; the FTS triggers drop index rows with messages.
	const mailShares =
		(await runChunked(env, (marks) => `DELETE FROM im_mail_shares WHERE room_id IN (${marks})`, plan.roomIds)) +
		(await runChunked(env, (marks) => `DELETE FROM im_mail_shares WHERE id IN (SELECT json_extract(body, '$.shareId') FROM im_messages WHERE type = 19 AND json_valid(body) AND id IN (${marks}))`, plan.messageIds));
	const roomFiles =
		(await runChunked(env, (marks) => `DELETE FROM im_room_files WHERE room_id IN (${marks})`, plan.roomIds)) +
		(await runChunked(env, (marks) => `DELETE FROM im_room_files WHERE msg_id IN (${marks})`, plan.messageIds));
	// D1 counts trigger and cascade writes in `changes`, so the plan gives the numbers for these tables.
	await runChunked(env, (marks) => `DELETE FROM im_messages WHERE id IN (${marks})`, plan.messageIds);
	await runChunked(env, (marks) => `DELETE FROM im_rooms WHERE id IN (${marks}) AND id <> '${IM_ALL_STAFF_ROOM_ID}'`, plan.roomIds);
	// The all-staff group stays; its preview line must not point at a deleted message.
	await env.DB.prepare("UPDATE im_rooms SET last_msg_id = (SELECT max(id) FROM im_messages WHERE room_id = im_rooms.id) WHERE id = ?").bind(IM_ALL_STAFF_ROOM_ID).run();
	// Index rows whose message is gone, whatever left them behind.
	await env.DB.prepare("DELETE FROM im_messages_fts WHERE rowid NOT IN (SELECT id FROM im_messages)").run();

	await runChunked(env, (marks) => `DELETE FROM im_meetings WHERE id IN (${marks})`, plan.meetingIds);
	await runChunked(env, (marks) => `DELETE FROM im_todos WHERE id IN (${marks})`, plan.todoIds);

	let files = 0;
	const keys = await loadFileKeys(env, plan.fileIds);
	for (const [id, key] of keys) {
		await env.BUCKET.delete(key);
		await env.DB.prepare("DELETE FROM im_files WHERE id = ?").bind(id).run();
		files += 1;
	}

	const result: ImPurgeResult = {
		at: now,
		categories,
		rooms: plan.roomIds.length,
		messages: plan.messageIds.length,
		files,
		fileBytes: plan.fileBytes,
		roomFiles,
		mailShares,
		meetings: plan.meetingIds.length,
		todos: plan.todoIds.length,
	};
	const changes = imPurgeRoomChanges(plan);
	await createAuditLog(env, {
		actorUserId: adminId,
		action: IM_PURGE_AUDIT_ACTION,
		metadata: { ...result, realEmails, changes },
	});
	if (changes.length) await notifyImUsers(env, plan.affectedUserIds, { type: "chatPurged", data: { epoch: now } });
	return result;
}

async function loadFileKeys(env: CloudflareEnv, ids: string[]): Promise<Map<string, string>> {
	const keys = new Map<string, string>();
	for (let index = 0; index < ids.length; index += ID_CHUNK) {
		const chunk = ids.slice(index, index + ID_CHUNK);
		const rows = await all<{ id: string; object_key: string }>(env, `SELECT id, object_key FROM im_files WHERE id IN (${chunk.map(() => "?").join(",")})`, ...chunk);
		for (const row of rows) keys.set(row.id, row.object_key);
	}
	return keys;
}

type StoredRun = ImPurgeResult & { changes?: ImPurgeRoomChange[]; realEmails?: string[] };

async function loadRuns(env: CloudflareEnv): Promise<{ actor: string | null; run: StoredRun }[]> {
	const rows = await all<{ actor_user_id: string | null; metadata: string | null }>(
		env,
		"SELECT actor_user_id, metadata FROM audit_logs WHERE action = ? ORDER BY created_at DESC LIMIT 50",
		IM_PURGE_AUDIT_ACTION,
	);
	return rows.flatMap((row) => {
		try {
			const run = JSON.parse(row.metadata ?? "") as StoredRun;
			return typeof run?.at === "number" ? [{ actor: row.actor_user_id, run }] : [];
		} catch {
			return [];
		}
	});
}

/** Past runs, newest first, for the page's history. */
export async function listImPurgeRuns(env: CloudflareEnv) {
	return (await loadRuns(env)).map(({ run }) => {
		const { changes, realEmails, ...counts } = run;
		void changes;
		void realEmails;
		return counts;
	});
}

/**
 * What HuLa must drop from its local store since `since` (the epoch it last applied, 0 if never): rooms that were
 * deleted and single messages removed from rooms that stay. `epoch` is the newest run, to remember once applied.
 */
export async function listImPurgeChanges(env: CloudflareEnv, since: number) {
	const runs = await loadRuns(env);
	return mergeImPurgeRoomChanges(
		runs.map(({ run }) => ({ at: run.at, rooms: run.changes ?? [] })),
		Number.isFinite(since) ? since : 0,
	);
}
