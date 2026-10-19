import { newId } from "@/lib/ids";
import {
	IM_ALL_STAFF_ROOM_ID,
	IM_ALL_STAFF_ROOM_NAME,
	IM_GROUP_MEMBER_LIMIT,
	IM_GROUP_NAME_LIMIT,
	IM_MEDIA_TYPES,
	IM_MSG_TYPE,
	IM_OFFLINE,
	IM_ONLINE,
	IM_RECALL_WINDOW_MS,
	IM_ROLE,
	IM_ROOM_TYPE,
	IM_SYNC_MESSAGES_PER_ROOM,
	ImChatError,
	defaultGroupName,
	imUserName,
	parseImMessageId,
	parseMediaBody,
	parseTextBody,
	sessionPreview,
	singleRoomKey,
	toImMessage,
	type ImMessageResponse,
	type ImMessageRow,
	type ImUserRow,
} from "./chat-utils";
import { requireUploadedImFiles } from "./files";
import { imFileIdFromUrl } from "./files-utils";
import { IM_DEFAULT_USER_STATE_ID, imAvatarUrl } from "./users-utils";

/**
 * Rooms, members and messages for the HuLa API, in D1 through raw SQL (the
 * sync query needs a window function). Membership is the access check for
 * everything: a user sees and writes only rooms they are a member of.
 */
type Env = CloudflareEnv;

const ACTIVE_USER = "u.disabled = 0 AND u.deleted_at IS NULL";
/** D1 binds at most 100 parameters per statement. */
const IN_CHUNK = 90;

interface MemberRow {
	room_id: string;
	user_id: string;
	role: number;
	room_type: number;
	owner_id: string | null;
}

interface SessionRow {
	id: string;
	type: number;
	hot_flag: number;
	name: string;
	avatar: string;
	active_time: number;
	created_at: number;
	role: number;
	my_name: string;
	remark: string;
	top: number;
	hide: number;
	mute_notification: number;
	shield: number;
	member_count: number;
	unread_count: number;
	lm_type: number | null;
	lm_body: string | null;
	lm_from_uid: string | null;
	lm_recalled_by: string | null;
	lm_sender_name: string | null;
	lm_sender_email: string | null;
	lm_recaller_name: string | null;
	lm_recaller_email: string | null;
	peer_id: string | null;
	peer_name: string | null;
	peer_email: string | null;
	peer_avatar_key: string | null;
}

interface PersonRow {
	user_id: string;
	email: string;
	name: string;
	avatar_key: string | null;
	last_sign_in_at: number | null;
	online: number | null;
	last_opt_time: number | null;
	role?: number;
	my_name?: string;
	created_at?: number;
}

function db(env: Env) {
	return env.DB;
}

async function selectIn<T>(env: Env, sql: (placeholders: string) => string, ids: readonly (string | number)[], ...before: unknown[]): Promise<T[]> {
	const rows: T[] = [];
	for (let index = 0; index < ids.length; index += IN_CHUNK) {
		const chunk = ids.slice(index, index + IN_CHUNK);
		const result = await db(env)
			.prepare(sql(chunk.map(() => "?").join(", ")))
			.bind(...before, ...chunk)
			.all<T>();
		rows.push(...result.results);
	}
	return rows;
}

/**
 * Keeps room "1" holding exactly the active accounts. Accounts are created by
 * admins in mailflare, so joining the directory happens here rather than
 * through an invitation.
 */
export async function ensureAllStaffRoom(env: Env): Promise<void> {
	const now = Date.now();
	await db(env).batch([
		db(env)
			.prepare("INSERT OR IGNORE INTO im_rooms (id, type, hot_flag, name, active_time, created_at) VALUES (?, ?, 1, ?, ?, ?)")
			.bind(IM_ALL_STAFF_ROOM_ID, IM_ROOM_TYPE.GROUP, IM_ALL_STAFF_ROOM_NAME, now, now),
		db(env)
			.prepare(
				`INSERT OR IGNORE INTO im_room_members (room_id, user_id, role, created_at)
				SELECT ?, u.id, CASE WHEN u.is_primary_admin THEN ${IM_ROLE.OWNER} WHEN u.role = 'admin' THEN ${IM_ROLE.ADMIN} ELSE ${IM_ROLE.MEMBER} END, ?
				FROM users u WHERE ${ACTIVE_USER}`,
			)
			.bind(IM_ALL_STAFF_ROOM_ID, now),
		db(env)
			.prepare(`DELETE FROM im_room_members WHERE room_id = ? AND user_id IN (SELECT u.id FROM users u WHERE NOT (${ACTIVE_USER}))`)
			.bind(IM_ALL_STAFF_ROOM_ID),
	]);
}

async function findMember(env: Env, roomId: string, userId: string): Promise<MemberRow | null> {
	return db(env)
		.prepare(
			`SELECT m.room_id, m.user_id, m.role, r.type AS room_type, r.owner_id
			FROM im_room_members m JOIN im_rooms r ON r.id = m.room_id
			WHERE m.room_id = ? AND m.user_id = ?`,
		)
		.bind(roomId, userId)
		.first<MemberRow>();
}

