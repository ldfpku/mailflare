/**
 * Pure helpers for the HuLa chat API: constants from HuLa's enums, body
 * validation, and the row-to-response shapes its client deserializes. Every id
 * leaves as a string, because the Rust side reads ids into `String` fields.
 */

/** The all-staff group. HuLa treats room "1" as the channel everyone is in, so it doubles as the directory. */
export const IM_ALL_STAFF_ROOM_ID = "1";
export const IM_ALL_STAFF_ROOM_NAME = "全员群";

export const IM_ROOM_TYPE = { GROUP: 1, SINGLE: 2 } as const;
export const IM_ROLE = { OWNER: 1, ADMIN: 2, MEMBER: 3 } as const;
/** The subset of HuLa's MsgEnum this server stores. */
export const IM_MSG_TYPE = { TEXT: 1, RECALL: 2, IMAGE: 3, FILE: 4, VOICE: 5, VIDEO: 6, EMOJI: 7, SYSTEM: 8, MAIL_CARD: 19 } as const;

/** Message types whose body points at an uploaded chat file. */
export const IM_MEDIA_TYPES: ReadonlySet<number> = new Set([IM_MSG_TYPE.IMAGE, IM_MSG_TYPE.FILE, IM_MSG_TYPE.VOICE, IM_MSG_TYPE.VIDEO, IM_MSG_TYPE.EMOJI]);
export const IM_ONLINE = 1;
export const IM_OFFLINE = 2;

export const IM_TEXT_LIMIT = 2000;
export const IM_AT_LIMIT = 200;
export const IM_RECALL_WINDOW_MS = 2 * 60 * 1000;
/** `msg/list` returns this many of the latest messages per room; older ones are not synced to clients. */
export const IM_SYNC_MESSAGES_PER_ROOM = 200;
export const IM_GROUP_NAME_LIMIT = 30;
export const IM_GROUP_MEMBER_LIMIT = 500;

export interface ImUserRow {
	id: string;
	email: string;
	name: string;
}

export interface ImMessageRow {
	id: number;
	room_id: string;
	from_uid: string;
	type: number;
	body: string;
	reply_msg_id: number | null;
	recalled_by: string | null;
	recalled_at: number | null;
	created_at: number;
}

export interface ImTextBody {
	content: string;
	atUidList?: string[];
}

/** One-to-one rooms are keyed by their two members, so opening a chat twice finds the same room. */
export function singleRoomKey(a: string, b: string): string {
	return [a, b].sort().join(" ");
}

/** Message ids are positive integers; anything else is not one of ours. */
export function parseImMessageId(value: unknown): number | null {
	const text = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : "";
	if (!/^[1-9]\d{0,15}$/.test(text)) return null;
	return Number(text);
}

/** Validates what HuLa sends for a text message and keeps only the fields the server stores. */
export function parseTextBody(body: unknown): ImTextBody | null {
	if (!body || typeof body !== "object") return null;
	const { content, atUidList } = body as { content?: unknown; atUidList?: unknown };
	if (typeof content !== "string" || !content.trim() || content.length > IM_TEXT_LIMIT) return null;
	const parsed: ImTextBody = { content };
	if (Array.isArray(atUidList)) {
		const uids = [...new Set(atUidList.filter((uid): uid is string => typeof uid === "string" && uid.length > 0))];
		if (uids.length) parsed.atUidList = uids.slice(0, IM_AT_LIMIT);
	}
	return parsed;
}

/** HuLa's composer can send inline HTML; previews and reply quotes show plain text. */
export function stripHtml(value: string): string {
	return value
		.replace(/<br\s*\/?>/gi, " ")
		.replace(/<[^>]*>/g, "")
		.replace(/&nbsp;/g, " ")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&amp;/g, "&")
		.replace(/\s+/g, " ")
		.trim();
}

const MEDIA_LABELS: Record<number, string> = {
	[IM_MSG_TYPE.IMAGE]: "[图片]",
	[IM_MSG_TYPE.FILE]: "[文件]",
	[IM_MSG_TYPE.VOICE]: "[语音]",
	[IM_MSG_TYPE.VIDEO]: "[视频]",
	[IM_MSG_TYPE.EMOJI]: "[表情]",
};

const finiteNumber = (value: unknown, max = Number.MAX_SAFE_INTEGER) => {
	const number = Number(value);
	return Number.isFinite(number) && number >= 0 ? Math.min(Math.round(number), max) : 0;
};

