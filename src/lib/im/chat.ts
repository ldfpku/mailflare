import { newId } from "@/lib/ids";
import {
	DIRECTORY_SEARCH_LIMIT,
	IM_ALL_STAFF_ROOM_ID,
	IM_ALL_STAFF_ROOM_NAME,
	IM_AT_ALL_UID,
	IM_GROUP_MEMBER_LIMIT,
	IM_GROUP_NAME_LIMIT,
	IM_MEDIA_TYPES,
	IM_MEMBER_CHANGE,
	IM_MSG_TYPE,
	IM_OFFLINE,
	IM_ONLINE,
	IM_RECALL_WINDOW_MS,
	IM_ROLE,
	IM_ROOM_TYPE,
	IM_SESSION_OPERATE,
	IM_SYNC_MESSAGES_PER_ROOM,
	ImChatError,
	defaultGroupName,
	deletedFileNotice,
	imUserName,
	normalizeDirectoryKey,
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
import { deleteImFilesUnlessShared, requireUploadedImFiles } from "./files";
import { IM_ROOM_FILE_TYPES, roomFileName } from "./room-files-utils";
import { imAccessTokenHash, resolveImAccessToken } from "./tokens";
import { imFileIdFromUrl } from "./files-utils";
import { buildHistoryWhere, type ImHistoryParams } from "./history-utils";
import { imSearchTextOverride } from "./search-utils";
import { notifyImUsers } from "./notify";
import { fileRoomMessage, unfileRoomMessage } from "./room-files";
import { IM_DEFAULT_USER_STATE_ID, IM_INVISIBLE_USER_STATE_ID, imAvatarUrl, imRoomAvatarUrl } from "./users-utils";

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
	peer_avatar: string | null;
	peer_avatar_key: string | null;
}

interface PersonRow {
	user_id: string;
	email: string;
	name: string;
	imAvatar?: string | null;
	avatarKey?: string | null;
	last_sign_in_at: number | null;
	online: number | null;
	last_opt_time: number | null;
	imStateId?: string | null;
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
	await db(env).batch(allStaffRoomStatements(env, Date.now()));
}