async function requireMember(env: Env, roomId: unknown, userId: string): Promise<MemberRow> {
	if (typeof roomId !== "string" || !roomId) throw new ImChatError(400, "缺少会话");
	if (roomId === IM_ALL_STAFF_ROOM_ID) await ensureAllStaffRoom(env);
	const member = await findMember(env, roomId, userId);
	if (!member) throw new ImChatError(403, "你不在该会话中");
	return member;
}

async function requireGroupMember(env: Env, roomId: unknown, userId: string): Promise<MemberRow> {
	const member = await requireMember(env, roomId, userId);
	if (member.room_type !== IM_ROOM_TYPE.GROUP) throw new ImChatError(400, "不是群聊");
	return member;
}

function isManager(member: MemberRow): boolean {
	return member.role === IM_ROLE.OWNER || member.role === IM_ROLE.ADMIN;
}

// Sessions -------------------------------------------------------------------

const SESSION_SELECT = `
	SELECT r.id, r.type, r.hot_flag, r.name, r.avatar, r.active_time, r.created_at,
		m.role, m.my_name, m.remark, m.top, m.hide, m.mute_notification, m.shield,
		(SELECT COUNT(*) FROM im_room_members c WHERE c.room_id = r.id) AS member_count,
		(SELECT COUNT(*) FROM im_messages x WHERE x.room_id = r.id AND x.id > m.last_read_msg_id AND x.from_uid <> m.user_id) AS unread_count,
		lm.type AS lm_type, lm.body AS lm_body, lm.from_uid AS lm_from_uid, lm.recalled_by AS lm_recalled_by,
		lu.name AS lm_sender_name, lu.email AS lm_sender_email, ru.name AS lm_recaller_name, ru.email AS lm_recaller_email,
		peer.id AS peer_id, peer.name AS peer_name, peer.email AS peer_email, peer.avatar_key AS peer_avatar_key
	FROM im_room_members m
	JOIN im_rooms r ON r.id = m.room_id
	LEFT JOIN im_messages lm ON lm.id = r.last_msg_id
	LEFT JOIN users lu ON lu.id = lm.from_uid
	LEFT JOIN users ru ON ru.id = lm.recalled_by
	LEFT JOIN im_room_members pm ON r.type = ${IM_ROOM_TYPE.SINGLE} AND pm.room_id = r.id AND pm.user_id <> m.user_id
	LEFT JOIN users peer ON peer.id = pm.user_id
	WHERE m.user_id = ?`;

function toSession(row: SessionRow, viewerUid: string, origin: string) {
	const isGroup = row.type === IM_ROOM_TYPE.GROUP;
	const peer = row.peer_id ? { id: row.peer_id, name: row.peer_name ?? "", email: row.peer_email ?? "", avatar_key: row.peer_avatar_key } : null;
	const text = sessionPreview({
		row:
			row.lm_type === null || row.lm_body === null || row.lm_from_uid === null
				? null
				: { type: row.lm_type, body: row.lm_body, from_uid: row.lm_from_uid, recalled_by: row.lm_recalled_by },
		viewerUid,
		senderName: imUserName(row.lm_sender_email === null ? null : { name: row.lm_sender_name ?? "", email: row.lm_sender_email }),
		recallerName: imUserName(row.lm_recaller_email === null ? null : { name: row.lm_recaller_name ?? "", email: row.lm_recaller_email }),
		isGroup,
	});
	return {
		id: row.id,
		roomId: row.id,
		// HuLa's groupId; rooms and groups share ids here.
		detailId: isGroup ? row.id : (peer?.id ?? ""),
		type: row.type,
		hotFlag: row.hot_flag,
		name: isGroup ? row.name : imUserName(peer),
		avatar: isGroup ? row.avatar : peer ? imAvatarUrl({ id: peer.id, avatarKey: peer.avatar_key }, origin) : "",
		account: isGroup ? row.id : (peer?.email ?? ""),
		text,
		unreadCount: Number(row.unread_count) || 0,
		activeTime: row.active_time,
		top: Boolean(row.top),
		hide: Boolean(row.hide),
		muteNotification: row.mute_notification,
		shield: Boolean(row.shield),
		operate: 0,
		remark: row.remark,
		myName: row.my_name,
		memberNum: isGroup ? Number(row.member_count) : undefined,
		allowScanEnter: false,
		createTime: row.created_at,
		updateTime: row.active_time,
	};
}

export type ImSession = ReturnType<typeof toSession>;

export async function listSessions(env: Env, userId: string, origin: string): Promise<ImSession[]> {
	await ensureAllStaffRoom(env);
	const result = await db(env).prepare(`${SESSION_SELECT} ORDER BY r.active_time DESC`).bind(userId).all<SessionRow>();
	return result.results.map((row) => toSession(row, userId, origin));
}

