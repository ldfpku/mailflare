import { getDb } from "@/db";
import { getUserFromSession } from "@/lib/auth/session";
import type { SessionUser } from "@/lib/auth/types";
import { driveContentDisposition } from "@/lib/drive/utils";
import { getInlineContentType } from "@/lib/http/content-type";
import { getMailboxAccessLevel } from "@/lib/mailboxes/access";
import { getSessionTokenFromRequest } from "@/lib/realtime/utils";
import { ImChatError, imUserName } from "./chat-utils";
import { isRoomMember, listSessions, postMailCard } from "./chat";
import { randomHex } from "./files-utils";
import {
	buildMailCardBody,
	isMailShareId,
	mailShareUrl,
	parseShareRoomIds,
	prepareSharedHtml,
	renderMailSharePage,
	rewriteRemoteImages,
	type SharedAttachmentRow,
	type SharedMailRow,
} from "./mail-share-utils";
import { notifyImUsers } from "./notify";
import { findMailboxRoom } from "./room-mailbox";

/**
 * Sharing a mail into HuLa chats, from the web app's message view. Each target
 * room gets an `im_mail_shares` row and a `MAIL_CARD` message; its members read
 * the mail on the share page, which needs a web session (HuLa opens it through
 * the mail sign-in link) and current membership of the room.
 */
type Env = CloudflareEnv;

const MAIL_COLUMNS = "id, mailbox_id, from_addr, to_addr, cc_addr, subject, snippet, text_body, html_body, created_at";

/** The chats a user can share into, most recently active first. */
export async function listShareTargets(env: Env, userId: string, origin: string) {
	const sessions = await listSessions(env, userId, origin);
	return sessions.filter((session) => !session.hide).map(({ roomId, name, avatar, type, memberNum }) => ({ roomId, name, avatar, type, memberNum }));
}

async function findMail(env: Env, messageId: string): Promise<SharedMailRow | null> {
	return env.DB.prepare(`SELECT ${MAIL_COLUMNS} FROM messages WHERE id = ?`).bind(messageId).first<SharedMailRow>();
}

async function listAttachments(env: Env, messageId: string): Promise<SharedAttachmentRow[]> {
	const result = await env.DB.prepare(
		"SELECT id, filename, content_type, size, disposition, content_id, r2_key FROM message_attachments WHERE message_id = ? ORDER BY rowid",
	)
		.bind(messageId)
		.all<SharedAttachmentRow>();
	return result.results;
}

/** Inline images are shown in the body; everything else is listed for download. */
function isDownloadable(attachment: SharedAttachmentRow): boolean {
	return attachment.disposition !== "inline" || !attachment.content_id;
}

/** Posts the mail as a card into each room; the sharer must be able to read the mail and be in every room. */
export async function shareMailToChats(env: Env, user: SessionUser, messageId: unknown, roomIds: unknown, origin: string): Promise<{ shared: number }> {
	const rooms = parseShareRoomIds(roomIds);
	if (!rooms) throw new ImChatError(400, "请选择要分享到的会话");
	const mail = typeof messageId === "string" && messageId ? await findMail(env, messageId) : null;
	if (!mail?.mailbox_id) throw new ImChatError(404, "邮件不存在");
	const access = await getMailboxAccessLevel(getDb(env), user, mail.mailbox_id);
	if (!access?.canRead) throw new ImChatError(404, "邮件不存在");
	const attachmentCount = (await listAttachments(env, mail.id)).filter(isDownloadable).length;

	let shared = 0;
	for (const roomId of rooms) {
		const shareId = randomHex(16);
		await env.DB.prepare("INSERT INTO im_mail_shares (id, message_id, room_id, shared_by, created_at) VALUES (?, ?, ?, ?, ?)")
			.bind(shareId, mail.id, roomId, user.id, Date.now())
			.run();
		try {
			const delivery = await postMailCard(env, user.id, roomId, buildMailCardBody(mail, shareId, origin, attachmentCount), origin);
			await notifyImUsers(env, delivery.recipients, { type: "receiveMessage", data: delivery.message });
			shared++;
		} catch (error) {
			await env.DB.prepare("DELETE FROM im_mail_shares WHERE id = ?").bind(shareId).run();
			throw error;
		}
	}
	return { shared };
}

/**
 * Posts mail delivered to a group address into its group, as a card from the
 * manager who turned the address on (or, once they left, the longest-standing
 * owner or admin). Returns false when the mailbox is not a group address, so
 * the caller notifies the mailbox owner as usual.
 */
