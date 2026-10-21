import { IM_ALL_STAFF_ROOM_ID, ImChatError, parseImMessageId } from "./chat-utils";
import { postNoticeMessage, requireGroupRole, type ImDelivery } from "./chat";
import { notifyImUsers } from "./notify";
import {
	parseAnnouncementContent,
	parseAnnouncementPage,
	toImAnnouncement,
	IM_ANNOUNCEMENT_LIMIT,
	type ImAnnouncementRow,
} from "./announcements-utils";

/**
 * Group announcements (群公告). Members read them; a group's owner and admins publish, edit and delete them, and
 * in the all-staff group mailflare admins do. One announcement at a time can be pinned. Publishing posts the
 * announcement card into the group; every change tells the members' clients to reload the list.
 */
type Env = CloudflareEnv;

const SELECT = `SELECT a.id, a.room_id, a.uid, a.content, a.top, a.created_at, a.updated_at, u.name AS user_name, u.email AS user_email
	FROM im_room_announcements a LEFT JOIN users u ON u.id = a.uid`;

async function requireEditor(env: Env, roomId: unknown, userId: string): Promise<string> {
	const role = await requireGroupRole(env, roomId, userId);
	if (role.manager) return role.roomId;
	if (role.roomId === IM_ALL_STAFF_ROOM_ID) {
		const user = await env.DB.prepare("SELECT role FROM users WHERE id = ?").bind(userId).first<{ role: string }>();
		if (user?.role === "admin") return role.roomId;
	}
	throw new ImChatError(403, "只有群主和管理员可以管理群公告");
}

async function findAnnouncement(env: Env, id: unknown): Promise<ImAnnouncementRow> {
	const announcementId = parseImMessageId(id);
	const row = announcementId === null ? null : await env.DB.prepare(`${SELECT} WHERE a.id = ?`).bind(announcementId).first<ImAnnouncementRow>();
	if (!row) throw new ImChatError(404, "公告不存在");
	return row;
}

async function tellMembers(env: Env, roomId: string, type: "roomGroupNoticeMsg" | "roomEditGroupNoticeMsg", id: number): Promise<void> {
	const members = await env.DB.prepare("SELECT user_id FROM im_room_members WHERE room_id = ?").bind(roomId).all<{ user_id: string }>();
	await notifyImUsers(env, members.results.map((row) => row.user_id), { type, data: { roomId, id: String(id) } });
}

function parseContent(value: unknown): string {
	const content = parseAnnouncementContent(value);
	if (!content) throw new ImChatError(400, `公告内容需为1到${IM_ANNOUNCEMENT_LIMIT}个字`);
	return content;
}

/** The pinned one first, then newest first, in HuLa's `{ records, total, size, current, pages }` page. */
export async function listAnnouncements(env: Env, userId: string, roomId: unknown, current: unknown, size: unknown) {
	const role = await requireGroupRole(env, roomId, userId);
	const page = parseAnnouncementPage(current, size);
	const [rows, count] = await Promise.all([
		env.DB.prepare(`${SELECT} WHERE a.room_id = ? ORDER BY a.top DESC, a.id DESC LIMIT ? OFFSET ?`)
			.bind(role.roomId, page.size, (page.page - 1) * page.size)
			.all<ImAnnouncementRow>(),
		env.DB.prepare("SELECT COUNT(*) AS total FROM im_room_announcements WHERE room_id = ?").bind(role.roomId).first<{ total: number }>(),
	]);
	const total = Number(count?.total ?? 0);
	return {
		records: rows.results.map(toImAnnouncement),
		total: String(total),
		size: String(page.size),
		current: String(page.page),
		pages: String(Math.ceil(total / page.size)),
	};
}

export async function getAnnouncement(env: Env, userId: string, roomId: unknown, id: unknown) {
	const role = await requireGroupRole(env, roomId, userId);
	const row = await findAnnouncement(env, id);
	if (row.room_id !== role.roomId) throw new ImChatError(404, "公告不存在");
	return toImAnnouncement(row);
}

export async function publishAnnouncement(
	env: Env,
	userId: string,
	input: { roomId?: unknown; content?: unknown; top?: unknown },
	origin: string,
): Promise<{ announcement: ReturnType<typeof toImAnnouncement>; delivery: ImDelivery }> {
	const roomId = await requireEditor(env, input.roomId, userId);
	const content = parseContent(input.content);
	const top = input.top === true;
	const now = Date.now();
	const statements = [
		...(top ? [env.DB.prepare("UPDATE im_room_announcements SET top = 0 WHERE room_id = ? AND top = 1").bind(roomId)] : []),
		env.DB.prepare("INSERT INTO im_room_announcements (room_id, uid, content, top, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) RETURNING id")
			.bind(roomId, userId, content, Number(top), now, now),
	];
	const results = await env.DB.batch<{ id: number }>(statements);
	const id = results[results.length - 1].results[0]?.id;
	if (!id) throw new ImChatError(400, "公告发布失败");
	const announcement = toImAnnouncement(await findAnnouncement(env, id));
	const delivery = await postNoticeMessage(env, roomId, userId, announcement, origin);
	await tellMembers(env, roomId, "roomGroupNoticeMsg", id);
	return { announcement, delivery };
}

export async function editAnnouncement(env: Env, userId: string, input: { id?: unknown; roomId?: unknown; content?: unknown; top?: unknown }) {
	const row = await findAnnouncement(env, input.id);
	const roomId = await requireEditor(env, row.room_id, userId);
	const content = input.content === undefined ? row.content : parseContent(input.content);
	const top = input.top === undefined ? Boolean(row.top) : input.top === true;
	await env.DB.batch([
		...(top ? [env.DB.prepare("UPDATE im_room_announcements SET top = 0 WHERE room_id = ? AND top = 1 AND id <> ?").bind(roomId, row.id)] : []),
		env.DB.prepare("UPDATE im_room_announcements SET content = ?, top = ?, updated_at = ? WHERE id = ?").bind(content, Number(top), Date.now(), row.id),
	]);
	await tellMembers(env, roomId, "roomEditGroupNoticeMsg", row.id);
	return toImAnnouncement(await findAnnouncement(env, row.id));
}

export async function deleteAnnouncement(env: Env, userId: string, id: unknown): Promise<void> {
	const row = await findAnnouncement(env, id);
	const roomId = await requireEditor(env, row.room_id, userId);
	await env.DB.prepare("DELETE FROM im_room_announcements WHERE id = ?").bind(row.id).run();
	await tellMembers(env, roomId, "roomEditGroupNoticeMsg", row.id);
}