export async function getSession(env: Env, userId: string, roomId: unknown, origin: string): Promise<ImSession> {
	await requireMember(env, roomId, userId);
	const row = await db(env).prepare(`${SESSION_SELECT} AND m.room_id = ?`).bind(userId, roomId).first<SessionRow>();
	if (!row) throw new ImChatError(404, "会话不存在");
	return toSession(row, userId, origin);
}

/** Finds or creates the one-to-one room with another active user and shows it in the caller's list. */
export async function openSingleRoom(env: Env, userId: string, peerUid: unknown): Promise<string> {
	if (typeof peerUid !== "string" || !peerUid) throw new ImChatError(400, "缺少联系人");
	if (peerUid === userId) throw new ImChatError(400, "不能和自己聊天");
	const peer = await db(env).prepare(`SELECT u.id FROM users u WHERE u.id = ? AND ${ACTIVE_USER}`).bind(peerUid).first<{ id: string }>();
	if (!peer) throw new ImChatError(404, "找不到该联系人");
	const key = singleRoomKey(userId, peerUid);
	const now = Date.now();
	await db(env)
		.prepare("INSERT OR IGNORE INTO im_rooms (id, type, single_key, active_time, created_at) VALUES (?, ?, ?, ?, ?)")
		.bind(newId(), IM_ROOM_TYPE.SINGLE, key, now, now)
		.run();
	const room = await db(env).prepare("SELECT id FROM im_rooms WHERE single_key = ?").bind(key).first<{ id: string }>();
	if (!room) throw new ImChatError(404, "会话不存在");
	const addMember = "INSERT OR IGNORE INTO im_room_members (room_id, user_id, role, created_at) VALUES (?, ?, ?, ?)";
	await db(env).batch([
		db(env).prepare(addMember).bind(room.id, userId, IM_ROLE.MEMBER, now),
		db(env).prepare(addMember).bind(room.id, peerUid, IM_ROLE.MEMBER, now),
		db(env).prepare("UPDATE im_room_members SET hide = 0 WHERE room_id = ? AND user_id = ?").bind(room.id, userId),
	]);
	return room.id;
}

const MEMBER_FLAGS = {
	top: "top",
	hide: "hide",
	muteNotification: "mute_notification",
	shield: "shield",
	myName: "my_name",
	remark: "remark",
} as const;

export type ImMemberFlags = Partial<{ top: boolean; hide: boolean; muteNotification: number; shield: boolean; myName: string; remark: string }>;

/** Per-member settings of a room: pinning, hiding, muting, shielding and the caller's own names for it. */
export async function updateMemberFlags(env: Env, userId: string, roomId: unknown, flags: ImMemberFlags): Promise<void> {
	await requireMember(env, roomId, userId);
	const entries = Object.entries(flags).filter(([, value]) => value !== undefined) as [keyof typeof MEMBER_FLAGS, string | number | boolean][];
	if (!entries.length) return;
	const assignments = entries.map(([key]) => `${MEMBER_FLAGS[key]} = ?`).join(", ");
	const values = entries.map(([, value]) => (typeof value === "boolean" ? Number(value) : value));
	await db(env)
		.prepare(`UPDATE im_room_members SET ${assignments} WHERE room_id = ? AND user_id = ?`)
		.bind(...values, roomId, userId)
		.run();
}

// People ---------------------------------------------------------------------

const PERSON_COLUMNS = "u.id AS user_id, u.email, u.name, u.avatar_key, u.last_sign_in_at, p.online, p.last_opt_time";

function toPerson(row: PersonRow, origin: string) {
	return {
		uid: row.user_id,
		account: row.email,
		name: imUserName({ name: row.name, email: row.email }),
		avatar: imAvatarUrl({ id: row.user_id, avatarKey: row.avatar_key }, origin),
		activeStatus: row.online ? IM_ONLINE : IM_OFFLINE,
		lastOptTime: row.last_opt_time ?? (row.last_sign_in_at ? row.last_sign_in_at * 1000 : 0),
		locPlace: "",
		userStateId: IM_DEFAULT_USER_STATE_ID,
		wearingItemId: null,
		itemIds: [] as string[],
		linkedGitee: false,
		linkedGithub: false,
	};
}

/** HuLa's room member (`RoomMemberResponse` in Rust, `UserItem` in the web code). */
export async function listMembers(env: Env, userId: string, roomId: unknown, origin: string) {
	const member = await requireGroupMember(env, roomId, userId);
	const result = await db(env)
		.prepare(
			`SELECT ${PERSON_COLUMNS}, m.role, m.my_name, m.created_at
			FROM im_room_members m JOIN users u ON u.id = m.user_id LEFT JOIN im_presence p ON p.user_id = u.id
			WHERE m.room_id = ? AND ${ACTIVE_USER}
			ORDER BY m.role, m.created_at`,
		)
		.bind(member.room_id)
		.all<PersonRow>();
	return result.results.map((row) => ({
		...toPerson(row, origin),
		id: `${member.room_id}:${row.user_id}`,
		roomId: member.room_id,
		roleId: row.role,
		myName: row.my_name ?? "",
		createTime: row.created_at,
	}));
}

