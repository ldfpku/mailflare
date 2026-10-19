import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { driveItems } from "@/db/schema";
import { getDriveChain, getDriveItem, getDriveRole } from "@/lib/drive/access";
import { streamDriveFile } from "@/lib/drive/content";
import { getDriveStorageLimit, getDriveStorageUsed } from "@/lib/drive/storage";
import type { DriveItemDto } from "@/lib/drive/types";
import { driveObjectKey, normalizeDriveName } from "@/lib/drive/utils";
import { newId } from "@/lib/ids";
import { isRoomMember, postMediaMessage, requireGroupRole, type ImDelivery } from "./chat";
import { IM_MSG_TYPE, IM_ROOM_TYPE, ImChatError } from "./chat-utils";
import { copyBucketObject, createImFileFromObject, findUploadedImFile } from "./files";
import { IM_FILE_LIMIT_BYTES, imFileUrl } from "./files-utils";
import {
	IM_ROOM_FILES_PAGE,
	IM_ROOM_FILES_PAGE_MAX,
	IM_ROOM_FILE_TYPES,
	parseRoomFileId,
	roomFileKeywordPattern,
	roomFileName,
	toImRoomFile,
	type ImRoomFileRow,
} from "./room-files-utils";

/**
 * Group files: every image, file and video sent into a group is filed in
 * `im_room_files` (migration 0073), which is the group's folder in Drive. The
 * list is read through room membership on every request, so members joining
 * see the whole folder and anyone who leaves or is removed loses it at once;
 * nothing has to be copied or re-shared when membership changes. Drive files
 * can be sent into a chat (copied into a new chat file) and group files saved
 * to one's own Drive.
 */
type Env = CloudflareEnv;

const FILE_SELECT = `SELECT f.id, f.room_id, f.file_id, f.msg_id, f.uploader_id, f.file_name, f.content_type, f.size, f.msg_type, f.created_at,
	u.name AS uploader_name, u.email AS uploader_email, i.file_name AS stored_name
	FROM im_room_files f LEFT JOIN users u ON u.id = f.uploader_id LEFT JOIN im_files i ON i.id = f.file_id`;

