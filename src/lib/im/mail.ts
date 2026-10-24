import { SESSION_COOKIE, createSession, hashSessionToken } from "@/lib/auth/session";
import { newId } from "@/lib/ids";
import type { NewMessageNotification } from "@/lib/realtime/types";
import { randomHex } from "./files-utils";
import { notifyImUsers } from "./notify";

/**
 * Mail inside HuLa: the client opens the mailflare web app in its own window,
 * signed in through a one-time link, shows the inbox unread count on its mail
 * button, and hears about new mail as a `mailNew` socket event.
 */
type Env = CloudflareEnv;

const SSO_CODE_TTL_MS = 60 * 1000;
const SSO_ID_PREFIX = "imsso_";
const SESSION_MAX_AGE_SECONDS = 30 * 86_400;

/**
 * A link that signs the HuLa user in to the web app once. The code is kept as a
 * short-lived `sessions` row, so revoking a user's sessions also voids it.
 */
export async function createMailSsoLink(env: Env, userId: string, origin: string, next: unknown): Promise<{ url: string }> {
	const code = randomHex(24);
	const now = Date.now();
	await env.DB.prepare("INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)")
		.bind(`${SSO_ID_PREFIX}${newId()}`, userId, await hashSessionToken(code), Math.floor((now + SSO_CODE_TTL_MS) / 1000), Math.floor(now / 1000))
		.run();
	const target = safeNextPath(next);
	return { url: `${origin}/api/im/mail/sso/${code}${target === "/" ? "" : `?next=${encodeURIComponent(target)}`}` };
}

/** Only paths on our own origin; anything else (`//host`, schemes, backslashes) falls back to the inbox. */
export function safeNextPath(next: unknown): string {
	if (typeof next !== "string" || !/^\/(?![/\\])[\x21-\x7e]*$/.test(next)) return "/";
	return next;
}

/** Redeems the one-time link: the code is deleted as it is read, then a normal 30-day web session is set. */
export async function redeemMailSsoLink(env: Env, request: Request, code: string): Promise<Response> {
	const row = /^[a-f0-9]{48}$/.test(code)
		? await env.DB.prepare(
				"DELETE FROM sessions WHERE token_hash = ? AND id LIKE ? AND expires_at > ? RETURNING user_id",
			)
				.bind(await hashSessionToken(code), `${SSO_ID_PREFIX}%`, Math.floor(Date.now() / 1000))
				.first<{ user_id: string }>()
		: null;
	const url = new URL(request.url);
	if (!row) return redirect(`${url.origin}/login`, null);
	const user = await env.DB.prepare("SELECT disabled, deleted_at FROM users WHERE id = ?").bind(row.user_id).first<{ disabled: number; deleted_at: number | null }>();
	if (!user || user.disabled || user.deleted_at) return redirect(`${url.origin}/login`, null);
	const token = await createSession(env, row.user_id);
	const secure = url.protocol === "https:" ? "; Secure" : "";
	const cookie = `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}${secure}`;
	// Without a target, open the inbox rather than the public home page.
	const next = safeNextPath(url.searchParams.get("next"));
	return redirect(`${url.origin}${next === "/" ? "/inbox" : next}`, cookie);
}

function redirect(location: string, cookie: string | null): Response {
	const headers = new Headers({ Location: location, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
	if (cookie) headers.append("Set-Cookie", cookie);
	return new Response(null, { status: 302, headers });
}

/**
 * Unread inbox mail in the mailboxes the user owns or was given, not every mailbox an admin could open.
 * Group addresses are left out: their mail is read in the group chat.
 */
export async function countUnreadMail(env: Env, userId: string): Promise<number> {
	const row = await env.DB.prepare(
		`SELECT COUNT(*) AS count FROM messages
		WHERE status = 'received' AND read = 0 AND mailbox_id IN (
			SELECT id FROM mailboxes WHERE user_id = ? AND disabled = 0
			UNION SELECT mailbox_id FROM mailbox_access WHERE user_id = ?
		) AND mailbox_id NOT IN (SELECT mailbox_id FROM im_room_mailboxes)`,
	)
		.bind(userId, userId)
		.first<{ count: number }>();
	return Number(row?.count ?? 0);
}

/** Tells the users' HuLa clients about new inbox mail; they show a notification and refresh the unread count. */
export async function notifyImUsersOfMail(env: Env, userIds: string[], mail: NewMessageNotification): Promise<void> {
	await notifyImUsers(env, userIds, {
		type: "mailNew",
		data: { messageId: mail.messageId, mailboxId: mail.mailboxId, from: mail.from, fromName: mail.fromName, subject: mail.subject ?? "" },
	});
}