/** The directory as HuLa's friend list: every other active account. */
export async function listDirectory(env: Env, userId: string) {
	const result = await db(env)
		.prepare(`SELECT ${PERSON_COLUMNS} FROM users u LEFT JOIN im_presence p ON p.user_id = u.id WHERE ${ACTIVE_USER} AND u.id <> ? ORDER BY u.name, u.email`)
		.bind(userId)
		.all<PersonRow>();
	return result.results.map((row) => ({
		uid: row.user_id,
		remark: "",
		activeStatus: row.online ? IM_ONLINE : IM_OFFLINE,
		lastOptTime: row.last_opt_time ?? (row.last_sign_in_at ? row.last_sign_in_at * 1000 : 0),
		hideMyPosts: false,
		hideTheirPosts: false,
	}));
}

export async function getPeople(env: Env, uids: unknown, origin: string) {
	const ids = Array.isArray(uids) ? [...new Set(uids.filter((uid): uid is string => typeof uid === "string"))].slice(0, 500) : [];
	const rows = await selectIn<PersonRow>(
		env,
		(placeholders) => `SELECT ${PERSON_COLUMNS} FROM users u LEFT JOIN im_presence p ON p.user_id = u.id WHERE ${ACTIVE_USER} AND u.id IN (${placeholders})`,
		ids,
	);
	return rows.map((row) => toPerson(row, origin));
}

export async function setPresence(env: Env, userId: string, online: boolean): Promise<void> {
	await db(env)
		.prepare(
			"INSERT INTO im_presence (user_id, online, last_opt_time) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET online = excluded.online, last_opt_time = excluded.last_opt_time",
		)
		.bind(userId, Number(online), Date.now())
		.run();
}

// Messages -------------------------------------------------------------------

const MESSAGE_COLUMNS = "x.id, x.room_id, x.from_uid, x.type, x.body, x.reply_msg_id, x.recalled_by, x.recalled_at, x.created_at";

/** Turns stored rows into HuLa messages for one viewer, loading the senders and quoted messages they mention. */
async function renderMessages(env: Env, viewerUid: string, rows: ImMessageRow[], origin: string): Promise<ImMessageResponse[]> {
	if (!rows.length) return [];
	const replyIds = [...new Set(rows.map((row) => row.reply_msg_id).filter((id): id is number => id !== null))];
	const replyRows = await selectIn<ImMessageRow>(env, (placeholders) => `SELECT ${MESSAGE_COLUMNS} FROM im_messages x WHERE x.id IN (${placeholders})`, replyIds);
	const replies = new Map(replyRows.map((row) => [row.id, row]));
	const userIds = new Set<string>();
	for (const row of [...rows, ...replyRows]) {
		userIds.add(row.from_uid);
		if (row.recalled_by) userIds.add(row.recalled_by);
	}
	const userRows = await selectIn<ImUserRow>(env, (placeholders) => `SELECT id, email, name, avatar_key FROM users WHERE id IN (${placeholders})`, [...userIds]);
	const users = new Map(userRows.map((row) => [row.id, row]));
	const roomIds = [...new Set(rows.map((row) => row.room_id))];
	const roomRows = await selectIn<{ id: string; type: number }>(env, (placeholders) => `SELECT id, type FROM im_rooms WHERE id IN (${placeholders})`, roomIds);
	const roomTypes = new Map(roomRows.map((row) => [row.id, row.type]));
	const avatarUrl = (user: ImUserRow) => imAvatarUrl({ id: user.id, avatarKey: user.avatar_key }, origin);
	return rows.map((row) =>
		toImMessage(row, { viewerUid, isGroup: roomTypes.get(row.room_id) === IM_ROOM_TYPE.GROUP, users, replies, avatarUrl }),
	);
}

/**
 * What HuLa's `msg/list` sync stores locally: the latest messages of every
 * room the user is in, oldest first. HuLa pages history from its own database,
 * so this is the only way messages reach a client that was offline.
 */
export async function listSyncMessages(env: Env, userId: string, origin: string): Promise<ImMessageResponse[]> {
	await ensureAllStaffRoom(env);
	const result = await db(env)
		.prepare(
			`SELECT ${MESSAGE_COLUMNS} FROM (
				SELECT y.*, ROW_NUMBER() OVER (PARTITION BY y.room_id ORDER BY y.id DESC) AS rn
				FROM im_messages y JOIN im_room_members m ON m.room_id = y.room_id AND m.user_id = ?
			) x WHERE x.rn <= ? ORDER BY x.id`,
		)
		.bind(userId, IM_SYNC_MESSAGES_PER_ROOM)
		.all<ImMessageRow>();
	return renderMessages(env, userId, result.results, origin);
}