/** `ensureAllStaffRoom` as statements, to run inside another batch; with `me` they only act for a signed-in sender. */
function allStaffRoomStatements(env: Env, now: number, me?: SenderCte): D1PreparedStatement[] {
	const prefix = me ? `WITH ${me.sql} ` : "";
	const guard = me ? "EXISTS (SELECT 1 FROM me)" : "1";
	const binds = me?.binds ?? [];
	return [
		db(env)
			.prepare(`${prefix}INSERT OR IGNORE INTO im_rooms (id, type, hot_flag, name, active_time, created_at) SELECT ?, ?, 1, ?, ?, ? WHERE ${guard}`)
			.bind(...binds, IM_ALL_STAFF_ROOM_ID, IM_ROOM_TYPE.GROUP, IM_ALL_STAFF_ROOM_NAME, now, now),
		db(env)
			.prepare(
				`${prefix}INSERT OR IGNORE INTO im_room_members (room_id, user_id, role, created_at)
				SELECT ?, u.id, CASE WHEN u.is_primary_admin THEN ${IM_ROLE.OWNER} WHEN u.role = 'admin' THEN ${IM_ROLE.ADMIN} ELSE ${IM_ROLE.MEMBER} END, ?
				FROM users u WHERE ${ACTIVE_USER} AND ${guard}`,
			)
			.bind(...binds, IM_ALL_STAFF_ROOM_ID, now),
		db(env)
			.prepare(`${prefix}DELETE FROM im_room_members WHERE room_id = ? AND user_id IN (SELECT u.id FROM users u WHERE NOT (${ACTIVE_USER})) AND ${guard}`)
			.bind(...binds, IM_ALL_STAFF_ROOM_ID),
	];
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

/** The caller's place in a group, for modules outside this file; throws unless they are a member. */
export async function requireGroupRole(env: Env, roomId: unknown, userId: string): Promise<{ roomId: string; manager: boolean }> {
	const member = await requireGroupMember(env, roomId, userId);
	return { roomId: member.room_id, manager: isManager(member) };
}

// Sessions -------------------------------------------------------------------

const SESSION_SELECT = `
	SELECT r.id, r.type, r.hot_flag, r.name, r.avatar, r.active_time, r.created_at,
		m.role, m.my_name, m.remark, m.top, m.hide, m.mute_notification, m.shield,
		(SELECT COUNT(*) FROM im_room_members c JOIN users u ON u.id = c.user_id WHERE c.room_id = r.id AND ${ACTIVE_USER}) AS member_count,
		(SELECT COUNT(*) FROM im_messages x WHERE x.room_id = r.id AND x.id > m.last_read_msg_id AND x.from_uid <> m.user_id) AS unread_count,
		lm.type AS lm_type, lm.body AS lm_body, lm.from_uid AS lm_from_uid, lm.recalled_by AS lm_recalled_by,
		COALESCE(lu.im_display_name, lu.name) AS lm_sender_name, lu.email AS lm_sender_email,
		COALESCE(ru.im_display_name, ru.name) AS lm_recaller_name, ru.email AS lm_recaller_email,
		peer.id AS peer_id, COALESCE(peer.im_display_name, peer.name) AS peer_name, peer.email AS peer_email,
		peer.im_avatar AS peer_avatar, peer.avatar_key AS peer_avatar_key
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
	const peer = row.peer_id ? { id: row.peer_id, name: row.peer_name ?? "", email: row.peer_email ?? "", imAvatar: row.peer_avatar, avatarKey: row.peer_avatar_key } : null;
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
		avatar: isGroup ? imRoomAvatarUrl(row, origin) : peer ? imAvatarUrl(peer, origin) : "",
		account: isGroup ? row.id : (peer?.email ?? ""),
		text,
		unreadCount: Number(row.unread_count) || 0,
		activeTime: row.active_time,
		top: Boolean(row.top),
		hide: Boolean(row.hide),
		muteNotification: row.mute_notification,
		shield: Boolean(row.shield),
		// Owners dissolve their group; everyone else leaves it.
		operate: !isGroup ? IM_SESSION_OPERATE.DELETE_FRIEND : row.role === IM_ROLE.OWNER ? IM_SESSION_OPERATE.DISSOLVE_GROUP : IM_SESSION_OPERATE.EXIT_GROUP,
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

const PERSON_COLUMNS = "u.id AS user_id, u.email, COALESCE(u.im_display_name, u.name) AS name, u.im_avatar AS imAvatar, u.avatar_key AS avatarKey, u.last_sign_in_at, p.online, p.last_opt_time, u.im_state_id AS imStateId";
const MAIL_DIRECTORY_COLUMNS = "u.id AS user_id, u.email, u.name, u.last_sign_in_at, p.online, p.last_opt_time";

function toPerson(row: PersonRow, origin: string) {
	return {
		uid: row.user_id,
		account: row.email,
		name: imUserName({ name: row.name, email: row.email }),
		avatar: imAvatarUrl({ id: row.user_id, imAvatar: row.imAvatar, avatarKey: row.avatarKey }, origin),
		activeStatus: row.online && row.imStateId !== IM_INVISIBLE_USER_STATE_ID ? IM_ONLINE : IM_OFFLINE,
		lastOptTime: row.last_opt_time ?? (row.last_sign_in_at ? row.last_sign_in_at * 1000 : 0),
		locPlace: "",
		userStateId: row.imStateId === IM_INVISIBLE_USER_STATE_ID ? IM_DEFAULT_USER_STATE_ID : row.imStateId ?? IM_DEFAULT_USER_STATE_ID,
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
		activeStatus: row.online && row.imStateId !== IM_INVISIBLE_USER_STATE_ID ? IM_ONLINE : IM_OFFLINE,
		lastOptTime: row.last_opt_time ?? (row.last_sign_in_at ? row.last_sign_in_at * 1000 : 0),
		hideMyPosts: false,
		hideTheirPosts: false,
	}));
}

interface DirectoryRow extends PersonRow {
	department: string | null;
	title: string | null;
}

/**
 * Searches every active account, not only people the caller has talked to: the name, the email's local part (which
 * is the name in pinyin, e.g. gaozq), the whole address once the term has an @, and the business card's department
 * and title. Exact and leading name matches come first. Used by HuLa's search box and the mail composer.
 */
export async function searchDirectory(env: Env, key: unknown, options: { excludeUserId?: string; limit?: number; chatNames?: boolean } = {}) {
	const term = normalizeDirectoryKey(key);
	if (!term) return [];
	const limit = Math.min(Math.max(Math.trunc(options.limit ?? DIRECTORY_SEARCH_LIMIT), 1), DIRECTORY_SEARCH_LIMIT);
	const localPart = "lower(substr(u.email, 1, instr(u.email, '@') - 1))";
	const displayName = options.chatNames ? "COALESCE(u.im_display_name, u.name)" : "u.name";
	const name = `lower(${displayName})`;
	const result = await db(env)
		.prepare(
			`SELECT ${options.chatNames ? PERSON_COLUMNS : MAIL_DIRECTORY_COLUMNS}, c.department, c.title
			FROM users u LEFT JOIN im_presence p ON p.user_id = u.id LEFT JOIN business_cards c ON c.user_id = u.id
			WHERE ${ACTIVE_USER} AND u.id <> ? AND (
				instr(${name}, ?) > 0
				OR instr(${localPart}, ?) > 0
				OR (instr(?, '@') > 0 AND instr(lower(u.email), ?) > 0)
				OR instr(lower(coalesce(c.department, '')), ?) > 0
				OR instr(lower(coalesce(c.title, '')), ?) > 0
			)
			ORDER BY CASE
				WHEN ${name} = ? OR ${localPart} = ? THEN 0
				WHEN instr(${name}, ?) = 1 OR instr(${localPart}, ?) = 1 THEN 1
				WHEN instr(${name}, ?) > 0 OR instr(${localPart}, ?) > 0 THEN 2
				ELSE 3
			END, ${displayName}, u.email
			LIMIT ?`,
		)
		.bind(options.excludeUserId ?? "", ...Array<string>(12).fill(term), limit)
		.all<DirectoryRow>();
	return result.results;
}

/** HuLa's people search: a person as `getUserByIds` returns one, plus the card's department and title. */
export async function searchImDirectory(env: Env, userId: string, key: unknown, origin: string) {
	const rows = await searchDirectory(env, key, { excludeUserId: userId, chatNames: true });
	return rows.map((row) => ({ ...toPerson(row, origin), department: row.department ?? "", title: row.title ?? "" }));
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

export async function profileRecipients(env: Env, userId: string): Promise<string[]> {
	const result = await db(env).prepare(
		`SELECT DISTINCT other.user_id FROM im_room_members mine
		JOIN im_room_members other ON other.room_id = mine.room_id
		JOIN users u ON u.id = other.user_id WHERE mine.user_id = ? AND ${ACTIVE_USER}`,
	).bind(userId).all<{ user_id: string }>();
	return [userId, ...result.results.map((row) => row.user_id)];
}

async function broadcastVisiblePresence(env: Env, userId: string, online: boolean, lastOptTime: number): Promise<void> {
	const status = await db(env).prepare(
		`SELECT p.visible_online, p.last_opt_time
		FROM users u LEFT JOIN im_presence p ON p.user_id = u.id WHERE u.id = ? AND ${ACTIVE_USER}`,
	).bind(userId).first<{ visible_online: number | null; last_opt_time: number | null }>();
	if (!status || Boolean(status.visible_online) !== online || status.last_opt_time !== lastOptTime) return;
	await notifyImUsers(env, await profileRecipients(env, userId), {
		type: "presenceChanged",
		data: { uid: userId, activeStatus: online ? IM_ONLINE : IM_OFFLINE, lastOptTime },
	});

	const rooms = await db(env).prepare(
		"SELECT r.id FROM im_rooms r JOIN im_room_members m ON m.room_id = r.id WHERE m.user_id = ? AND r.type = ?",
	).bind(userId, IM_ROOM_TYPE.GROUP).all<{ id: string }>();
	for (const room of rooms.results) {
		const count = await db(env).prepare(
			`SELECT COUNT(*) AS count FROM im_room_members m
			JOIN users u ON u.id = m.user_id JOIN im_presence p ON p.user_id = m.user_id
			WHERE m.room_id = ? AND p.online = 1 AND u.im_state_id != '5' AND ${ACTIVE_USER}`,
		).bind(room.id).first<{ count: number }>();
		const members = await db(env).prepare(
			`SELECT m.user_id FROM im_room_members m JOIN users u ON u.id = m.user_id
			WHERE m.room_id = ? AND ${ACTIVE_USER}`,
		).bind(room.id).all<{ user_id: string }>();
		await notifyImUsers(env, members.results.map((member) => member.user_id), {
			type: online ? "online" : "offline",
			data: { uid: userId, type: 1, roomId: room.id, onlineNum: Number(count?.count ?? 0), lastOptTime },
		});
	}
}

export async function reconcileVisiblePresence(env: Env, userId: string): Promise<void> {
	const transition = await db(env).prepare(
		`UPDATE im_presence SET
			visible_online = CASE WHEN online = 1 AND EXISTS (
				SELECT 1 FROM users u WHERE u.id = im_presence.user_id AND u.im_state_id != '5' AND ${ACTIVE_USER}
			) THEN 1 ELSE 0 END,
			last_opt_time = MAX(last_opt_time + 1, ?)
		WHERE user_id = ? AND visible_online != CASE WHEN online = 1 AND EXISTS (
			SELECT 1 FROM users u WHERE u.id = im_presence.user_id AND u.im_state_id != '5' AND ${ACTIVE_USER}
		) THEN 1 ELSE 0 END
		RETURNING visible_online, last_opt_time`,
	).bind(Date.now(), userId).first<{ visible_online: number; last_opt_time: number }>();
	if (transition) await broadcastVisiblePresence(env, userId, Boolean(transition.visible_online), transition.last_opt_time);
}

export async function setPresence(env: Env, userId: string, online: boolean): Promise<void> {
	await db(env)
		.prepare(
			`INSERT INTO im_presence (user_id, online, visible_online, last_opt_time) VALUES (?, ?, 0, ?)
			ON CONFLICT(user_id) DO UPDATE SET online = excluded.online`,
		)
		.bind(userId, Number(online), Date.now())
		.run();
	await reconcileVisiblePresence(env, userId);
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
	const userRows = await selectIn<ImUserRow>(env, (placeholders) => `SELECT id, email, COALESCE(im_display_name, name) AS name, im_avatar AS imAvatar, avatar_key AS avatarKey FROM users WHERE id IN (${placeholders})`, [...userIds]);
	const users = new Map(userRows.map((row) => [row.id, row]));
	const roomIds = [...new Set(rows.map((row) => row.room_id))];
	const roomRows = await selectIn<{ id: string; type: number }>(env, (placeholders) => `SELECT id, type FROM im_rooms WHERE id IN (${placeholders})`, roomIds);
	const roomTypes = new Map(roomRows.map((row) => [row.id, row.type]));
	const avatarUrl = (user: ImUserRow) => imAvatarUrl(user, origin);
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

/**
 * History for the web client's chat history and file windows (`GET im/chat/msg/history`):
 * one room or all of the user's rooms, filtered by kind, words, sender and time,
 * newest first. Membership is the access check, as for every chat read.
 */
export async function historyMessages(env: Env, userId: string, params: ImHistoryParams, origin: string) {
	if (params.roomId) await requireMember(env, params.roomId, userId);
	else await ensureAllStaffRoom(env);
	const { where, binds } = buildHistoryWhere(params);
	const result = await db(env)
		.prepare(
			`SELECT ${MESSAGE_COLUMNS} FROM im_messages x JOIN im_room_members m ON m.room_id = x.room_id AND m.user_id = ?
			WHERE ${where} ORDER BY x.id DESC LIMIT ?`,
		)
		.bind(userId, ...binds, params.size + 1)
		.all<ImMessageRow>();
	const rows = result.results.slice(0, params.size);
	const list = await renderMessages(env, userId, rows, origin);
	return { list, cursor: rows.length ? String(rows[rows.length - 1].id) : "", isLast: result.results.length <= params.size };
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
	const searchText = imSearchTextOverride(inserted.type, inserted.body);
	await db(env).batch([
		...(searchText === null ? [] : [db(env).prepare("UPDATE im_messages_fts SET text = ? WHERE rowid = ?").bind(searchText, inserted.id)]),
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
	const result = await storeSentMessage(env, { userId }, input, origin);
	if ("auth" in result) throw new ImChatError(403, "账号不可用");
	return result;
}

/**
 * `sendMessage` for HuLa's own send, authenticated by its access token. The token is checked inside the same D1
 * batch that stores the message, so a send costs one round trip to the database (each costs about 0.2 s from
 * the edge) instead of the eight it took looking things up one by one.
 */
export async function sendMessageWithToken(
	env: Env,
	token: string | null,
	input: { id?: unknown; roomId?: unknown; msgType?: unknown; body?: unknown },
	origin: string,
): Promise<ImDelivery | ImSendRefusal> {
	const tokenHash = await imAccessTokenHash(token);
	if (!tokenHash || !token) return { auth: "invalid" };
	return storeSentMessage(env, { token, tokenHash }, input, origin);
}

/** Who a message is from: an account the caller already checked, or whoever holds this access token. */
type ImSender = { userId: string } | { token: string; tokenHash: string };

/** The token did not sign anyone in; HuLa refreshes on `expired` and signs out on `invalid`. */
export interface ImSendRefusal {
	auth: "invalid" | "expired";
}

/** The sender as a `me(id)` CTE every statement of the send batch starts with. */
interface SenderCte {
	sql: string;
	binds: unknown[];
}

function senderCte(sender: ImSender, now: number): SenderCte {
	if ("userId" in sender) return { sql: "me(id) AS (SELECT ?)", binds: [sender.userId] };
	return {
		sql: `me(id) AS (SELECT s.user_id FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at * 1000 > ? AND ${ACTIVE_USER})`,
		binds: [sender.tokenHash, now],
	};
}

interface ParsedSend {
	type: number;
	body: unknown;
	fileIds: string[];
	replyMsgId: number | null;
}

function parseSend(input: { msgType?: unknown; body?: unknown }, origin: string): ParsedSend | ImChatError {
	const type = Number(input.msgType);
	const replyMsgId = parseImMessageId((input.body as { replyMsgId?: unknown } | null)?.replyMsgId);
	if (type === IM_MSG_TYPE.TEXT) {
		const body = parseTextBody(input.body);
		return body ? { type, body, fileIds: [], replyMsgId } : new ImChatError(400, "消息内容为空或超过长度限制");
	}
	if (IM_MEDIA_TYPES.has(type)) {
		const media = parseMediaBody(type, input.body, (url) => imFileIdFromUrl(url, origin));
		return media ? { type, body: media.body, fileIds: media.fileIds, replyMsgId } : new ImChatError(400, "文件消息无效");
	}
	return new ImChatError(400, "暂不支持该类型的消息");
}

/**
 * Stores a message and loads everything needed to answer and push it, in one batch (one D1 transaction). Every
 * write is conditional on the sender being a member of the room (and, by token, signed in), so a refused send
 * changes nothing; the reads at the end tell the refusals apart. A retried send (same client id) finds the stored
 * message instead of inserting a second one.
 */
async function storeSentMessage(
	env: Env,
	sender: ImSender,
	input: { id?: unknown; roomId?: unknown; msgType?: unknown; body?: unknown },
	origin: string,
): Promise<ImDelivery | ImSendRefusal> {
	const roomId = typeof input.roomId === "string" && input.roomId ? input.roomId : null;
	const parsed = parseSend(input, origin);
	if (!roomId || parsed instanceof ImChatError) return refuseSend(env, sender, input.roomId, parsed);

	const now = Date.now();
	const me = senderCte(sender, now);
	const withMe = (sql: string, ...binds: unknown[]) => db(env).prepare(`WITH ${me.sql}${sql}`).bind(...me.binds, ...binds);
	const clientMsgId = typeof input.id === "string" && input.id && input.id.length <= 64 ? input.id : null;
	// The statements find the new row by sender and client id, so a send without one gets a server-made id.
	const key = clientMsgId ?? newId("srv");
	const bodyJson = JSON.stringify(parsed.body);
	const fileIds = [...new Set(parsed.fileIds)];
	const inMessage = ", msg AS (SELECT id, room_id, from_uid, type, created_at FROM im_messages WHERE from_uid = (SELECT id FROM me) AND client_msg_id = ? AND room_id = ?)";
	const ownRow = "(SELECT id FROM me) AND client_msg_id = ?";

	const statements: D1PreparedStatement[] = [];
	const add = (statement: D1PreparedStatement) => statements.push(statement) - 1;
	const authAt =
		"tokenHash" in sender
			? add(
					db(env)
						.prepare("SELECT s.expires_at, u.disabled, u.deleted_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?")
						.bind(sender.tokenHash),
				)
			: -1;
	if (roomId === IM_ALL_STAFF_ROOM_ID) statements.push(...allStaffRoomStatements(env, now, me));
	const filesUploaded = fileIds.length
		? ` AND (SELECT COUNT(*) FROM im_files f WHERE f.id IN (${fileIds.map(() => "?").join(", ")}) AND f.uploaded_at IS NOT NULL) = ?`
		: "";
	// "@全体成员" is for a group's owner and admins; anyone else's send stores nothing and is refused below.
	const atAll = parsed.type === IM_MSG_TYPE.TEXT && Boolean((parsed.body as { atUidList?: string[] }).atUidList?.includes(IM_AT_ALL_UID));
	const atAllAllowed = atAll
		? ` AND m.role IN (${IM_ROLE.OWNER}, ${IM_ROLE.ADMIN}) AND (SELECT type FROM im_rooms WHERE id = m.room_id) = ${IM_ROOM_TYPE.GROUP}`
		: "";
	add(
		withMe(
			` INSERT OR IGNORE INTO im_messages (room_id, from_uid, client_msg_id, type, body, reply_msg_id, created_at)
			SELECT m.room_id, m.user_id, ?, ?, ?, (SELECT r.id FROM im_messages r WHERE r.id = ? AND r.room_id = m.room_id), ?
			FROM im_room_members m WHERE m.room_id = ? AND m.user_id = (SELECT id FROM me)${filesUploaded}${atAllAllowed}`,
			key,
			parsed.type,
			bodyJson,
			parsed.replyMsgId,
			now,
			roomId,
			...(fileIds.length ? [...fileIds, fileIds.length] : []),
		),
	);
	const searchText = imSearchTextOverride(parsed.type, bodyJson);
	if (searchText !== null) {
		add(withMe(` UPDATE im_messages_fts SET text = ? WHERE rowid = (SELECT id FROM im_messages WHERE from_uid = ${ownRow} AND room_id = ?)`, searchText, key, roomId));
	}
	add(
		withMe(
			`${inMessage} UPDATE im_rooms SET last_msg_id = MAX(COALESCE(last_msg_id, 0), (SELECT id FROM msg)), active_time = MAX(active_time, (SELECT created_at FROM msg))
			WHERE id = ? AND EXISTS (SELECT 1 FROM msg)`,
			key,
			roomId,
			roomId,
		),
	);
	add(withMe(`${inMessage} UPDATE im_room_members SET hide = 0 WHERE room_id = ? AND hide = 1 AND EXISTS (SELECT 1 FROM msg)`, key, roomId, roomId));
	add(
		withMe(
			`${inMessage} UPDATE im_room_members SET last_read_msg_id = MAX(last_read_msg_id, (SELECT id FROM msg))
			WHERE room_id = ? AND user_id = (SELECT id FROM me) AND EXISTS (SELECT 1 FROM msg)`,
			key,
			roomId,
			roomId,
		),
	);
	if (fileIds.length && IM_ROOM_FILE_TYPES.has(parsed.type)) {
		// A group's files are its folder in Drive (see room-files.ts); the first file is the message's own (not a video's thumbnail).
		add(
			withMe(
				`${inMessage} INSERT OR IGNORE INTO im_room_files (room_id, file_id, msg_id, uploader_id, file_name, content_type, size, msg_type, created_at)
				SELECT x.room_id, f.id, x.id, x.from_uid, COALESCE(?, f.file_name), f.content_type, f.size, x.type, x.created_at
				FROM msg x JOIN im_rooms r ON r.id = x.room_id AND r.type = ? JOIN im_files f ON f.id = ? AND f.uploaded_at IS NOT NULL AND f.size IS NOT NULL`,
				key,
				roomId,
				roomFileName(parsed.type, parsed.body as Record<string, unknown>, "") || null,
				IM_ROOM_TYPE.GROUP,
				parsed.fileIds[0],
			),
		);
	}
	const memberAt = add(
		withMe(
			` SELECT m.room_id, m.user_id, m.role, r.type AS room_type, r.owner_id
			FROM im_room_members m JOIN im_rooms r ON r.id = m.room_id WHERE m.room_id = ? AND m.user_id = (SELECT id FROM me)`,
			roomId,
		),
	);
	const filesAt = fileIds.length
		? add(db(env).prepare(`SELECT COUNT(*) AS count FROM im_files WHERE id IN (${fileIds.map(() => "?").join(", ")}) AND uploaded_at IS NOT NULL`).bind(...fileIds))
		: -1;
	const rowAt = add(withMe(` SELECT ${MESSAGE_COLUMNS} FROM im_messages x WHERE x.from_uid = ${ownRow}`, key));
	const replyAt = add(withMe(` SELECT ${MESSAGE_COLUMNS} FROM im_messages x WHERE x.id = (SELECT reply_msg_id FROM im_messages WHERE from_uid = ${ownRow})`, key));
	const usersAt = add(
		withMe(
			`, t AS (SELECT from_uid, recalled_by, reply_msg_id FROM im_messages WHERE from_uid = ${ownRow}),
			q AS (SELECT from_uid, recalled_by FROM im_messages WHERE id = (SELECT reply_msg_id FROM t))
			SELECT id, email, COALESCE(im_display_name, name) AS name, im_avatar AS imAvatar, avatar_key AS avatarKey FROM users WHERE id IN (SELECT from_uid FROM t UNION SELECT recalled_by FROM t UNION SELECT from_uid FROM q UNION SELECT recalled_by FROM q)`,
			key,
		),
	);
	const roomAt = add(withMe(` SELECT id, type FROM im_rooms WHERE id = (SELECT room_id FROM im_messages WHERE from_uid = ${ownRow})`, key));
	const recipientsAt = add(withMe(" SELECT user_id FROM im_room_members WHERE room_id = ? AND EXISTS (SELECT 1 FROM me)", roomId));

	const results = await db(env).batch(statements);
	const rows = <T>(at: number) => (results[at]?.results ?? []) as T[];
	if (authAt >= 0) {
		const auth = rows<{ expires_at: number; disabled: number; deleted_at: number | null }>(authAt)[0];
		if (!auth || auth.disabled || auth.deleted_at !== null) return { auth: "invalid" };
		if (auth.expires_at * 1000 <= now) return { auth: "expired" };
	}
	const membership = rows<MemberRow>(memberAt)[0];
	if (!membership) throw new ImChatError(403, "你不在该会话中");
	if (atAll && !(membership.room_type === IM_ROOM_TYPE.GROUP && isManager(membership))) throw new ImChatError(403, "只有群主和管理员可以@全体成员");
	if (filesAt >= 0 && Number(rows<{ count: number }>(filesAt)[0]?.count) < fileIds.length) throw new ImChatError(400, "文件未上传完成");
	const row = rows<ImMessageRow>(rowAt)[0];
	if (!row) throw new ImChatError(400, "消息发送失败");
	const users = new Map(rows<ImUserRow>(usersAt).map((user) => [user.id, user]));
	const replies = new Map(rows<ImMessageRow>(replyAt).map((reply) => [reply.id, reply]));
	const isGroup = rows<{ type: number }>(roomAt)[0]?.type === IM_ROOM_TYPE.GROUP;
	const message = toImMessage(row, { viewerUid: row.from_uid, isGroup, users, replies, avatarUrl: (user) => imAvatarUrl(user, origin) });
	// The sender's other devices get it too. The client that sent it already shows it under its client id, which
	// rides along so that client can tell the copy apart from a new message (HuLa swaps the id when the send returns).
	if (clientMsgId) Object.assign(message.message, { clientMsgId });
	return { message, recipients: rows<{ user_id: string }>(recipientsAt).map((member) => member.user_id) };
}

/** A send refused before it reached the database still answers in the old order: sign-in, membership, the message. */
async function refuseSend(env: Env, sender: ImSender, roomId: unknown, error: ImChatError | ParsedSend): Promise<ImSendRefusal> {
	let userId: string;
	if ("token" in sender) {
		const auth = await resolveImAccessToken(env, sender.token);
		if (auth.status !== "ok") return { auth: auth.status };
		userId = auth.user.id;
	} else {
		userId = sender.userId;
	}
	await requireMember(env, roomId, userId);
	throw error instanceof ImChatError ? error : new ImChatError(400, "缺少会话");
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

/**
 * Posts a file message the sender's client did not upload itself (a Drive file sent from the picker), so the sender
 * is among the recipients too. The body must already point at an uploaded chat file.
 */
export async function postMediaMessage(env: Env, userId: string, roomId: unknown, type: number, body: Record<string, unknown>, origin: string): Promise<ImDelivery> {
	const member = await requireMember(env, roomId, userId);
	const media = parseMediaBody(type, body, (url) => imFileIdFromUrl(url, origin));
	if (!media) throw new ImChatError(400, "文件消息无效");
	await requireUploadedImFiles(env, media.fileIds);
	const row = await insertMessage(env, { roomId: member.room_id, fromUid: userId, clientMsgId: null, type, body: media.body, replyMsgId: null });
	if (member.room_type === IM_ROOM_TYPE.GROUP) await fileRoomMessage(env, row, media.body, media.fileIds[0]);
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
	await unfileRoomMessage(env, row.id);
	return { event: { msgId: String(row.id), roomId: row.room_id, recallUid: userId }, recipients: await roomMemberIds(env, row.room_id) };
}

/** Message types whose file can be deleted from the chat (an emoji's picture is not the sender's to take back). */
const DELETABLE_FILE_TYPES: ReadonlySet<number> = new Set([IM_MSG_TYPE.IMAGE, IM_MSG_TYPE.FILE, IM_MSG_TYPE.VOICE, IM_MSG_TYPE.VIDEO]);

/**
 * Deletes the file a message carries: the object leaves the bucket (unless a forwarded copy still points at it),
 * the group's file list drops it, and the message becomes a notice saying who deleted what. The sender may do
 * this at any time, and in a group so may its owner and admins. A recalled message keeps its recall notice.
 */
export async function deleteMessageFile(env: Env, user: ImUserRow, input: { msgId?: unknown; roomId?: unknown }, origin: string) {
	const member = await requireMember(env, input.roomId, user.id);
	const msgId = parseImMessageId(input.msgId);
	const row = msgId === null
		? null
		: await db(env).prepare(`SELECT ${MESSAGE_COLUMNS} FROM im_messages x WHERE x.id = ? AND x.room_id = ?`).bind(msgId, member.room_id).first<ImMessageRow>();
	if (!row) throw new ImChatError(404, "消息不存在");
	if (!DELETABLE_FILE_TYPES.has(row.type)) throw new ImChatError(400, "该消息没有可删除的文件");
	const canModerate = member.room_type === IM_ROOM_TYPE.GROUP && isManager(member);
	if (row.from_uid !== user.id && !canModerate) throw new ImChatError(403, "只有发送者、群主和管理员可以删除文件");
	const stored = parseMediaBody(row.type, JSON.parse(row.body), (url) => imFileIdFromUrl(url, origin));
	await deleteImFilesUnlessShared(env, stored?.fileIds ?? [], row.id);
	const notice = deletedFileNotice(imUserName(user), row.type, stored?.body ?? {});
	await db(env).batch([
		...(row.recalled_by
			? []
			: [db(env).prepare("UPDATE im_messages SET type = ?, body = ? WHERE id = ?").bind(IM_MSG_TYPE.SYSTEM, JSON.stringify(notice), row.id)]),
		db(env).prepare("UPDATE im_room_files SET removed_at = ? WHERE msg_id = ? AND removed_at IS NULL").bind(Date.now(), row.id),
	]);
	const updated = await db(env).prepare(`SELECT ${MESSAGE_COLUMNS} FROM im_messages x WHERE x.id = ?`).bind(row.id).first<ImMessageRow>();
	const [message] = await renderMessages(env, user.id, updated ? [updated] : [], origin);
	return { event: { msgId: String(row.id), roomId: row.room_id, message }, recipients: await roomMemberIds(env, row.room_id) };
}

// Groups ---------------------------------------------------------------------

async function activeUsers(env: Env, uids: unknown, excluding: string): Promise<ImUserRow[]> {
	const ids = Array.isArray(uids) ? [...new Set(uids.filter((uid): uid is string => typeof uid === "string" && uid !== excluding))] : [];
	if (ids.length > IM_GROUP_MEMBER_LIMIT) throw new ImChatError(400, `群成员不能超过${IM_GROUP_MEMBER_LIMIT}人`);
	return selectIn<ImUserRow>(env, (placeholders) => `SELECT u.id, u.email, COALESCE(u.im_display_name, u.name) AS name, u.im_avatar AS imAvatar, u.avatar_key AS avatarKey FROM users u WHERE ${ACTIVE_USER} AND u.id IN (${placeholders})`, ids);
}

async function userName(env: Env, userId: string): Promise<string> {
	return imUserName(await db(env).prepare("SELECT COALESCE(im_display_name, name) AS name, email FROM users WHERE id = ?").bind(userId).first<{ name: string; email: string }>());
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

/** HuLa's `memberChange` push: who joined or left, and the group's new head counts. */
async function pushMemberChange(env: Env, roomId: string, changeType: number, changed: string[], alsoTell: string[], origin: string): Promise<void> {
	const rows = await selectIn<PersonRow>(
		env,
		(placeholders) => `SELECT ${PERSON_COLUMNS}, COALESCE(m.role, ${IM_ROLE.MEMBER}) AS role, COALESCE(m.my_name, '') AS my_name, m.created_at
			FROM users u LEFT JOIN im_presence p ON p.user_id = u.id LEFT JOIN im_room_members m ON m.room_id = ? AND m.user_id = u.id
			WHERE u.id IN (${placeholders})`,
		changed,
		roomId,
	);
	const counts = await db(env)
		.prepare(
			`SELECT COUNT(*) AS total, SUM(CASE WHEN p.online = 1 AND u.im_state_id != '5' THEN 1 ELSE 0 END) AS online
			FROM im_room_members m JOIN users u ON u.id = m.user_id LEFT JOIN im_presence p ON p.user_id = m.user_id
			WHERE m.room_id = ? AND ${ACTIVE_USER}`,
		)
		.bind(roomId)
		.first<{ total: number; online: number | null }>();
	const userList = rows.map((row) => ({ ...toPerson(row, origin), roomId, roleId: row.role ?? IM_ROLE.MEMBER, myName: row.my_name ?? "" }));
	await notifyImUsers(env, [...(await roomMemberIds(env, roomId)), ...alsoTell], {
		type: "memberChange",
		data: { roomId, changeType, userList, totalNum: Number(counts?.total ?? 0), onlineNum: Number(counts?.online ?? 0) },
	});
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
	await pushMemberChange(env, member.room_id, IM_MEMBER_CHANGE.JOIN, invitees.map((user) => user.id), [], origin);
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
	const removedIds = removable.map((row) => row.user_id);
	const removed = await activeUsers(env, removedIds, userId);
	await db(env).batch(
		removedIds.map((uid) => db(env).prepare("DELETE FROM im_room_members WHERE room_id = ? AND user_id = ?").bind(member.room_id, uid)),
	);
	// The removed are told too, so their clients drop the group.
	await pushMemberChange(env, member.room_id, IM_MEMBER_CHANGE.REMOVE, removedIds, removedIds, origin);
	return postSystemMessage(env, member.room_id, userId, `${await userName(env, userId)}将${namesOf(removed)}移出了群聊`, origin);
}

/**
 * Leaving a group. Its owner cannot simply leave: they hand the group to someone else first, or dissolve it
 * (`dissolve`), which removes it for everyone. The last one out deletes the group.
 */
export async function exitGroup(env: Env, userId: string, input: { roomId?: unknown; dissolve?: unknown }, origin: string): Promise<ImDelivery | null> {
	const member = await requireGroupMember(env, input.roomId, userId);
	refuseDirectoryChange(member.room_id);
	const others = (await roomMemberIds(env, member.room_id)).filter((uid) => uid !== userId);
	if (member.role === IM_ROLE.OWNER && others.length) {
		if (input.dissolve !== true) throw new ImChatError(400, "群主需先转让群主才能退出群聊，或选择解散群聊");
		await dissolveGroup(env, member.room_id, [userId, ...others]);
		return null;
	}
	if (input.dissolve === true) throw new ImChatError(403, "只有群主可以解散群聊");
	if (!others.length) {
		await db(env).prepare("DELETE FROM im_rooms WHERE id = ?").bind(member.room_id).run();
		return null;
	}
	const name = await userName(env, userId);
	await db(env).prepare("DELETE FROM im_room_members WHERE room_id = ? AND user_id = ?").bind(member.room_id, userId).run();
	await pushMemberChange(env, member.room_id, IM_MEMBER_CHANGE.EXIT, [userId], [userId], origin);
	return postSystemMessage(env, member.room_id, others[0], `${name}退出了群聊`, origin);
}

/** Deletes a group with its messages and files list, and tells every member's clients to drop it. */
async function dissolveGroup(env: Env, roomId: string, memberIds: string[]): Promise<void> {
	await db(env).prepare("DELETE FROM im_rooms WHERE id = ?").bind(roomId).run();
	await notifyImUsers(env, memberIds, { type: "roomDissolution", data: roomId });
}

/** Whether the caller may dissolve the group: its owner, for the handler to tidy up before `exitGroup` deletes it. */
export async function isGroupOwner(env: Env, roomId: unknown, userId: string): Promise<boolean> {
	if (typeof roomId !== "string" || !roomId) return false;
	const member = await findMember(env, roomId, userId);
	return member?.room_type === IM_ROOM_TYPE.GROUP && member.role === IM_ROLE.OWNER;
}

/** Role changes reach every member as HuLa's `groupSetAdmin`; `roles` carries exact roles where admin/not admin does not say enough. */
async function pushRoleChange(env: Env, roomId: string, uids: string[], status: boolean, roles?: Record<string, number>): Promise<void> {
	await notifyImUsers(env, await roomMemberIds(env, roomId), { type: "groupSetAdmin", data: { roomId, uids, status, ...(roles ? { roles } : {}) } });
}

export async function setAdmins(env: Env, userId: string, input: { roomId?: unknown; uidList?: unknown }, admin: boolean, origin: string): Promise<ImDelivery | null> {
	const member = await requireGroupMember(env, input.roomId, userId);
	refuseDirectoryChange(member.room_id);
	if (member.role !== IM_ROLE.OWNER) throw new ImChatError(403, "只有群主可以设置管理员");
	const targets = Array.isArray(input.uidList) ? input.uidList.filter((uid): uid is string => typeof uid === "string" && uid !== userId) : [];
	if (!targets.length) throw new ImChatError(400, "请选择成员");
	const from = admin ? IM_ROLE.MEMBER : IM_ROLE.ADMIN;
	const changing = (
		await selectIn<{ user_id: string }>(
			env,
			(placeholders) => `SELECT user_id FROM im_room_members WHERE room_id = ? AND role = ? AND user_id IN (${placeholders})`,
			targets,
			member.room_id,
			from,
		)
	).map((row) => row.user_id);
	if (!changing.length) return null;
	await db(env).batch(
		changing.map((uid) =>
			db(env).prepare("UPDATE im_room_members SET role = ? WHERE room_id = ? AND user_id = ? AND role = ?").bind(admin ? IM_ROLE.ADMIN : IM_ROLE.MEMBER, member.room_id, uid, from),
		),
	);
	await pushRoleChange(env, member.room_id, changing, admin);
	const names = namesOf(await activeUsers(env, changing, userId));
	const actor = await userName(env, userId);
	return postSystemMessage(env, member.room_id, userId, admin ? `${actor}将${names}设为管理员` : `${actor}取消了${names}的管理员身份`, origin);
}

/** The owner hands the group to another member and becomes a plain member. */
export async function transferGroupOwner(env: Env, userId: string, input: { roomId?: unknown; uid?: unknown }, origin: string): Promise<ImDelivery> {
	const member = await requireGroupMember(env, input.roomId, userId);
	refuseDirectoryChange(member.room_id);
	if (member.role !== IM_ROLE.OWNER) throw new ImChatError(403, "只有群主可以转让群主");
	const target = typeof input.uid === "string" && input.uid !== userId ? await findMember(env, member.room_id, input.uid) : null;
	const [successor] = target ? await activeUsers(env, [target.user_id], userId) : [];
	if (!target || !successor) throw new ImChatError(400, "请选择一位群成员");
	await db(env).batch([
		db(env).prepare("UPDATE im_room_members SET role = ? WHERE room_id = ? AND user_id = ?").bind(IM_ROLE.OWNER, member.room_id, successor.id),
		db(env).prepare("UPDATE im_room_members SET role = ? WHERE room_id = ? AND user_id = ?").bind(IM_ROLE.MEMBER, member.room_id, userId),
		db(env).prepare("UPDATE im_rooms SET owner_id = ? WHERE id = ?").bind(successor.id, member.room_id),
	]);
	// `uids`/`status` alone already turns the old owner into a member on clients that do not read `roles`.
	await pushRoleChange(env, member.room_id, [userId], false, { [successor.id]: IM_ROLE.OWNER, [userId]: IM_ROLE.MEMBER });
	return postSystemMessage(env, member.room_id, userId, `${await userName(env, userId)}将群主转让给了${imUserName(successor)}`, origin);
}

/**
 * Renames a group or changes its picture; owners and admins only. Every member's clients update at once
 * (`roomInfoChange`), and a rename or new picture is announced in the group.
 */
export async function updateRoomInfo(env: Env, userId: string, input: { id?: unknown; name?: unknown; avatar?: unknown }, origin: string) {
	const member = await requireGroupMember(env, input.id, userId);
	refuseDirectoryChange(member.room_id);
	if (!isManager(member)) throw new ImChatError(403, "只有群主和管理员可以修改群资料");
	const room = await db(env).prepare("SELECT id, name, avatar FROM im_rooms WHERE id = ?").bind(member.room_id).first<{ id: string; name: string; avatar: string }>();
	if (!room) throw new ImChatError(404, "群聊不存在");
	const name = typeof input.name === "string" ? input.name.trim() : undefined;
	if (name !== undefined && (!name || name.length > IM_GROUP_NAME_LIMIT)) throw new ImChatError(400, `群名称需为1到${IM_GROUP_NAME_LIMIT}个字`);
	const avatar = parseRoomAvatar(input.avatar, room, origin);
	const renamed = name !== undefined && name !== room.name;
	const repictured = avatar !== undefined && avatar !== room.avatar;
	if (!renamed && !repictured) return null;
	await db(env)
		.prepare("UPDATE im_rooms SET name = ?, avatar = ? WHERE id = ?")
		.bind(renamed ? name : room.name, repictured ? avatar : room.avatar, member.room_id)
		.run();
	const updated = { id: room.id, name: renamed ? (name as string) : room.name, avatar: repictured ? (avatar as string) : room.avatar };
	await notifyImUsers(env, await roomMemberIds(env, member.room_id), {
		type: "roomInfoChange",
		data: { roomId: room.id, name: updated.name, avatar: imRoomAvatarUrl(updated, origin) },
	});
	const actor = await userName(env, userId);
	return postSystemMessage(env, member.room_id, userId, renamed ? `${actor}将群名称修改为“${updated.name}”` : `${actor}修改了群头像`, origin);
}

/**
 * A new group picture: one of our chat files, or any https image; "" or the generated picture's own URL (which
 * clients send back unchanged with a rename) mean the generated one. Undefined leaves the picture alone.
 */
function parseRoomAvatar(value: unknown, room: { id: string; avatar: string }, origin: string): string | undefined {
	if (typeof value !== "string") return undefined;
	const avatar = value.trim();
	if (avatar === room.avatar) return undefined;
	if (!avatar || avatar === imRoomAvatarUrl({ id: room.id, avatar: "" }, origin)) return "";
	if (imFileIdFromUrl(avatar, origin) || /^https:\/\/\S{1,500}$/.test(avatar)) return avatar;
	throw new ImChatError(400, "群头像地址无效");
}

/** Posts a group announcement's card (HuLa's NOTICE message) as its author; everyone in the group gets it. */
export async function postNoticeMessage(env: Env, roomId: string, userId: string, body: Record<string, unknown>, origin: string): Promise<ImDelivery> {
	const row = await insertMessage(env, { roomId, fromUid: userId, clientMsgId: null, type: IM_MSG_TYPE.NOTICE, body, replyMsgId: null });
	const [message] = await renderMessages(env, userId, [row], origin);
	return { message, recipients: await roomMemberIds(env, roomId) };
}

/** HuLa's `GroupDetailReq`. */
export async function groupDetail(env: Env, userId: string, roomId: unknown, origin: string) {
	const member = await requireGroupMember(env, roomId, userId);
	const row = await db(env)
		.prepare(
			`SELECT r.id, r.name, r.avatar, m.my_name, m.remark,
				(SELECT COUNT(*) FROM im_room_members c JOIN users u ON u.id = c.user_id WHERE c.room_id = r.id AND ${ACTIVE_USER}) AS member_count,
				(SELECT COUNT(*) FROM im_room_members c JOIN users u ON u.id = c.user_id JOIN im_presence p ON p.user_id = c.user_id AND p.online = 1 WHERE c.room_id = r.id AND u.im_state_id != '5' AND ${ACTIVE_USER}) AS online_count
			FROM im_rooms r JOIN im_room_members m ON m.room_id = r.id AND m.user_id = ? WHERE r.id = ?`,
		)
		.bind(userId, member.room_id)
		.first<{ id: string; name: string; avatar: string; my_name: string; remark: string; member_count: number; online_count: number }>();
	if (!row) throw new ImChatError(404, "群聊不存在");
	return {
		roomId: row.id,
		groupName: row.name,
		avatar: imRoomAvatarUrl(row, origin),
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
export async function listGroups(env: Env, userId: string, origin: string) {
	await ensureAllStaffRoom(env);
	const result = await db(env)
		.prepare(
			`SELECT r.id, r.name, r.avatar, m.remark, m.my_name, m.role,
				(SELECT COUNT(*) FROM im_room_members c JOIN users u ON u.id = c.user_id WHERE c.room_id = r.id AND ${ACTIVE_USER}) AS member_count,
				(SELECT COUNT(*) FROM im_room_members c JOIN users u ON u.id = c.user_id JOIN im_presence p ON p.user_id = c.user_id AND p.online = 1 WHERE c.room_id = r.id AND u.im_state_id != '5' AND ${ACTIVE_USER}) AS online_count
			FROM im_room_members m JOIN im_rooms r ON r.id = m.room_id
			WHERE m.user_id = ? AND r.type = ? ORDER BY r.active_time DESC`,
		)
		.bind(userId, IM_ROOM_TYPE.GROUP)
		.all<{ id: string; name: string; avatar: string; remark: string; my_name: string; role: number; member_count: number; online_count: number }>();
	return result.results.map((row) => ({
		id: row.id, roomId: row.id, groupId: row.id, roomName: row.name, groupName: row.name,
		avatar: imRoomAvatarUrl(row, origin), account: row.id, remark: row.remark, myName: row.my_name,
		roleId: row.role, memberNum: Number(row.member_count), onlineNum: Number(row.online_count), allowScanEnter: false,
	}));
}
