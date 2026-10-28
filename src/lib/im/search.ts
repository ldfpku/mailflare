import { and, count, desc, inArray, notInArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { messages } from "@/db/schema";
import { getEmailAddress, getEmailDisplayName, splitEmailAddressList } from "@/lib/email/address";
import { buildSearchConditions } from "@/lib/search/conditions";
import { parseSearchQuery } from "@/lib/search/query-utils";
import { IM_ROOM_TYPE, imUserName, messageText, type ImMessageRow } from "./chat-utils";
import { CJK_RE, buildChatTextQuery, searchExcerpt, type ImSearchParams } from "./search-utils";
import type { ImUser } from "./tokens";
import { imAvatarUrl, imRoomAvatarUrl } from "./users-utils";

/**
 * One search box over chat and mail (`GET im/search`). Chat results come from
 * the rooms the user is a member of, through the trigram index of migration
 * 0072; mail results from the mailboxes they own or were given (the set the
 * mail button counts), through the mail index plus substring matching for
 * Chinese words. Group addresses are left out of mail: their mail is in the
 * group chat as cards, which the chat side finds.
 */
type Env = CloudflareEnv;

/** Mail in these folders is not searched; templates are never listed anywhere. */
const HIDDEN_MAIL_STATUSES = ["template", "trash", "spam"];

interface ChatHitRow extends ImMessageRow {
	room_type: number;
	room_name: string;
	room_avatar: string;
	peer_id: string | null;
	peer_name: string | null;
	peer_email: string | null;
	peer_avatar: string | null;
	peer_avatar_key: string | null;
	sender_name: string | null;
	sender_email: string | null;
	sender_avatar: string | null;
	sender_avatar_key: string | null;
}

export interface ImSearchSection<T> {
	list: T[];
	total: number;
	isLast: boolean;
}

export async function searchImAndMail(env: Env, user: ImUser, params: ImSearchParams, origin: string) {
	const [chat, mail] = await Promise.all([
		params.scope === "mail" ? null : searchChat(env, user.id, params, origin),
		params.scope === "chat" ? null : searchMail(env, user, params),
	]);
	return { keyword: params.keyword, page: params.page, size: params.size, chat, mail };
}

async function searchChat(env: Env, userId: string, params: ImSearchParams, origin: string) {
	const empty = { list: [], total: 0, isLast: true };
	const query = buildChatTextQuery(params.keyword);
	if (!query) return empty;

	const ftsWhere: string[] = [];
	const ftsBinds: string[] = [];
	if (query.match) {
		ftsWhere.push("im_messages_fts MATCH ?");
		ftsBinds.push(query.match);
	}
	for (const term of query.contains) {
		ftsWhere.push("instr(lower(text), ?) > 0");
		ftsBinds.push(term);
	}
	for (const term of query.excludes) {
		ftsWhere.push("instr(lower(text), ?) = 0");
		ftsBinds.push(term);
	}
	const where = [
		"x.recalled_by IS NULL",
		`x.id IN (SELECT rowid FROM im_messages_fts WHERE ${ftsWhere.join(" AND ")})`,
		...(params.roomId ? ["x.room_id = ?"] : []),
	].join(" AND ");
	const binds = [userId, ...ftsBinds, ...(params.roomId ? [params.roomId] : [])];
	// Membership is the access check, as for every chat read.
	const from = "FROM im_messages x JOIN im_room_members m ON m.room_id = x.room_id AND m.user_id = ?";

	const [totalResult, pageResult] = await env.DB.batch<{ total: number } | ChatHitRow>([
		env.DB.prepare(`SELECT COUNT(*) AS total ${from} WHERE ${where}`).bind(...binds),
		env.DB.prepare(
			`SELECT x.id, x.room_id, x.from_uid, x.type, x.body, x.reply_msg_id, x.recalled_by, x.recalled_at, x.created_at,
				r.type AS room_type, r.name AS room_name, r.avatar AS room_avatar,
				peer.id AS peer_id, COALESCE(peer.im_display_name, peer.name) AS peer_name, peer.email AS peer_email, peer.im_avatar AS peer_avatar, peer.avatar_key AS peer_avatar_key,
				COALESCE(u.im_display_name, u.name) AS sender_name, u.email AS sender_email, u.im_avatar AS sender_avatar, u.avatar_key AS sender_avatar_key
			${from}
			JOIN im_rooms r ON r.id = x.room_id
			LEFT JOIN im_room_members pm ON r.type = ${IM_ROOM_TYPE.SINGLE} AND pm.room_id = r.id AND pm.user_id <> m.user_id
			LEFT JOIN users peer ON peer.id = pm.user_id
			LEFT JOIN users u ON u.id = x.from_uid
			WHERE ${where}
			ORDER BY x.id DESC LIMIT ? OFFSET ?`,
		).bind(...binds, params.size, (params.page - 1) * params.size),
	]);
	const total = Number((totalResult.results[0] as { total: number } | undefined)?.total ?? 0);
	const rows = pageResult.results as ChatHitRow[];

	const list = rows.map((row) => {
		const isGroup = row.room_type === IM_ROOM_TYPE.GROUP;
		const peer = row.peer_id ? { id: row.peer_id, name: row.peer_name ?? "", email: row.peer_email ?? "", imAvatar: row.peer_avatar, avatarKey: row.peer_avatar_key } : null;
		const sender = row.sender_email === null ? null : { name: row.sender_name ?? "", email: row.sender_email };
		return {
			msgId: String(row.id),
			roomId: row.room_id,
			roomType: row.room_type,
			// What HuLa opens a session by: the group id, or the other person in a one-to-one room.
			detailId: isGroup ? row.room_id : (peer?.id ?? ""),
			roomName: isGroup ? row.room_name : imUserName(peer),
			roomAvatar: isGroup ? imRoomAvatarUrl({ id: row.room_id, avatar: row.room_avatar }, origin) : peer ? imAvatarUrl(peer, origin) : "",
			fromUid: row.from_uid,
			fromName: imUserName(sender),
			fromAvatar: sender ? imAvatarUrl({ id: row.from_uid, imAvatar: row.sender_avatar, avatarKey: row.sender_avatar_key }, origin) : "",
			type: row.type,
			text: searchExcerpt(messageText(row), query.highlights),
			sendTime: row.created_at,
		};
	});
	return { list, total, isLast: params.page * params.size >= total };
}

/** The mailboxes whose mail the user reads in their own inbox: owned or shared with them, without group addresses. */
async function searchableMailboxes(env: Env, userId: string) {
	const result = await env.DB.prepare(
		`SELECT b.id, b.local_part, d.hostname FROM mailboxes b JOIN domains d ON d.id = b.domain_id
		WHERE b.disabled = 0
			AND (b.user_id = ? OR b.id IN (SELECT mailbox_id FROM mailbox_access WHERE user_id = ?))
			AND b.id NOT IN (SELECT mailbox_id FROM im_room_mailboxes)`,
	)
		.bind(userId, userId)
		.all<{ id: string; local_part: string; hostname: string }>();
	return new Map(result.results.map((row) => [row.id, `${row.local_part}@${row.hostname}`]));
}

async function searchMail(env: Env, user: ImUser, params: ImSearchParams) {
	const empty = { list: [], total: 0, isLast: true };
	const mailboxes = await searchableMailboxes(env, user.id);
	const mailboxIds = params.mailboxId ? (mailboxes.has(params.mailboxId) ? [params.mailboxId] : []) : [...mailboxes.keys()];
	if (mailboxIds.length === 0) return empty;

	const timeZone = user.timeZone || "UTC";
	const textConditions = buildSearchConditions(params.keyword, timeZone, { substringTerm: (term) => CJK_RE.test(term) });
	// A query of operators that match nothing (say `is:foo`) would otherwise list every mail.
	if (textConditions.length === 0) return empty;
	const where = and(inArray(messages.mailboxId, mailboxIds), notInArray(messages.status, HIDDEN_MAIL_STATUSES), ...textConditions);

	const db = getDb(env);
	const [[totalRow], rows] = await Promise.all([
		db.select({ total: count() }).from(messages).where(where),
		db
			.select({
				id: messages.id,
				mailboxId: messages.mailboxId,
				threadId: messages.threadId,
				direction: messages.direction,
				status: messages.status,
				subject: messages.subject,
				fromAddr: messages.fromAddr,
				toAddr: messages.toAddr,
				snippet: messages.snippet,
				// Enough of the body to show the words around a hit, without reading whole mails.
				body: sql<string | null>`substr(coalesce(${messages.textBody}, ${messages.snippet}, ''), 1, 4000)`,
				read: messages.read,
				createdAt: messages.createdAt,
			})
			.from(messages)
			.where(where)
			.orderBy(desc(messages.createdAt))
			.limit(params.size)
			.offset((params.page - 1) * params.size),
	]);
	const total = totalRow?.total ?? 0;
	const highlights = parseSearchQuery(params.keyword, timeZone)
		.text.split(" ")
		.map((term) => term.replace(/^-|"/g, ""))
		.filter(Boolean);

	const list = rows.map((row) => {
		const outbound = row.direction === "outbound";
		const bodyText = row.body || row.snippet || "";
		return {
			id: row.id,
			mailboxId: row.mailboxId,
			mailboxAddress: row.mailboxId ? (mailboxes.get(row.mailboxId) ?? "") : "",
			threadId: row.threadId,
			status: row.status,
			outbound,
			subject: row.subject?.trim() || "(无主题)",
			from: getEmailAddress(row.fromAddr),
			fromName: getEmailDisplayName(row.fromAddr),
			to: outbound ? splitEmailAddressList(row.toAddr).join(", ") : "",
			text: searchExcerpt(bodyText, highlights),
			read: Boolean(row.read),
			date: row.createdAt instanceof Date ? row.createdAt.getTime() : Number(row.createdAt) * 1000,
			/** Where the mail web app shows it; HuLa passes this as the sign-in link's `next`. */
			path: `/inbox/${encodeURIComponent(row.id)}`,
		};
	});
	return { list, total, isLast: params.page * params.size >= total };
}
