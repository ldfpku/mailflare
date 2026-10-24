import { getEmailAddress, getEmailDisplayName } from "@/lib/email/address";

/**
 * Pure helpers for sharing a mail into HuLa chats. A share is posted as a
 * `MAIL_CARD` message whose body carries what the card shows; the full mail is
 * read through `/api/im/mail/share/<id>`, which room members may open.
 */

export const IM_MAIL_SHARE_PATH = "/api/im/mail/share/";
export const IM_MAIL_SHARE_ROOM_LIMIT = 20;
export const IM_MAIL_CARD_SNIPPET_LIMIT = 200;

const SHARE_ID = /^[a-f0-9]{32}$/;

export interface SharedMailRow {
	id: string;
	mailbox_id: string | null;
	from_addr: string;
	to_addr: string;
	cc_addr: string | null;
	subject: string | null;
	snippet: string | null;
	text_body: string | null;
	html_body: string | null;
	created_at: number;
}

export interface SharedAttachmentRow {
	id: string;
	filename: string;
	content_type: string;
	size: number;
	disposition: string | null;
	content_id: string | null;
	r2_key: string;
}

export function isMailShareId(value: unknown): value is string {
	return typeof value === "string" && SHARE_ID.test(value);
}

export function mailShareUrl(origin: string, shareId: string): string {
	return `${origin}${IM_MAIL_SHARE_PATH}${shareId}`;
}

/** The distinct room ids a share request names, or null when there are none or too many. */
export function parseShareRoomIds(value: unknown): string[] | null {
	if (!Array.isArray(value)) return null;
	const ids = [...new Set(value.filter((id): id is string => typeof id === "string" && id.length > 0 && id.length <= 64))];
	return ids.length > 0 && ids.length <= IM_MAIL_SHARE_ROOM_LIMIT ? ids : null;
}

function cardSnippet(mail: Pick<SharedMailRow, "snippet" | "text_body">): string {
	const source = (mail.snippet || mail.text_body || "").replace(/\s+/g, " ").trim();
	return source.length > IM_MAIL_CARD_SNIPPET_LIMIT ? `${source.slice(0, IM_MAIL_CARD_SNIPPET_LIMIT)}…` : source;
}

/** What a mail card shows. Dates leave in milliseconds, as HuLa's other times do. */
export function buildMailCardBody(mail: SharedMailRow, shareId: string, origin: string, attachmentCount: number) {
	return {
		shareId,
		subject: mail.subject?.trim() || "(无主题)",
		from: getEmailAddress(mail.from_addr),
		fromName: getEmailDisplayName(mail.from_addr),
		date: mail.created_at * 1000,
		snippet: cardSnippet(mail),
		attachmentCount,
		url: mailShareUrl(origin, shareId),
	};
}