/** A page of one room's history, newest first by cursor (the last id returned). */
export async function pageMessages(env: Env, userId: string, roomId: unknown, cursor: string | null, pageSize: number, origin: string) {
	const member = await requireMember(env, roomId, userId);
	const before = parseImMessageId(cursor);
	const size = Math.min(Math.max(pageSize || 20, 1), 100);
	const result = await db(env)
		.prepare(`SELECT ${MESSAGE_COLUMNS} FROM im_messages x WHERE x.room_id = ? AND x.id < ? ORDER BY x.id DESC LIMIT ?`)
		.bind(member.room_id, before ?? Number.MAX_SAFE_INTEGER, size + 1)
		.all<ImMessageRow>();
	const rows = result.results.slice(0, size);
	const list = await renderMessages(env, userId, [...rows].reverse(), origin);
	return { list, cursor: rows.length ? String(rows[rows.length - 1].id) : "", isLast: result.results.length <= size };
}

async function insertMessage(
	env: Env,
	values: { roomId: string; fromUid: string; clientMsgId: string | null; type: number; body: unknown; replyMsgId: number | null },
): Promise<ImMessageRow> {
	const now = Date.now();
	const inserted = await db(env)
		.prepare(
			`INSERT OR IGNORE INTO im_messages (room_id, from_uid, client_msg_id, type, body, reply_msg_id, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id, room_id, from_uid, type, body, reply_msg_id, recalled_by, recalled_at, created_at`,
		)
		.bind(values.roomId, values.fromUid, values.clientMsgId, values.type, JSON.stringify(values.body), values.replyMsgId, now)
		.first<ImMessageRow>();
	if (!inserted) {
		// The client retried a send that was stored already.
		const existing = await db(env)
			.prepare(`SELECT ${MESSAGE_COLUMNS} FROM im_messages x WHERE x.from_uid = ? AND x.client_msg_id = ?`)
			.bind(values.fromUid, values.clientMsgId)
			.first<ImMessageRow>();
		if (!existing) throw new ImChatError(400, "消息发送失败");
		return existing;
	}
	await db(env).batch([
		db(env)
			.prepare("UPDATE im_rooms SET last_msg_id = MAX(COALESCE(last_msg_id, 0), ?), active_time = MAX(active_time, ?) WHERE id = ?")
			.bind(inserted.id, now, values.roomId),
		db(env).prepare("UPDATE im_room_members SET hide = 0 WHERE room_id = ? AND hide = 1").bind(values.roomId),
		db(env)
			.prepare("UPDATE im_room_members SET last_read_msg_id = MAX(last_read_msg_id, ?) WHERE room_id = ? AND user_id = ?")
			.bind(inserted.id, values.roomId, values.fromUid),
	]);
	return inserted;
}

async function roomMemberIds(env: Env, roomId: string): Promise<string[]> {
	const result = await db(env).prepare("SELECT user_id FROM im_room_members WHERE room_id = ?").bind(roomId).all<{ user_id: string }>();
	return result.results.map((row) => row.user_id);
}

export interface ImDelivery {
	message: ImMessageResponse;
	/** Members who should receive it over the socket. */
	recipients: string[];
}

export async function sendMessage(
	env: Env,
	userId: string,
	input: { id?: unknown; roomId?: unknown; msgType?: unknown; body?: unknown },
	origin: string,
): Promise<ImDelivery> {
	const member = await requireMember(env, input.roomId, userId);
	const type = Number(input.msgType);
	let body: unknown;
	if (type === IM_MSG_TYPE.TEXT) {
		body = parseTextBody(input.body);
		if (!body) throw new ImChatError(400, "消息内容为空或超过长度限制");
	} else if (IM_MEDIA_TYPES.has(type)) {
		const media = parseMediaBody(type, input.body, (url) => imFileIdFromUrl(url, origin));
		if (!media) throw new ImChatError(400, "文件消息无效");
		await requireUploadedImFiles(env, media.fileIds);
		body = media.body;
	} else {
		throw new ImChatError(400, "暂不支持该类型的消息");
	}
	let replyMsgId = parseImMessageId((input.body as { replyMsgId?: unknown } | null)?.replyMsgId);
	if (replyMsgId !== null) {
		const reply = await db(env).prepare("SELECT id FROM im_messages WHERE id = ? AND room_id = ?").bind(replyMsgId, member.room_id).first();
		if (!reply) replyMsgId = null;
	}
	const clientMsgId = typeof input.id === "string" && input.id && input.id.length <= 64 ? input.id : null;
	const row = await insertMessage(env, { roomId: member.room_id, fromUid: userId, clientMsgId, type, body, replyMsgId });
	const [message] = await renderMessages(env, userId, [row], origin);
	// The sender's client already shows its own message; a second copy over the socket would race its id swap.
	const recipients = (await roomMemberIds(env, member.room_id)).filter((id) => id !== userId);
	return { message, recipients };
}

/**
 * Posts a mail card (see `mail-share.ts`) as `userId`. Unlike `sendMessage` the sender's own client did not
 * send it, so the sender is among the recipients too.
 */
