import { IM_MSG_TYPE, parseImMessageId } from "./chat-utils";
import { buildChatTextQuery } from "./search-utils";

/**
 * Pure helpers for `GET im/chat/msg/history`, the server-side history the web
 * client's chat history and file windows read. The desktop app answers those
 * windows from its own SQLite; the browser has no local copy, so it asks here.
 */

export const IM_HISTORY_PAGE_SIZE = 50;
export const IM_HISTORY_PAGE_SIZE_LIMIT = 100;
const KEYWORD_LIMIT = 100;
const ID_LIMIT = 64;

/** The kinds HuLa's history windows filter by, as stored message types. */
export const IM_HISTORY_KINDS: Record<string, readonly number[]> = {
	image: [IM_MSG_TYPE.IMAGE, IM_MSG_TYPE.VIDEO],
	file: [IM_MSG_TYPE.FILE],
	files: [IM_MSG_TYPE.FILE, IM_MSG_TYPE.VIDEO],
};

export interface ImHistoryParams {
	/** One room, or every room the user is in when null. */
	roomId: string | null;
	types: readonly number[];
	keyword: string;
	fromUid: string | null;
	start: number | null;
	end: number | null;
	/** Only messages older than this id. */
	before: number | null;
	size: number;
}

export function parseImHistoryParams(params: URLSearchParams): ImHistoryParams {
	const id = (name: string) => {
		const value = params.get(name)?.trim();
		return value && value.length <= ID_LIMIT ? value : null;
	};
	const time = (name: string) => {
		const value = Number(params.get(name));
		return params.get(name) && Number.isFinite(value) && value > 0 ? Math.floor(value) : null;
	};
	const size = Math.min(Math.max(Math.floor(Number(params.get("pageSize")) || IM_HISTORY_PAGE_SIZE), 1), IM_HISTORY_PAGE_SIZE_LIMIT);
	return {
		roomId: id("roomId"),
		types: IM_HISTORY_KINDS[params.get("kind") ?? ""] ?? [],
		keyword: (params.get("keyword") ?? "").replace(/\s+/g, " ").trim().slice(0, KEYWORD_LIMIT),
		fromUid: id("fromUid"),
		start: time("startTime"),
		end: time("endTime"),
		before: parseImMessageId(params.get("cursor")),
		size,
	};
}

/**
 * WHERE clause over `im_messages x` for the filters, without the membership
 * join, which the caller adds. Recalled messages are left out: their content is gone.
 */
export function buildHistoryWhere(params: ImHistoryParams): { where: string; binds: (string | number)[] } {
	const where = ["x.recalled_by IS NULL"];
	const binds: (string | number)[] = [];
	if (params.roomId) {
		where.push("x.room_id = ?");
		binds.push(params.roomId);
	}
	if (params.types.length) where.push(`x.type IN (${params.types.map(Number).join(", ")})`);
	if (params.fromUid) {
		where.push("x.from_uid = ?");
		binds.push(params.fromUid);
	}
	if (params.start !== null) {
		where.push("x.created_at >= ?");
		binds.push(params.start);
	}
	if (params.end !== null) {
		where.push("x.created_at <= ?");
		binds.push(params.end);
	}
	if (params.before !== null) {
		where.push("x.id < ?");
		binds.push(params.before);
	}
	const query = params.keyword ? buildChatTextQuery(params.keyword) : null;
	if (query) {
		const fts: string[] = [];
		if (query.match) {
			fts.push("im_messages_fts MATCH ?");
			binds.push(query.match);
		}
		for (const term of query.contains) {
			fts.push("instr(lower(text), ?) > 0");
			binds.push(term);
		}
		for (const term of query.excludes) {
			fts.push("instr(lower(text), ?) = 0");
			binds.push(term);
		}
		where.push(`x.id IN (SELECT rowid FROM im_messages_fts WHERE ${fts.join(" AND ")})`);
	} else if (params.keyword) {
		// Only excluded words: nothing to look for.
		where.push("0");
	}
	return { where: where.join(" AND "), binds };
}