const shortText = (value: unknown, limit: number) => (typeof value === "string" ? value.trim().slice(0, limit) : "");

/**
 * Validates an image, file, voice, video or emoji body and keeps only the
 * fields HuLa renders. `fileIdOf` maps a URL to the chat file it names, or null
 * for anything that is not one of ours. Returns the body and the files it uses.
 */
export function parseMediaBody(
	type: number,
	body: unknown,
	fileIdOf: (url: unknown) => string | null,
): { body: Record<string, unknown>; fileIds: string[] } | null {
	if (!IM_MEDIA_TYPES.has(type) || !body || typeof body !== "object") return null;
	const input = body as Record<string, unknown>;
	const urlId = fileIdOf(input.url);
	if (!urlId) return null;
	const fileIds = [urlId];
	const size = finiteNumber(input.size);
	switch (type) {
		case IM_MSG_TYPE.IMAGE:
			return { body: { url: input.url, size, width: finiteNumber(input.width, 100000), height: finiteNumber(input.height, 100000) }, fileIds };
		case IM_MSG_TYPE.FILE:
			return { body: { url: input.url, size, fileName: shortText(input.fileName, 200) || "file" }, fileIds };
		case IM_MSG_TYPE.VOICE:
			return { body: { url: input.url, size, second: finiteNumber(input.second, 3600) }, fileIds };
		case IM_MSG_TYPE.VIDEO: {
			const parsed: Record<string, unknown> = { url: input.url, size, filename: shortText(input.filename, 200) };
			if (input.thumbUrl !== undefined && input.thumbUrl !== "") {
				const thumbId = fileIdOf(input.thumbUrl);
				if (!thumbId) return null;
				fileIds.push(thumbId);
				Object.assign(parsed, {
					thumbUrl: input.thumbUrl,
					thumbSize: finiteNumber(input.thumbSize),
					thumbWidth: finiteNumber(input.thumbWidth, 100000),
					thumbHeight: finiteNumber(input.thumbHeight, 100000),
				});
			}
			return { body: parsed, fileIds };
		}
		default:
			return { body: { url: input.url }, fileIds };
	}
}

/** The recall notice depends on who reads it, so it is written per viewer instead of stored. */
export function recallNotice(options: {
	viewerUid: string;
	senderUid: string;
	recallerUid: string;
	recallerName: string;
	senderName: string;
	isGroup: boolean;
}): string {
	const { viewerUid, senderUid, recallerUid, recallerName, senderName, isGroup } = options;
	if (recallerUid === viewerUid) return recallerUid === senderUid ? "你撤回了一条消息" : `你撤回了${senderName}的一条消息`;
	if (!isGroup) return "对方撤回了一条消息";
	return senderUid === viewerUid ? `${recallerName}撤回了你的一条消息` : `${recallerName}撤回了一条消息`;
}

/** What the stored body says, as one line of plain text. */
export function messageText(row: Pick<ImMessageRow, "type" | "body">): string {
	const body = parseStoredBody(row.body);
	if (row.type === IM_MSG_TYPE.SYSTEM) return typeof body === "string" ? body : "";
	if (row.type === IM_MSG_TYPE.FILE) {
		const name = body && typeof body === "object" ? (body as { fileName?: unknown }).fileName : null;
		return typeof name === "string" && name ? `[文件] ${name}` : "[文件]";
	}
	if (MEDIA_LABELS[row.type]) return MEDIA_LABELS[row.type];
	if (row.type === IM_MSG_TYPE.MAIL_CARD) {
		const subject = body && typeof body === "object" ? (body as { subject?: unknown }).subject : null;
		return typeof subject === "string" && subject ? `[邮件] ${subject}` : "[邮件]";
	}
	if (body && typeof body === "object" && typeof (body as { content?: unknown }).content === "string") {
		return stripHtml((body as { content: string }).content);
	}
	return "[消息]";
}

export function parseStoredBody(body: string): unknown {
	try {
		return JSON.parse(body);
	} catch {
		return null;
	}
}

/** The last-message line of a session: group text is prefixed with the sender's name, as HuLa renders it. */
export function sessionPreview(options: {
	row: Pick<ImMessageRow, "type" | "body" | "from_uid" | "recalled_by"> | null;
	viewerUid: string;
	senderName: string;
	recallerName: string;
	isGroup: boolean;
}): string {
	const { row, viewerUid, senderName, recallerName, isGroup } = options;
	if (!row) return "";
	if (row.recalled_by) {
		return recallNotice({ viewerUid, senderUid: row.from_uid, recallerUid: row.recalled_by, recallerName, senderName, isGroup });
	}
	const text = messageText(row);
	if (row.type === IM_MSG_TYPE.SYSTEM || !isGroup) return text;
	return `${senderName}:${text}`;
}

