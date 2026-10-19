import { and, eq, exists, gte, lt, not, or, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { messageAttachments, messages } from "@/db/schema";
import { buildFtsMatch, likeContains, parseSearchQuery, splitFreeTextTerms } from "./query-utils";

export interface SearchConditionOptions {
	/**
	 * Free-text terms this accepts are matched as substrings of the subject,
	 * sender and body instead of through the index. The unicode61 tokenizer
	 * keeps a run of Chinese characters as one token, so the index alone
	 * cannot find a Chinese word in the middle of a sentence.
	 */
	substringTerm?: (term: string) => boolean;
}

/**
 * Translate a search string into WHERE conditions on `messages`. Text goes to
 * the FTS5 index by rowid; everything else is a plain column predicate, so the
 * caller ANDs these with its own scope (mailbox access, folder, status).
 */
export function buildSearchConditions(raw: string, timeZone = "UTC", options: SearchConditionOptions = {}): SQL[] {
	let parsed = parseSearchQuery(raw, timeZone);
	const conditions: SQL[] = [];

	if (options.substringTerm) {
		const split = splitFreeTextTerms(parsed, options.substringTerm);
		parsed = split.parsed;
		for (const token of split.terms) {
			const pattern = likeContains(token.term);
			const like = (column: SQL) => sql`${column} LIKE ${pattern} ESCAPE '\\'`;
			const hit = or(
				like(sql`coalesce(${messages.subject}, '')`),
				like(sql`${messages.fromAddr}`),
				like(sql`coalesce(${messages.textBody}, ${messages.htmlBody}, '')`),
			)!;
			conditions.push(token.negate ? not(hit) : hit);
		}
	}

	const match = buildFtsMatch(parsed);
	if (match) {
		conditions.push(sql`${messages}.rowid IN (SELECT rowid FROM messages_fts WHERE messages_fts MATCH ${match})`);
	}
	if (parsed.hasAttachment) {
		conditions.push(
			exists(
				sql`(SELECT 1 FROM ${messageAttachments} WHERE ${messageAttachments.messageId} = ${messages.id} AND ${messageAttachments.disposition} = 'attachment')`,
			),
		);
	}
	if (parsed.read === "read") conditions.push(eq(messages.read, true));
	if (parsed.read === "unread") conditions.push(eq(messages.read, false));
	if (parsed.starred) conditions.push(eq(messages.starred, true));
	if (parsed.after) conditions.push(gte(messages.createdAt, parsed.after));
	if (parsed.before) conditions.push(lt(messages.createdAt, parsed.before));

	return conditions.length ? [and(...conditions)!] : [];
}
