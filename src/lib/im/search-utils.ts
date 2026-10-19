import { tokenizeSearchText } from "@/lib/search/query-utils";
import { IM_MSG_TYPE, parseStoredBody, stripHtml } from "./chat-utils";

/**
 * Pure helpers for the unified chat and mail search (`search.ts`). Chat text is
 * indexed by the trigram FTS5 table of migration 0072, which finds any
 * substring of three or more characters through MATCH; shorter terms (most
 * two-character Chinese words) are checked with `instr` on the same table.
 */

export const IM_SEARCH_SCOPES = ["all", "chat", "mail"] as const;
export type ImSearchScope = (typeof IM_SEARCH_SCOPES)[number];

export const IM_SEARCH_KEYWORD_LIMIT = 100;
export const IM_SEARCH_PAGE_SIZE = 20;
export const IM_SEARCH_PAGE_SIZE_LIMIT = 50;
/** Characters kept on each side of the first hit in a result's excerpt. */
const EXCERPT_CONTEXT = 30;
const EXCERPT_LIMIT = 120;
/** Trigram MATCH needs at least this many characters in a term. */
const TRIGRAM_MIN = 3;

export interface ImSearchParams {
	keyword: string;
	scope: ImSearchScope;
	roomId: string | null;
	mailboxId: string | null;
	page: number;
	size: number;
}

/** Reads the query string; returns null when there is nothing to search for. */
export function parseImSearchParams(params: URLSearchParams): ImSearchParams | null {
	const keyword = (params.get("keyword") ?? params.get("q") ?? "").replace(/\s+/g, " ").trim().slice(0, IM_SEARCH_KEYWORD_LIMIT);
	if (!keyword) return null;
	const rawScope = params.get("scope") ?? "all";
	const scope = (IM_SEARCH_SCOPES as readonly string[]).includes(rawScope) ? (rawScope as ImSearchScope) : "all";
	const id = (name: string) => {
		const value = params.get(name)?.trim();
		return value && value.length <= 64 ? value : null;
	};
	const page = Math.max(Math.floor(Number(params.get("page") ?? params.get("current")) || 1), 1);
	const size = Math.min(Math.max(Math.floor(Number(params.get("size")) || IM_SEARCH_PAGE_SIZE), 1), IM_SEARCH_PAGE_SIZE_LIMIT);
	return { keyword, scope, roomId: id("roomId"), mailboxId: id("mailboxId"), page, size };
}

export interface ChatTextQuery {
	/** FTS5 MATCH expression for the terms long enough for the trigram index, or null. */
	match: string | null;
	/** Lower-cased terms the text must contain, checked with `instr`. */
	contains: string[];
	/** Lower-cased terms the text must not contain. */
	excludes: string[];
	/** Terms to highlight, in the order typed. */
	highlights: string[];
}

/** FTS5 string literal: double quotes doubled, so input never alters the query grammar. */
function ftsString(value: string): string {
	return `"${value.replace(/"/g, '""')}"`;
}

/**
 * Splits the keyword into what the chat index can answer. Words are ANDed,
 * "quoted phrases" are kept whole, and a leading minus excludes a word.
 * Returns null when every word is excluded, since that alone matches nothing useful.
 */
export function buildChatTextQuery(keyword: string): ChatTextQuery | null {
	const matchTerms: string[] = [];
	const contains: string[] = [];
	const excludes: string[] = [];
	const highlights: string[] = [];
	for (const token of tokenizeSearchText(keyword)) {
		const term = token.term.trim();
		if (!term) continue;
		if (token.negate) {
			excludes.push(term.toLowerCase());
			continue;
		}
		highlights.push(term);
		if ([...term].length >= TRIGRAM_MIN) matchTerms.push(ftsString(term));
		else contains.push(term.toLowerCase());
	}
	if (highlights.length === 0) return null;
	return { match: matchTerms.length ? matchTerms.join(" AND ") : null, contains, excludes, highlights };
}

/** Han, kana and hangul: scripts the mail index (unicode61) keeps as one token per run, so prefix MATCH misses words inside it. */
export const CJK_RE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

/**
 * One line around the first hit, so a long message or mail shows why it matched.
 * Whitespace is collapsed; an ellipsis marks text cut on either side.
 */
export function searchExcerpt(text: string, terms: readonly string[]): string {
	const flat = text.replace(/\s+/g, " ").trim();
	const lower = flat.toLowerCase();
	let hit = -1;
	for (const term of terms) {
		const index = lower.indexOf(term.toLowerCase());
		if (index !== -1 && (hit === -1 || index < hit)) hit = index;
	}
	if (hit === -1 || flat.length <= EXCERPT_LIMIT) {
		return flat.length > EXCERPT_LIMIT ? `${flat.slice(0, EXCERPT_LIMIT)}…` : flat;
	}
	const start = Math.max(hit - EXCERPT_CONTEXT, 0);
	const end = Math.min(start + EXCERPT_LIMIT, flat.length);
	return `${start > 0 ? "…" : ""}${flat.slice(start, end)}${end < flat.length ? "…" : ""}`;
}

/**
 * The text the index should hold for a new message when it differs from what
 * the insert trigger took from the body: the composer may send inline HTML,
 * and SQLite cannot strip tags, so `insertMessage` replaces the trigger's copy.
 * Null when the trigger's copy is already right.
 */
export function imSearchTextOverride(type: number, body: string): string | null {
	if (type !== IM_MSG_TYPE.TEXT) return null;
	const parsed = parseStoredBody(body);
	const content = parsed && typeof parsed === "object" ? (parsed as { content?: unknown }).content : null;
	if (typeof content !== "string" || !/[<&]/.test(content)) return null;
	return stripHtml(content);
}
