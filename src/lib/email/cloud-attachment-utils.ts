import type { AttachmentContent, AttachmentReference } from "./attachment-types";
import { loadSmallAttachment } from "./attachments";
import { CLOUD_ATTACHMENT_THRESHOLD_BYTES } from "./attachment-policy";
import { getOrCreateSharedAttachmentUrls } from "./shared-attachments";

const GENERAL_MESSAGE_LIMIT_BYTES = 5 * 1024 * 1024;
const MIME_SAFETY_MARGIN_BYTES = 256 * 1024;

function escapeHtml(value: string): string {
	return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

export async function prepareCloudflareAttachments(
	env: CloudflareEnv,
	attachments: AttachmentReference[],
	message: { subject: string; html?: string; text?: string; headers: Record<string, string>; publicOrigin?: string },
): Promise<{ attachments: AttachmentContent[]; html?: string; text?: string }> {
	const encoder = new TextEncoder();
	let estimatedSize = encoder.encode(message.subject + (message.html ?? "") + (message.text ?? "") + JSON.stringify(message.headers)).byteLength + 8192;
	const direct: AttachmentContent[] = [];
	const linked: AttachmentReference[] = [];
	for (const attachment of attachments) {
		const size = attachment.size;
		const encodedSize = Math.ceil(size / 3) * 4 + 2048;
		if (size <= CLOUD_ATTACHMENT_THRESHOLD_BYTES && estimatedSize + encodedSize <= GENERAL_MESSAGE_LIMIT_BYTES - MIME_SAFETY_MARGIN_BYTES) {
			direct.push(await loadSmallAttachment(env, attachment));
			estimatedSize += encodedSize;
			continue;
		}
		const object = await env.BUCKET.head(attachment.objectKey);
		if (!object || object.size !== size) throw new Error(`Attachment ${attachment.filename} is unavailable`);
		linked.push(attachment);
	}
	if (!linked.length) {
		if (estimatedSize > GENERAL_MESSAGE_LIMIT_BYTES - MIME_SAFETY_MARGIN_BYTES) throw new Error("Message is too large to send");
		return { attachments: direct, html: message.html, text: message.text };
	}
	let urls: Map<string, string>;
	try {
		urls = await getOrCreateSharedAttachmentUrls(env, linked.map((attachment) => attachment.storageId), message.publicOrigin);
	} catch (error) {
		console.error("Could not prepare attachment download link", error);
		throw new Error("Could not prepare attachment download links");
	}
	const files = linked.map((file) => {
		const url = urls.get(file.storageId);
		if (!url) throw new Error("Could not prepare attachment download links");
		return { ...file, url };
	});
	const intro = "Attachments (download links expire after 30 days):";
	const textLinks = files.map((file) => `${file.filename} (${(file.size / 1_000_000).toFixed(1)} MB): ${file.url}`).join("\n");
	const htmlLinks = files.map((file) => `<li>${escapeHtml(file.filename)} (${(file.size / 1_000_000).toFixed(1)} MB): <a href="${escapeHtml(file.url)}">Download file</a></li>`).join("");
	const text = [message.text?.trim(), intro, textLinks].filter(Boolean).join("\n\n");
	const html = `${message.html ?? ""}<div><p>${escapeHtml(intro)}</p><ul>${htmlLinks}</ul></div>`;
	if (estimatedSize + encoder.encode(textLinks + htmlLinks + intro + intro).byteLength + 4096 > GENERAL_MESSAGE_LIMIT_BYTES - MIME_SAFETY_MARGIN_BYTES) {
		throw new Error("Message is too large to send");
	}
	return { attachments: direct, html, text };
}
