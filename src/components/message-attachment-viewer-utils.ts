import type { MessageAttachment } from "@/app/(dashboard)/inbox/[messageId]/types";
import { getMimeEssence } from "@/lib/http/content-type";
import type { AttachmentPreviewKind } from "./message-attachment-viewer-types";

export function getAttachmentFileUrl(
	messageId: string,
	attachmentId: string,
	mode: "download" | "preview" = "download",
): string {
	const suffix = mode === "preview" ? "?preview=1" : "?download=1";
	return `/api/messages/${messageId}/attachments/${attachmentId}${suffix}`;
}

export function getAttachmentPreviewKind(
	attachment: Pick<MessageAttachment, "type">,
): AttachmentPreviewKind {
	const type = getMimeEssence(attachment.type);
	if (!type) return "unsupported";
	if (type === "text/html") return "html";
	if (type === "application/pdf") return "pdf";
	if (type.startsWith("audio/")) return "audio";
	if (type.startsWith("video/")) return "video";
	if (type.startsWith("image/") && type !== "image/svg+xml") return "image";
	if (
		type === "text/plain" ||
		type === "application/json" ||
		type === "application/xml" ||
		type === "text/csv"
	) {
		return "text";
	}
	return "unsupported";
}