/** Longest search term the staff directory accepts; longer input is cut, not refused. */
export const DIRECTORY_SEARCH_KEY_LIMIT = 40;
/** Most people one directory search returns. */
export const DIRECTORY_SEARCH_LIMIT = 50;

/** The staff directory search term: trimmed, lower-cased (SQLite's `lower` only folds ASCII, as this does for Chinese). */
export function normalizeDirectoryKey(key: unknown): string {
	return typeof key === "string" ? key.trim().toLowerCase().slice(0, DIRECTORY_SEARCH_KEY_LIMIT) : "";
}

export function imUserName(user: Pick<ImUserRow, "name" | "email"> | null | undefined): string {
	if (!user) return "已删除用户";
	return user.name || user.email;
}

export interface ImMessageResponseContext {
	viewerUid: string;
	isGroup: boolean;
	users: Map<string, ImUserRow>;
	replies: Map<number, ImMessageRow>;
	avatarUrl: (user: ImUserRow) => string;
}

/** HuLa's `MessageType` (`MessageResp` on the Rust side). */
export function toImMessage(row: ImMessageRow, context: ImMessageResponseContext) {
	const sender = context.users.get(row.from_uid);
	const senderName = imUserName(sender);
	let type = row.type;
	let body: unknown = parseStoredBody(row.body);
	if (row.recalled_by) {
		type = IM_MSG_TYPE.RECALL;
		body = {
			content: recallNotice({
				viewerUid: context.viewerUid,
				senderUid: row.from_uid,
				recallerUid: row.recalled_by,
				recallerName: imUserName(context.users.get(row.recalled_by)),
				senderName,
				isGroup: context.isGroup,
			}),
		};
	} else if (row.type === IM_MSG_TYPE.TEXT && body && typeof body === "object") {
		const reply = row.reply_msg_id ? context.replies.get(row.reply_msg_id) : undefined;
		body = {
			...(body as ImTextBody),
			replyMsgId: row.reply_msg_id ? String(row.reply_msg_id) : undefined,
			urlContentMap: {},
			reply: reply
				? {
						id: String(reply.id),
						uid: reply.from_uid,
						username: imUserName(context.users.get(reply.from_uid)),
						type: reply.recalled_by ? IM_MSG_TYPE.RECALL : reply.type,
						body: reply.recalled_by ? "原消息已撤回" : messageText(reply),
						canCallback: reply.recalled_by ? 0 : 1,
						gapCount: 0,
					}
				: undefined,
		};
	}
	return {
		fromUser: { uid: row.from_uid, username: senderName, avatar: sender ? context.avatarUrl(sender) : "", locPlace: "" },
		message: {
			id: String(row.id),
			roomId: row.room_id,
			type,
			body,
			sendTime: row.created_at,
			messageMarks: {},
		},
		sendTime: row.created_at,
		createTime: row.created_at,
	};
}

export type ImMessageResponse = ReturnType<typeof toImMessage>;

/** What a file message turns into once its file is deleted (see `deleteMessageFile`). */
export function deletedFileNotice(deleterName: string, type: number, body: Record<string, unknown>): string {
	const name = (value: unknown) => (typeof value === "string" && value.trim() ? `「${value.trim()}」` : "");
	switch (type) {
		case IM_MSG_TYPE.FILE:
			return `${deleterName}删除了文件${name(body.fileName)}`;
		case IM_MSG_TYPE.VIDEO:
			return `${deleterName}删除了视频${name(body.filename)}`;
		case IM_MSG_TYPE.VOICE:
			return `${deleterName}删除了一条语音`;
		default:
			return `${deleterName}删除了一张图片`;
	}
}

/** Names for a new group without one: the first few members, the way chat apps title an ad-hoc group. */
export function defaultGroupName(names: string[]): string {
	const name = names.filter(Boolean).slice(0, 3).join("、");
	const full = names.length > 3 ? `${name}等` : name;
	return full.slice(0, IM_GROUP_NAME_LIMIT) || "群聊";
}

/** A refusal the handler turns into HuLa's envelope; `status` is one of its codes. */
export class ImChatError extends Error {
	constructor(
		readonly status: 400 | 403 | 404,
		message: string,
	) {
		super(message);
		this.name = "ImChatError";
	}
}