export async function postMailCard(env: Env, userId: string, roomId: unknown, body: unknown, origin: string): Promise<ImDelivery> {
	const member = await requireMember(env, roomId, userId);
	const row = await insertMessage(env, { roomId: member.room_id, fromUid: userId, clientMsgId: null, type: IM_MSG_TYPE.MAIL_CARD, body, replyMsgId: null });
	const [message] = await renderMessages(env, userId, [row], origin);
	return { message, recipients: await roomMemberIds(env, member.room_id) };
}

export async function isRoomMember(env: Env, roomId: string, userId: string): Promise<boolean> {
	return (await findMember(env, roomId, userId)) !== null;
}

async function postSystemMessage(env: Env, roomId: string, actorUid: string, text: string, origin: string): Promise<ImDelivery> {
	const row = await insertMessage(env, { roomId, fromUid: actorUid, clientMsgId: null, type: IM_MSG_TYPE.SYSTEM, body: text, replyMsgId: null });
	const [message] = await renderMessages(env, actorUid, [row], origin);
	return { message, recipients: await roomMemberIds(env, roomId) };
}

export async function markRead(env: Env, userId: string, roomId: unknown): Promise<void> {
	const member = await requireMember(env, roomId, userId);
	await db(env)
		.prepare(
			"UPDATE im_room_members SET last_read_msg_id = MAX(last_read_msg_id, (SELECT COALESCE(last_msg_id, 0) FROM im_rooms WHERE id = ?)) WHERE room_id = ? AND user_id = ?",
		)
		.bind(member.room_id, member.room_id, userId)
		.run();
}

/** Who has read each message, for group read receipts; only messages in the caller's rooms count. */
export async function readCounts(env: Env, userId: string, msgIds: number[]) {
	const rows = await selectIn<{ id: number; read_count: number; total: number }>(
		env,
		(placeholders) => `SELECT x.id,
			(SELECT COUNT(*) FROM im_room_members m WHERE m.room_id = x.room_id AND m.user_id <> x.from_uid AND m.last_read_msg_id >= x.id) AS read_count,
			(SELECT COUNT(*) FROM im_room_members m WHERE m.room_id = x.room_id AND m.user_id <> x.from_uid) AS total
			FROM im_messages x
			WHERE x.room_id IN (SELECT room_id FROM im_room_members WHERE user_id = ?) AND x.id IN (${placeholders})`,
		msgIds,
		userId,
	);
	return rows.map((row) => ({ msgId: String(row.id), readCount: Number(row.read_count), unReadCount: Number(row.total) - Number(row.read_count) }));
}

/**
 * Senders recall their own messages within two minutes; group owners and
 * admins can recall anyone's at any time.
 */
export async function recallMessage(env: Env, userId: string, input: { msgId?: unknown; roomId?: unknown }) {
	const member = await requireMember(env, input.roomId, userId);
	const msgId = parseImMessageId(input.msgId);
	const row = msgId === null
		? null
		: await db(env).prepare(`SELECT ${MESSAGE_COLUMNS} FROM im_messages x WHERE x.id = ? AND x.room_id = ?`).bind(msgId, member.room_id).first<ImMessageRow>();
	if (!row) throw new ImChatError(404, "消息不存在");
	if (row.recalled_by) throw new ImChatError(400, "消息已撤回");
	if (row.type === IM_MSG_TYPE.SYSTEM) throw new ImChatError(400, "系统消息不能撤回");
	const canModerate = member.room_type === IM_ROOM_TYPE.GROUP && isManager(member);
	if (row.from_uid !== userId && !canModerate) throw new ImChatError(403, "只能撤回自己的消息");
	if (row.from_uid === userId && !canModerate && Date.now() - row.created_at > IM_RECALL_WINDOW_MS) {
		throw new ImChatError(403, "超过2分钟的消息不能撤回");
	}
	await db(env).prepare("UPDATE im_messages SET recalled_by = ?, recalled_at = ? WHERE id = ?").bind(userId, Date.now(), row.id).run();
	return { event: { msgId: String(row.id), roomId: row.room_id, recallUid: userId }, recipients: await roomMemberIds(env, row.room_id) };
}

// Groups ---------------------------------------------------------------------

async function activeUsers(env: Env, uids: unknown, excluding: string): Promise<ImUserRow[]> {
	const ids = Array.isArray(uids) ? [...new Set(uids.filter((uid): uid is string => typeof uid === "string" && uid !== excluding))] : [];
	if (ids.length > IM_GROUP_MEMBER_LIMIT) throw new ImChatError(400, `群成员不能超过${IM_GROUP_MEMBER_LIMIT}人`);
	return selectIn<ImUserRow>(env, (placeholders) => `SELECT u.id, u.email, u.name, u.avatar_key FROM users u WHERE ${ACTIVE_USER} AND u.id IN (${placeholders})`, ids);
}