export type ImMailCardBody = ReturnType<typeof buildMailCardBody>;

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function escapeHtml(value: string): string {
	return value.replace(/[&<>"']/g, (char) => ESCAPES[char]);
}

/**
 * Mail HTML for the share page. The page is served sandboxed with a CSP that
 * blocks scripts; this also removes scripts, handlers and the tags that act
 * without them (refresh, base, frames), and points `cid:` images at the
 * share's attachment URLs.
 */
export function prepareSharedHtml(html: string, cidUrls: Map<string, string>): string {
	return html
		.replace(/<script\b[\s\S]*?<\/script\s*>/gi, "")
		.replace(/<(script|meta|base|link|iframe|object|embed)\b[^>]*>/gi, "")
		.replace(/\s(on[a-z]+|formaction)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
		.replace(/(href|src|action)\s*=\s*(["']?)\s*javascript:/gi, "$1=$2#")
		.replace(/\bcid:([^"'\s)>]+)/gi, (match, id: string) => cidUrls.get(decodeURIComponent(id).toLowerCase()) ?? match);
}

const REMOTE = /^(?:https?:)?\/\//i;
const REMOTE_ATTRIBUTE = /(\s(?:src|background|poster)\s*=\s*)(?:(["'])([^"']*)\2|([^\s"'>]+))/gi;
const SRCSET_ATTRIBUTE = /(\ssrcset\s*=\s*)(?:(["'])([^"']*)\2|([^\s"'>]+))/gi;
const CSS_URL = /url\(\s*(&quot;|&#39;|["']?)\s*([^"')&]*?)\s*\1\s*\)/gi;

/**
 * Finds the remote images in mail HTML (`src`, `background`, `poster`,
 * `srcset` and CSS `url()`), and passes each absolute URL to `replace`: a new
 * URL, or null to drop it. URLs on `origin` (the share's own `cid:` images)
 * are kept. The share page's CSP only allows images from this origin, so
 * anything this misses fails to load rather than leaking.
 */
export function rewriteRemoteImages(html: string, origin: string, replace: (url: string) => string | null): { html: string; found: boolean } {
	let found = false;
	const absolute = (url: string) => (url.startsWith("//") ? `https:${url}` : url);
	const isRemote = (url: string) => REMOTE.test(url.trim()) && !absolute(url.trim()).startsWith(`${origin}/`);
	const swap = (url: string) => {
		const trimmed = url.trim().replace(/&(amp|quot|#39);/g, (entity, name: string) => (name === "amp" ? "&" : name === "quot" ? '"' : "'"));
		if (!isRemote(trimmed)) return url;
		found = true;
		return replace(absolute(trimmed)) ?? "";
	};
	const rewritten = html
		.replace(REMOTE_ATTRIBUTE, (match, prefix: string, quote: string | undefined, quoted: string | undefined, bare: string | undefined) => {
			const value = quoted ?? bare ?? "";
			if (!isRemote(value)) return match;
			return `${prefix}"${escapeHtml(swap(value))}"`;
		})
		.replace(SRCSET_ATTRIBUTE, (match, prefix: string, quote: string | undefined, quoted: string | undefined, bare: string | undefined) => {
			const candidates = (quoted ?? bare ?? "").split(",").map((candidate) => candidate.trim()).filter(Boolean);
			if (!candidates.some((candidate) => isRemote(candidate.split(/\s+/)[0]))) return match;
			const kept = candidates
				.map((candidate) => {
					const [url, ...descriptor] = candidate.split(/\s+/);
					const next = swap(url);
					return next ? [next, ...descriptor].join(" ") : null;
				})
				.filter(Boolean);
			return `${prefix}"${escapeHtml(kept.join(", "))}"`;
		})
		.replace(CSS_URL, (match, quote: string, url: string) => {
			if (!isRemote(url)) return match;
			const next = swap(url);
			return next ? `url(${quote}${next}${quote})` : "none";
		});
	return { html: rewritten, found };
}

function formatDate(seconds: number): string {
	return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Shanghai" }).format(new Date(seconds * 1000));
}

function formatSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** The read-only page a shared mail is shown on. */
export function renderMailSharePage(options: {
	mail: SharedMailRow;
	/** The line above the subject saying how the mail reached the chat. */
	note: string;
	attachments: { name: string; size: number; url: string }[];
	bodyHtml: string | null;
	/** Set when the body's remote images were left out; the link loads them. */
	showImagesUrl?: string | null;
}): string {
	const { mail, note, attachments, bodyHtml, showImagesUrl } = options;
	const subject = escapeHtml(mail.subject?.trim() || "(无主题)");
	const rows = [
		["发件人", mail.from_addr],
		["收件人", mail.to_addr],
		...(mail.cc_addr ? [["抄送", mail.cc_addr]] : []),
		["时间", formatDate(mail.created_at)],
	]
		.map(([label, value]) => `<div class="row"><span class="label">${label}</span><span>${escapeHtml(value)}</span></div>`)
		.join("");
	const files = attachments.length
		? `<div class="files">${attachments
				.map((file) => `<a class="file" href="${escapeHtml(file.url)}" download>${escapeHtml(file.name)}<span>${formatSize(file.size)}</span></a>`)
				.join("")}</div>`
		: "";
	const body = bodyHtml ?? `<pre class="text">${escapeHtml(mail.text_body ?? "")}</pre>`;
	const remote = showImagesUrl
		? `<div class="remote">为保护隐私，邮件中的远程图片未加载。<a href="${escapeHtml(showImagesUrl)}" target="_self">显示图片</a></div>`
		: "";
	return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${subject}</title>
<base target="_blank">
<style>
body{margin:0;background:#f5f7fb;color:#0a1f54;font:14px/1.6 "Noto Sans SC","Microsoft YaHei",sans-serif}
.head{background:#fff;border-bottom:1px solid #e3e8f2;padding:20px 24px}
.shared{font-size:12px;color:#5b6b8c;margin-bottom:8px}
h1{font-size:20px;margin:0 0 12px;word-break:break-word}
.row{display:flex;gap:12px;font-size:13px;word-break:break-all}
.label{flex:none;width:48px;color:#5b6b8c}
.files{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.file{display:inline-flex;gap:8px;align-items:center;padding:6px 10px;border:1px solid #d5ddec;border-radius:6px;color:#034fbc;text-decoration:none;font-size:13px}
.file span{color:#5b6b8c;font-size:12px}
.mail{background:#fff;margin:16px 24px;padding:20px;border-radius:8px;overflow-x:auto}
.text{white-space:pre-wrap;word-break:break-word;font:inherit;margin:0}
.remote{margin:16px 24px 0;padding:10px 14px;border-radius:8px;background:#fff7e6;color:#5b4a1f;font-size:13px}
.remote a{color:#034fbc;margin-left:8px}
</style>
</head>
<body>
<div class="head">
<div class="shared">${escapeHtml(note)}</div>
<h1>${subject}</h1>
${rows}
${files}
</div>
${remote}
<div class="mail">${body}</div>
</body>
</html>`;
}
