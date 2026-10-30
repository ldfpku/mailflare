import { newId } from "@/lib/ids";

export const SHARED_ATTACHMENT_LINK_DAYS = 30;

export async function getOrCreateSharedAttachmentUrls(
	env: CloudflareEnv,
	attachmentIds: string[],
	publicOrigin?: string,
): Promise<Map<string, string>> {
	if (!attachmentIds.length) return new Map();
	const origin = env.APP_URL?.trim() || publicOrigin;
	if (!origin) throw new Error("Set APP_URL before sending large attachments as download links");
	const url = new URL(origin);
	if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))) {
		throw new Error("A public HTTPS APP_URL is required for large attachment links");
	}
	const now = new Date();
	const uniqueIds = [...new Set(attachmentIds)];
	const seconds = Math.floor(now.getTime() / 1000);
	const expires = seconds + SHARED_ATTACHMENT_LINK_DAYS * 24 * 60 * 60;
	const statements = uniqueIds.flatMap((attachmentId) => [
		env.DB.prepare("DELETE FROM shared_attachment_links WHERE attachment_id = ? AND expires_at <= ?").bind(attachmentId, seconds),
		env.DB.prepare("INSERT INTO shared_attachment_links (id, attachment_id, expires_at, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(attachment_id) DO NOTHING")
			.bind(newId("share"), attachmentId, expires, seconds),
	]);
	await env.DB.batch(statements);
	const placeholders = uniqueIds.map(() => "?").join(", ");
	const links = await env.DB.prepare(`SELECT id, attachment_id FROM shared_attachment_links WHERE attachment_id IN (${placeholders}) AND expires_at > ?`)
		.bind(...uniqueIds, seconds).all<{ id: string; attachment_id: string }>();
	const result = new Map(links.results.map((link) => [link.attachment_id, new URL(`/api/shared-files/${encodeURIComponent(link.id)}`, url).toString()]));
	if (uniqueIds.some((id) => !result.has(id))) throw new Error("Could not create a large attachment link");
	return result;
}