async function userName(env: Env, userId: string): Promise<string> {
	return imUserName(await db(env).prepare("SELECT name, email FROM users WHERE id = ?").bind(userId).first<{ name: string; email: string }>());
}

function namesOf(users: ImUserRow[]): string {
	return users.map((user) => imUserName(user)).join("、");
}

export async function createGroup(env: Env, userId: string, uidList: unknown, origin: string) {
	const invitees = await activeUsers(env, uidList, userId);
	if (invitees.length < 2) throw new ImChatError(400, "至少选择两位成员");
	const creatorName = await userName(env, userId);
	const roomId = newId();
	const now = Date.now();
	const addMember = "INSERT INTO im_room_members (room_id, user_id, role, created_at) VALUES (?, ?, ?, ?)";
	await db(env).batch([
		db(env)
			.prepare("INSERT INTO im_rooms (id, type, name, owner_id, active_time, created_at) VALUES (?, ?, ?, ?, ?, ?)")
			.bind(roomId, IM_ROOM_TYPE.GROUP, defaultGroupName([creatorName, ...invitees.map((user) => imUserName(user))]), userId, now, now),
		db(env).prepare(addMember).bind(roomId, userId, IM_ROLE.OWNER, now),
		...invitees.map((user) => db(env).prepare(addMember).bind(roomId, user.id, IM_ROLE.MEMBER, now)),
	]);
	const delivery = await postSystemMessage(env, roomId, userId, `${creatorName}邀请${namesOf(invitees)}加入了群聊`, origin);
	return { roomId, delivery };
}

function refuseDirectoryChange(roomId: string) {
	if (roomId === IM_ALL_STAFF_ROOM_ID) throw new ImChatError(400, "全员群成员随邮箱账号自动同步");
}

export async function inviteMembers(env: Env, userId: string, input: { roomId?: unknown; uidList?: unknown }, origin: string) {
	const member = await requireGroupMember(env, input.roomId, userId);
	refuseDirectoryChange(member.room_id);
	const existing = new Set(await roomMemberIds(env, member.room_id));
	const invitees = (await activeUsers(env, input.uidList, userId)).filter((user) => !existing.has(user.id));
	if (!invitees.length) throw new ImChatError(400, "所选成员都已在群里");
	if (existing.size + invitees.length > IM_GROUP_MEMBER_LIMIT) throw new ImChatError(400, `群成员不能超过${IM_GROUP_MEMBER_LIMIT}人`);
	const now = Date.now();
	await db(env).batch(
		invitees.map((user) =>
			db(env).prepare("INSERT OR IGNORE INTO im_room_members (room_id, user_id, role, created_at) VALUES (?, ?, ?, ?)").bind(member.room_id, user.id, IM_ROLE.MEMBER, now),
		),
	);
	return postSystemMessage(env, member.room_id, userId, `${await userName(env, userId)}邀请${namesOf(invitees)}加入了群聊`, origin);
}

export async function removeMembers(env: Env, userId: string, input: { roomId?: unknown; uidList?: unknown }, origin: string) {
	const member = await requireGroupMember(env, input.roomId, userId);
	refuseDirectoryChange(member.room_id);
	if (!isManager(member)) throw new ImChatError(403, "只有群主和管理员可以移除成员");
	const targets = Array.isArray(input.uidList) ? input.uidList.filter((uid): uid is string => typeof uid === "string" && uid !== userId) : [];
	const rows = await selectIn<{ user_id: string; role: number }>(
		env,
		(placeholders) => `SELECT user_id, role FROM im_room_members WHERE room_id = ? AND user_id IN (${placeholders})`,
		targets,
		member.room_id,
	);
	// Owners are never removed, and admins can only remove plain members.
	const removable = rows.filter((row) => row.role !== IM_ROLE.OWNER && (member.role === IM_ROLE.OWNER || row.role === IM_ROLE.MEMBER));
	if (!removable.length) throw new ImChatError(400, "没有可移除的成员");
	await db(env).batch(
		removable.map((row) => db(env).prepare("DELETE FROM im_room_members WHERE room_id = ? AND user_id = ?").bind(member.room_id, row.user_id)),
	);
	const removed = await activeUsers(env, removable.map((row) => row.user_id), userId);
	return postSystemMessage(env, member.room_id, userId, `${await userName(env, userId)}将${namesOf(removed)}移出了群聊`, origin);
}