export async function postRoomMailCard(env: Env, mailboxId: string, messageId: string): Promise<boolean> {
	const link = await findMailboxRoom(env, mailboxId);
	if (!link) return false;
	const origin = env.APP_URL?.trim().replace(/\/+$/, "") || link.origin;
	const poster = await env.DB.prepare(
		"SELECT user_id FROM im_room_members WHERE room_id = ? ORDER BY (user_id = ?) DESC, role, created_at LIMIT 1",
	)
		.bind(link.roomId, link.enabledBy)
		.first<{ user_id: string }>();
	const mail = await findMail(env, messageId);
	if (!poster || !mail) return true;
	const address = await env.DB.prepare("SELECT m.local_part || '@' || d.hostname AS address FROM mailboxes m JOIN domains d ON d.id = m.domain_id WHERE m.id = ?")
		.bind(mailboxId)
		.first<{ address: string }>();
	const attachmentCount = (await listAttachments(env, mail.id)).filter(isDownloadable).length;
	const shareId = randomHex(16);
	await env.DB.prepare("INSERT INTO im_mail_shares (id, message_id, room_id, shared_by, created_at) VALUES (?, ?, ?, ?, ?)")
		.bind(shareId, mail.id, link.roomId, poster.user_id, Date.now())
		.run();
	const body = { ...buildMailCardBody(mail, shareId, origin, attachmentCount), via: "mailbox", mailbox: address?.address ?? "" };
	const delivery = await postMailCard(env, poster.user_id, link.roomId, body, origin);
	await notifyImUsers(env, delivery.recipients, { type: "receiveMessage", data: delivery.message });
	return true;
}

// Images only from this origin: remote ones are left out, or go through /api/remote-images once the reader asks for them.
// `allow-same-origin` (still no scripts) lets those and the inline `cid:` images carry the session cookie.
const PAGE_CSP =
	"default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; font-src 'self' data:; form-action 'none'; frame-ancestors 'none'; sandbox allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-downloads";

function page(status: number, title: string, message: string): Response {
	const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${title}</title></head><body style="font:15px/1.6 sans-serif;color:#0a1f54;padding:48px;text-align:center"><p>${message}</p></body></html>`;
	return new Response(html, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": PAGE_CSP, "Cache-Control": "no-store" } });
}

/** The share page, or one of its attachments when `attachmentId` is set. */
export async function serveMailShare(env: Env, request: Request, shareId: string, attachmentId: string | null, origin: string): Promise<Response> {
	const user = await getUserFromSession(env, getSessionTokenFromRequest(request));
	if (!user || user.disabled || user.deletedAt) {
		const next = encodeURIComponent(new URL(request.url).pathname);
		return new Response(null, { status: 302, headers: { Location: `${origin}/login?next=${next}`, "Cache-Control": "no-store" } });
	}
	const share = isMailShareId(shareId)
		? await env.DB.prepare("SELECT message_id, room_id, shared_by FROM im_mail_shares WHERE id = ?")
				.bind(shareId)
				.first<{ message_id: string; room_id: string; shared_by: string }>()
		: null;
	if (!share) return page(404, "邮件不存在", "这封邮件已被删除，或分享已失效。");
	if (!(await isRoomMember(env, share.room_id, user.id))) return page(403, "无权查看", "你不在这封邮件被分享到的会话中，无法查看。");
	const mail = await findMail(env, share.message_id);
	if (!mail) return page(404, "邮件不存在", "这封邮件已被删除。");
	const attachments = await listAttachments(env, mail.id);

	if (attachmentId !== null) {
		const attachment = attachments.find((item) => item.id === attachmentId);
		const object = attachment ? await env.BUCKET.get(attachment.r2_key) : null;
		if (!attachment || !object) return page(404, "附件不存在", "附件不存在。");
		const inlineType = attachment.content_id ? getInlineContentType(attachment.content_type) : null;
		return new Response(object.body, {
			headers: {
				"Content-Type": inlineType ?? "application/octet-stream",
				"Content-Disposition": driveContentDisposition(attachment.filename, inlineType !== null),
				"X-Content-Type-Options": "nosniff",
				"Content-Security-Policy": "default-src 'none'; sandbox",
				"Cache-Control": "private, max-age=3600",
			},
		});
	}

	const attachmentUrl = (id: string) => `${mailShareUrl(origin, shareId)}/attachments/${id}`;
	const cidUrls = new Map(
		attachments.filter((item) => item.content_id).map((item) => [item.content_id!.replace(/^<|>$/g, "").toLowerCase(), attachmentUrl(item.id)]),
	);
	const viaRoom = mail.mailbox_id ? await findMailboxRoom(env, mail.mailbox_id) : null;
	const sharer = await env.DB.prepare("SELECT name, email FROM users WHERE id = ?").bind(share.shared_by).first<{ name: string; email: string }>();
	// Like the mail reader's "ask" setting: remote images load only after a click, and then through our proxy.
	const showImages = new URL(request.url).searchParams.get("images") === "1";
	const remote = mail.html_body
		? rewriteRemoteImages(prepareSharedHtml(mail.html_body, cidUrls), origin, (url) => (showImages ? `${origin}/api/remote-images?url=${encodeURIComponent(url)}` : null))
		: null;
	const html = renderMailSharePage({
		mail,
		note: viaRoom?.roomId === share.room_id ? "群邮箱收到的邮件" : `${imUserName(sharer)} 分享到聊天的邮件`,
		attachments: attachments.filter(isDownloadable).map((item) => ({ name: item.filename, size: item.size, url: attachmentUrl(item.id) })),
		bodyHtml: remote?.html ?? null,
		showImagesUrl: remote?.found && !showImages ? `${mailShareUrl(origin, shareId)}?images=1` : null,
	});
	return new Response(html, {
		headers: {
			"Content-Type": "text/html; charset=utf-8",
			"Content-Security-Policy": PAGE_CSP,
			"X-Content-Type-Options": "nosniff",
			"Referrer-Policy": "no-referrer",
			"Cache-Control": "no-store",
		},
	});
}
