import { IM_MSG_TYPE } from "./chat-utils";

/**
 * Pure helpers for group files (`room-files.ts`): which messages are filed, the
 * name a file is listed under and the shapes HuLa and Drive read.
 */

/** Images, files and videos sent into a group are filed; voice notes and stickers are not. */
export const IM_ROOM_FILE_TYPES: ReadonlySet<number> = new Set([IM_MSG_TYPE.IMAGE, IM_MSG_TYPE.FILE, IM_MSG_TYPE.VIDEO]);
export const IM_ROOM_FILES_PAGE = 50;
export const IM_ROOM_FILES_PAGE_MAX = 200;
export const IM_ROOM_FILES_KEYWORD_LIMIT = 100;

export interface ImRoomFileRow {
	id: number;
	room_id: string;
	file_id: string;
	msg_id: number | null;
	uploader_id: string;
	file_name: string;
	content_type: string;
	size: number;
	msg_type: number;
	created_at: number;
	uploader_name: string | null;
	uploader_email: string | null;
	/** The chat file's own name, which its URL carries; `file_name` is what the message called it. */
	stored_name: string | null;
}

/** The name a message's file is listed under: what the sender's client called it, else the uploaded name. */
export function roomFileName(type: number, body: Record<string, unknown>, uploadedName: string): string {
	const named = type === IM_MSG_TYPE.FILE ? body.fileName : type === IM_MSG_TYPE.VIDEO ? body.filename : null;
	return typeof named === "string" && named.trim() ? named.trim().slice(0, 200) : uploadedName;
}

/** A LIKE pattern matching the keyword anywhere, with `\` as the escape character. */
export function roomFileKeywordPattern(keyword: unknown): string | null {
	if (typeof keyword !== "string") return null;
	const trimmed = keyword.trim().slice(0, IM_ROOM_FILES_KEYWORD_LIMIT);
	return trimmed ? `%${trimmed.replace(/[\\%_]/g, "\\$&")}%` : null;
}

export function parseRoomFileId(value: unknown): number | null {
	const id = typeof value === "number" ? value : typeof value === "string" && /^\d{1,15}$/.test(value) ? Number(value) : NaN;
	return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/** One group file for HuLa; ids leave as strings like message ids. */
export function toImRoomFile(row: ImRoomFileRow, options: { viewerUid: string; manager: boolean; url: string }) {
	const name = row.uploader_name?.trim() || row.uploader_email || "";
	return {
		id: String(row.id),
		roomId: row.room_id,
		fileName: row.file_name,
		size: row.size,
		contentType: row.content_type,
		msgType: row.msg_type,
		msgId: row.msg_id === null ? null : String(row.msg_id),
		uploaderUid: row.uploader_id,
		uploaderName: name,
		createdAt: row.created_at,
		url: options.url,
		downloadUrl: `${options.url}?download=1`,
		canRemove: options.manager || row.uploader_id === options.viewerUid,
	};
}

export type ImRoomFile = ReturnType<typeof toImRoomFile>;