/** Leaving hands ownership to the longest-standing admin, else member; the last one out deletes the group. */
export async function exitGroup(env: Env, userId: string, roomId: unknown, origin: string): Promise<ImDelivery | null> {
	const member = await requireGroupMember(env, roomId, userId);
	refuseDirectoryChange(member.room_id);
	const name = await userName(env, userId);
	await db(env).prepare("DELETE FROM im_room_members WHERE room_id = ? AND user_id = ?").bind(member.room_id, userId).run();
	const successor = await db(env)
		.prepare("SELECT user_id, role FROM im_room_members WHERE room_id = ? ORDER BY role, created_at LIMIT 1")
		.bind(member.room_id)
		.first<{ user_id: string; role: number }>();
	if (!successor) {
		await db(env).prepare("DELETE FROM im_rooms WHERE id = ?").bind(member.room_id).run();
		return null;
	}
	if (member.role === IM_ROLE.OWNER) {
		await db(env).batch([
			db(env).prepare("UPDATE im_room_members SET role = ? WHERE room_id = ? AND user_id = ?").bind(IM_ROLE.OWNER, member.room_id, successor.user_id),
			db(env).prepare("UPDATE im_rooms SET owner_id = ? WHERE id = ?").bind(successor.user_id, member.room_id),
		]);
	}
	return postSystemMessage(env, member.room_id, successor.user_id, `${name}退出了群聊`, origin);
}

export async function setAdmins(env: Env, userId: string, input: { roomId?: unknown; uidList?: unknown }, admin: boolean): Promise<void> {
	const member = await requireGroupMember(env, input.roomId, userId);
	if (member.role !== IM_ROLE.OWNER) throw new ImChatError(403, "只有群主可以设置管理员");
	const targets = Array.isArray(input.uidList) ? input.uidList.filter((uid): uid is string => typeof uid === "string" && uid !== userId) : [];
	if (!targets.length) throw new ImChatError(400, "请选择成员");
	await db(env).batch(
		targets.map((uid) =>
			db(env)
				.prepare("UPDATE im_room_members SET role = ? WHERE room_id = ? AND user_id = ? AND role <> ?")
				.bind(admin ? IM_ROLE.ADMIN : IM_ROLE.MEMBER, member.room_id, uid, IM_ROLE.OWNER),
		),
	);
}

export async function updateRoomInfo(env: Env, userId: string, input: { id?: unknown; name?: unknown; avatar?: unknown }, origin: string) {
	const member = await requireGroupMember(env, input.id, userId);
	if (!isManager(member)) throw new ImChatError(403, "只有群主和管理员可以修改群资料");
	const name = typeof input.name === "string" ? input.name.trim() : undefined;
	if (name !== undefined && (!name || name.length > IM_GROUP_NAME_LIMIT)) throw new ImChatError(400, `群名称需为1到${IM_GROUP_NAME_LIMIT}个字`);
	const avatar = typeof input.avatar === "string" ? input.avatar.trim() : undefined;
	if (avatar !== undefined && avatar && !/^https:\/\/\S{1,500}$/.test(avatar)) throw new ImChatError(400, "群头像地址无效");
	if (name !== undefined) await db(env).prepare("UPDATE im_rooms SET name = ? WHERE id = ?").bind(name, member.room_id).run();
	if (avatar !== undefined) await db(env).prepare("UPDATE im_rooms SET avatar = ? WHERE id = ?").bind(avatar, member.room_id).run();
	if (name === undefined) return null;
	return postSystemMessage(env, member.room_id, userId, `${await userName(env, userId)}将群名称修改为“${name}”`, origin);
}

/** HuLa's `GroupDetailReq`. */
export async function groupDetail(env: Env, userId: string, roomId: unknown) {
	const member = await requireGroupMember(env, roomId, userId);
	const row = await db(env)
		.prepare(
			`SELECT r.id, r.name, r.avatar, m.my_name, m.remark,
				(SELECT COUNT(*) FROM im_room_members c WHERE c.room_id = r.id) AS member_count,
				(SELECT COUNT(*) FROM im_room_members c JOIN im_presence p ON p.user_id = c.user_id AND p.online = 1 WHERE c.room_id = r.id) AS online_count
			FROM im_rooms r JOIN im_room_members m ON m.room_id = r.id AND m.user_id = ? WHERE r.id = ?`,
		)
		.bind(userId, member.room_id)
		.first<{ id: string; name: string; avatar: string; my_name: string; remark: string; member_count: number; online_count: number }>();
	if (!row) throw new ImChatError(404, "群聊不存在");
	return {
		roomId: row.id,
		groupName: row.name,
		avatar: row.avatar,
		account: row.id,
		roleId: member.role,
		memberNum: Number(row.member_count),
		onlineNum: Number(row.online_count),
		remark: row.remark,
		myName: row.my_name,
		allowScanEnter: false,
	};
}

/** The caller's groups in HuLa's `GroupListReq` shape (`im_room` in Rust). */
export async function listGroups(env: Env, userId: string) {
	await ensureAllStaffRoom(env);
	const result = await db(env)
		.prepare(
			`SELECT r.id, r.name, r.avatar, m.remark FROM im_room_members m JOIN im_rooms r ON r.id = m.room_id
			WHERE m.user_id = ? AND r.type = ? ORDER BY r.active_time DESC`,
		)
		.bind(userId, IM_ROOM_TYPE.GROUP)
		.all<{ id: string; name: string; avatar: string; remark: string }>();
	return result.results.map((row) => ({ id: row.id, roomId: row.id, groupId: row.id, roomName: row.name, avatar: row.avatar, remark: row.remark }));
}
