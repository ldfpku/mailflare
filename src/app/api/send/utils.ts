import type { AttachmentContent } from "@/lib/email/attachment-types";
import { decodeBase64Content } from "@/lib/email/attachments";
import { readFormDataBody, readJsonBody } from "@/lib/http/request";
import { sendEmailSchema } from "@/lib/validators";
import type { SendRequestPayload } from "./types";

const MAX_SEND_REQUEST_SIZE = 30 * 1024 * 1024;

function getOptionalFormValue(form: FormData, key: string): string | undefined {
	const value = form.get(key);
	return typeof value === "string" && value ? value : undefined;
}

export function isPastSchedule(value: string | undefined, now = Date.now()): boolean {
	if (!value) return false;
	const time = new Date(value).getTime();
	return !Number.isFinite(time) || time < now - 60_000;
}

/** JSON bodies carry files as `contentBase64` (the shape `sendEmailSchema` documents); decode them like /api/v1/send does. */
export function decodeJsonAttachments(value: unknown): AttachmentContent[] {
	const parsed = sendEmailSchema.shape.attachments.safeParse(value);
	if (!parsed.success) throw new Error("Invalid attachments");
	return (parsed.data ?? []).map((attachment) => ({
		filename: attachment.filename,
		type: attachment.type,
		content: decodeBase64Content(attachment.contentBase64),
		disposition: "attachment",
	}));
}

export async function parseSendRequest(request: Request): Promise<SendRequestPayload> {
	if (!request.headers.get("content-type")?.includes("multipart/form-data")) {
		const body = await readJsonBody<Omit<SendRequestPayload, "attachments"> & { attachments?: unknown }>(request, MAX_SEND_REQUEST_SIZE);
		return { ...body, attachments: decodeJsonAttachments(body.attachments) };
	}

	const form = await readFormDataBody(request, MAX_SEND_REQUEST_SIZE);
	const attachments: AttachmentContent[] = [];
	for (const value of form.getAll("attachments")) {
		if (!(value instanceof File) || value.size === 0) continue;
		attachments.push({
			filename: value.name,
			type: value.type || "application/octet-stream",
			content: await value.arrayBuffer(),
			disposition: "attachment",
		});
	}

	return {
		from: String(form.get("from") ?? ""),
		to: String(form.get("to") ?? ""),
		cc: getOptionalFormValue(form, "cc"),
		bcc: getOptionalFormValue(form, "bcc"),
		inReplyTo: getOptionalFormValue(form, "inReplyTo"),
		references: getOptionalFormValue(form, "references"),
		threadId: getOptionalFormValue(form, "threadId"),
		draftId: getOptionalFormValue(form, "draftId"),
		scheduledAt: getOptionalFormValue(form, "scheduledAt"),
		subject: String(form.get("subject") ?? ""),
		text: getOptionalFormValue(form, "text"),
		html: getOptionalFormValue(form, "html"),
		mailboxId: getOptionalFormValue(form, "mailboxId"),
		attachments,
	};
}