/** Files a newly stored group message, once per file it points at (a video's thumbnail is not filed). */
export async function fileRoomMessage(
	env: Env,
	message: { id: number; room_id: string; from_uid: string; type: number; created_at: number },
	body: Record<string, unknown>,
	fileId: string,
): Promise<void> {
	if (!IM_ROOM_FILE_TYPES.has(message.type)) return;
	const file = await findUploadedImFile(env, fileId);
	if (!file) return;
	await env.DB.prepare(
		`INSERT OR IGNORE INTO im_room_files (room_id, file_id, msg_id, uploader_id, file_name, content_type, size, msg_type, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
	)
		.bind(message.room_id, fileId, message.id, message.from_uid, roomFileName(message.type, body, file.fileName), file.contentType, file.size, message.type, message.created_at)
		.run();
}

/** A recalled message takes its files off the group's list. */
export async function unfileRoomMessage(env: Env, msgId: number): Promise<void> {
	await env.DB.prepare("UPDATE im_room_files SET removed_at = ? WHERE msg_id = ? AND removed_at IS NULL").bind(Date.now(), msgId).run();
}

/** A page of a group's files, newest first; `cursor` is the last id returned. */
export async function listRoomFiles(
	env: Env,
	userId: string,
	input: { roomId: unknown; cursor?: unknown; pageSize?: unknown; keyword?: unknown },
	origin: string,
) {
	const role = await requireGroupRole(env, input.roomId, userId);
	const before = parseRoomFileId(input.cursor) ?? Number.MAX_SAFE_INTEGER;
	const size = Math.min(Math.max(Number(input.pageSize) || IM_ROOM_FILES_PAGE, 1), IM_ROOM_FILES_PAGE_MAX);
	const pattern = roomFileKeywordPattern(input.keyword);
	const result = await env.DB.prepare(
		`${FILE_SELECT} WHERE f.room_id = ? AND f.removed_at IS NULL AND f.id < ?${pattern ? " AND f.file_name LIKE ? ESCAPE '\\'" : ""}
		ORDER BY f.id DESC LIMIT ?`,
	)
		.bind(...[role.roomId, before, ...(pattern ? [pattern] : []), size + 1])
		.all<ImRoomFileRow>();
	const rows = result.results.slice(0, size);
	const totals = await env.DB.prepare("SELECT COUNT(*) AS count, COALESCE(SUM(size), 0) AS bytes FROM im_room_files WHERE room_id = ? AND removed_at IS NULL")
		.bind(role.roomId)
		.first<{ count: number; bytes: number }>();
	return {
		list: rows.map((row) => toImRoomFile(row, { viewerUid: userId, manager: role.manager, url: imFileUrl(origin, row.file_id, row.stored_name ?? row.file_name) })),
		cursor: rows.length ? String(rows[rows.length - 1].id) : "",
		isLast: result.results.length <= size,
		total: Number(totals?.count ?? 0),
		totalSize: Number(totals?.bytes ?? 0),
	};
}

async function findRoomFile(env: Env, roomId: string, id: unknown): Promise<ImRoomFileRow> {
	const fileId = parseRoomFileId(id);
	const row = fileId === null ? null : await env.DB.prepare(`${FILE_SELECT} WHERE f.id = ? AND f.room_id = ? AND f.removed_at IS NULL`).bind(fileId, roomId).first<ImRoomFileRow>();
	if (!row) throw new ImChatError(404, "文件不存在或已被移除");
	return row;
}

/** Takes a file off the group's list; the message in the chat stays. Its sender and the group's managers may do this. */
export async function removeRoomFile(env: Env, userId: string, input: { roomId?: unknown; id?: unknown }): Promise<void> {
	const role = await requireGroupRole(env, input.roomId, userId);
	const row = await findRoomFile(env, role.roomId, input.id);
	if (row.uploader_id !== userId && !role.manager) throw new ImChatError(403, "只有发送者、群主和管理员可以移除群文件");
	await env.DB.prepare("UPDATE im_room_files SET removed_at = ? WHERE id = ?").bind(Date.now(), row.id).run();
}

/** Copies a group file into the top of the caller's own Drive. */
export async function saveRoomFileToDrive(env: Env, userId: string, input: { roomId?: unknown; id?: unknown }) {
	const role = await requireGroupRole(env, input.roomId, userId);
	const row = await findRoomFile(env, role.roomId, input.id);
	const file = await findUploadedImFile(env, row.file_id);
	if (!file) throw new ImChatError(404, "文件不存在");
	const db = getDb(env);
	const limit = await getDriveStorageLimit(env);
	if (limit !== null && (await getDriveStorageUsed(db, userId)) + file.size > limit) throw new ImChatError(400, "网盘空间不足");
	const id = newId("drv");
	const key = driveObjectKey(userId, id);
	const name = normalizeDriveName(row.file_name) ?? file.fileName;
	const size = await copyBucketObject(env, file.objectKey, key, file.contentType);
	const now = new Date();
	try {
		await db.insert(driveItems).values({ id, ownerId: userId, parentId: null, kind: "file", name, r2Key: key, size, contentType: file.contentType, createdAt: now, updatedAt: now });
	} catch (error) {
		await env.BUCKET.delete(key);
		throw error;
	}
	return { id, name, size };
}

/**
 * The caller's Drive for HuLa's picker: the top of My Drive, or a folder they can open (their own or shared with
 * them). Files still uploading or in the trash are left out.
 */
export async function listDriveForPicker(env: Env, userId: string, parentId: unknown) {
	const db = getDb(env);
	const visible = [isNull(driveItems.trashedAt), isNull(driveItems.uploadId)];
	let rows: (typeof driveItems.$inferSelect)[];
	let path: { id: string; name: string }[] = [];
	if (typeof parentId === "string" && parentId) {
		const folder = await getDriveItem(db, parentId);
		const role = folder?.kind === "folder" ? await getDriveRole(db, userId, folder) : null;
		if (!folder || !role) throw new ImChatError(404, "文件夹不存在");
		rows = await db.select().from(driveItems).where(and(eq(driveItems.parentId, folder.id), ...visible)).limit(1000);
		path = (await getDriveChain(db, folder)).map((item) => ({ id: item.id, name: item.name }));
	} else {
		rows = await db.select().from(driveItems).where(and(eq(driveItems.ownerId, userId), isNull(driveItems.parentId), ...visible)).limit(1000);
	}
	const items = rows
		.map((row) => ({
			id: row.id,
			kind: row.kind,
			name: row.name,
			size: row.size,
			contentType: row.contentType,
			updatedAt: row.updatedAt.getTime(),
			// A copy into a chat file is capped like an upload, by the Worker's request size.
			sendable: row.kind === "file" && row.size <= IM_FILE_LIMIT_BYTES,
		}))
		.sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name, "zh-CN", { numeric: true }) : a.kind === "folder" ? -1 : 1));
	return { items, path, limitBytes: IM_FILE_LIMIT_BYTES };
}

/**
 * Sends a Drive file the caller can open into a chat as a file message. The bytes are copied into a new chat file,
 * so the message keeps working if the Drive file is later moved, renamed or deleted.
 */
export async function sendDriveFileToRoom(
	env: Env,
	userId: string,
	input: { roomId?: unknown; driveItemId?: unknown },
	origin: string,
): Promise<ImDelivery> {
	// The membership check runs first so a non-member learns nothing about the Drive item.
	if (typeof input.roomId !== "string" || !input.roomId || !(await isRoomMember(env, input.roomId, userId))) throw new ImChatError(403, "你不在该会话中");
	const db = getDb(env);
	const item = typeof input.driveItemId === "string" && input.driveItemId ? await getDriveItem(db, input.driveItemId) : null;
	const role = item ? await getDriveRole(db, userId, item) : null;
	if (!item || !role || item.kind !== "file" || item.uploadId) throw new ImChatError(404, "网盘文件不存在");
	if (item.size > IM_FILE_LIMIT_BYTES) throw new ImChatError(400, "文件超过100MB，不能发到聊天");
	const file = await createImFileFromObject(env, userId, item.r2Key ?? driveObjectKey(item.ownerId, item.id), item.name, origin);
	return postMediaMessage(env, userId, input.roomId, IM_MSG_TYPE.FILE, { url: file.url, size: file.size, fileName: item.name }, origin);
}

// Drive's "Group files" view ------------------------------------------------

/** The caller's groups as folders in Drive, with how many files each holds. */
export async function listDriveGroupFolders(env: Env, userId: string): Promise<DriveItemDto[]> {
	const result = await env.DB.prepare(
		`SELECT r.id, r.name, r.active_time, COUNT(f.id) AS files, MAX(f.created_at) AS latest
		FROM im_room_members m JOIN im_rooms r ON r.id = m.room_id
		LEFT JOIN im_room_files f ON f.room_id = r.id AND f.removed_at IS NULL
		WHERE m.user_id = ? AND r.type = ? GROUP BY r.id ORDER BY COALESCE(MAX(f.created_at), 0) DESC, r.active_time DESC`,
	)
		.bind(userId, IM_ROOM_TYPE.GROUP)
		.all<{ id: string; name: string; active_time: number; files: number; latest: number | null }>();
	return result.results.map((row) => ({
		id: `room:${row.id}`,
		kind: "folder" as const,
		name: row.name,
		size: 0,
		contentType: "application/x-directory",
		parentId: null,
		ownerId: row.id,
		ownerName: "",
		ownerHasAvatar: false,
		role: "view" as const,
		shared: false,
		linkToken: null,
		trashedAt: null,
		updatedAt: new Date(row.latest ?? row.active_time).toISOString(),
		group: { roomId: row.id, roomName: row.name, fileCount: Number(row.files) },
	}));
}

/** One group's files as Drive items; throws 403 unless the caller is a member. */
export async function listDriveGroupFiles(env: Env, userId: string, roomId: unknown): Promise<{ items: DriveItemDto[]; roomName: string; roomId: string }> {
	const role = await requireGroupRole(env, roomId, userId);
	const room = await env.DB.prepare("SELECT name FROM im_rooms WHERE id = ?").bind(role.roomId).first<{ name: string }>();
	const result = await env.DB.prepare(`${FILE_SELECT} WHERE f.room_id = ? AND f.removed_at IS NULL ORDER BY f.id DESC LIMIT 1000`)
		.bind(role.roomId)
		.all<ImRoomFileRow>();
	const items = result.results.map((row) => ({
		id: `roomfile:${row.id}`,
		kind: "file" as const,
		name: row.file_name,
		size: row.size,
		contentType: row.content_type,
		parentId: null,
		ownerId: row.uploader_id,
		ownerName: row.uploader_name?.trim() || row.uploader_email || "",
		ownerHasAvatar: false,
		role: "view" as const,
		shared: false,
		linkToken: null,
		trashedAt: null,
		updatedAt: new Date(row.created_at).toISOString(),
		group: { roomId: row.room_id, roomName: room?.name ?? "", fileId: String(row.id), canRemove: role.manager || row.uploader_id === userId },
	}));
	return { items, roomName: room?.name ?? "", roomId: role.roomId };
}

/** Serves a group file to Drive's preview and download after checking membership, the way Drive serves its own files. */
export async function serveRoomFileForDrive(env: Env, request: Request, userId: string, roomId: string, id: string): Promise<Response> {
	if (!(await isRoomMember(env, roomId, userId))) return new Response("Not found", { status: 404 });
	const fileId = parseRoomFileId(id);
	const row = fileId === null
		? null
		: await env.DB.prepare("SELECT file_id, file_name, created_at FROM im_room_files WHERE id = ? AND room_id = ? AND removed_at IS NULL")
				.bind(fileId, roomId)
				.first<{ file_id: string; file_name: string; created_at: number }>();
	const file = row ? await findUploadedImFile(env, row.file_id) : null;
	if (!row || !file) return new Response("Not found", { status: 404 });
	const created = new Date(row.created_at);
	return streamDriveFile(
		env,
		request,
		{ id: `roomfile-${fileId}`, ownerId: roomId, parentId: null, kind: "file", name: row.file_name, r2Key: file.objectKey, size: file.size, contentType: file.contentType, uploadId: null, uploadPartSize: null, uploadFingerprint: null, linkToken: null, trashedAt: null, createdAt: created, updatedAt: created },
		new URL(request.url).searchParams.get("download") === "1",
	);
}
