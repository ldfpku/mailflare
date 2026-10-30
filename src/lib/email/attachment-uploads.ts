import { and, eq, lt } from "drizzle-orm";
import { getDb } from "@/db";
import { mailAttachmentUploadParts, mailAttachmentUploads, messageAttachments, messages } from "@/db/schema";
import { newId } from "@/lib/ids";
import { MAX_ATTACHMENT_COUNT } from "./attachments";
import { getOutboundAttachmentMaxMb } from "./attachment-policy";

export const MAIL_UPLOAD_PART_BYTES = 8 * 1024 * 1024;
const UPLOAD_LIFETIME_MS = 3 * 24 * 60 * 60 * 1000;
const UPLOAD_LEASE_MS = 15 * 60 * 1000;

export class MailUploadError extends Error {
	constructor(message: string, readonly status: number) { super(message); }
}

type Upload = typeof mailAttachmentUploads.$inferSelect;

async function claim(env: CloudflareEnv, upload: Upload, state: "completing" | "canceling") {
	const now = new Date();
	const lease = crypto.randomUUID();
	const result = await env.DB.prepare(`UPDATE mail_attachment_uploads SET state = ?, updated_at = ?, lease_id = ?
		WHERE id = ? AND (state = 'pending' OR updated_at < ?)`)
		.bind(state, Math.floor(now.getTime() / 1000), lease, upload.id, Math.floor((now.getTime() - UPLOAD_LEASE_MS) / 1000)).run();
	if (!result.meta.changes) throw new MailUploadError("Attachment upload is already being processed", 409);
	return lease;
}

async function releaseClaim(env: CloudflareEnv, id: string, state: "completing" | "canceling", lease: string) {
	await getDb(env).update(mailAttachmentUploads).set({ state: "pending", leaseId: null, updatedAt: new Date() })
		.where(and(eq(mailAttachmentUploads.id, id), eq(mailAttachmentUploads.state, state), eq(mailAttachmentUploads.leaseId, lease)));
}

async function ownedDraft(env: CloudflareEnv, userId: string, draftId: string) {
	const [draft] = await getDb(env).select({ id: messages.id }).from(messages)
		.where(and(eq(messages.id, draftId), eq(messages.userId, userId), eq(messages.status, "draft"))).limit(1);
	if (!draft) throw new MailUploadError("Draft not found", 404);
}

async function discard(env: CloudflareEnv, upload: Upload) {
	const lease = await claim(env, upload, "canceling");
	try {
		const object = await env.BUCKET.head(upload.objectKey);
		if (object) await env.BUCKET.delete(upload.objectKey);
		else await env.BUCKET.resumeMultipartUpload(upload.objectKey, upload.uploadId).abort();
		await getDb(env).delete(mailAttachmentUploads).where(and(eq(mailAttachmentUploads.id, upload.id), eq(mailAttachmentUploads.state, "canceling"), eq(mailAttachmentUploads.leaseId, lease)));
	} catch (error) {
		await releaseClaim(env, upload.id, "canceling", lease);
		throw error;
	}
}

export async function abortDraftAttachmentUploads(env: CloudflareEnv, draftId: string) {
	const uploads = await getDb(env).select().from(mailAttachmentUploads).where(eq(mailAttachmentUploads.draftId, draftId));
	for (const upload of uploads) await discard(env, upload);
}

export async function abortUserAttachmentUploads(env: CloudflareEnv, userId: string) {
	const uploads = await getDb(env).select().from(mailAttachmentUploads).where(eq(mailAttachmentUploads.userId, userId));
	for (const upload of uploads) await discard(env, upload);
}

export async function cleanExpiredAttachmentUploads(env: CloudflareEnv, now = new Date()) {
	const uploads = await getDb(env).select().from(mailAttachmentUploads)
		.where(lt(mailAttachmentUploads.updatedAt, new Date(now.getTime() - UPLOAD_LIFETIME_MS))).limit(8);
	for (const upload of uploads) {
		try { await discard(env, upload); }
		catch (error) { console.error("Could not clean up expired attachment upload", error); }
	}
}

export async function startMailAttachmentUpload(
	env: CloudflareEnv, userId: string, draftId: string,
	input: { name?: unknown; size?: unknown; contentType?: unknown; fingerprint?: unknown },
) {
	await ownedDraft(env, userId, draftId);
	const db = getDb(env);
	const size = input.size;
	const filename = typeof input.name === "string" ? Array.from(input.name.trim().replace(/[\u0000-\u001f\u007f/\\]/g, "_")).slice(0, 255).join("") : "";
	const contentType = typeof input.contentType === "string" ? input.contentType.trim().replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 255) : "";
	const fingerprint = typeof input.fingerprint === "string" ? input.fingerprint : "";
	if (!filename || !Number.isSafeInteger(size) || typeof size !== "number" || size <= 0 ||
		!fingerprint || fingerprint.length > 100) throw new MailUploadError("Invalid attachment", 400);
	const maxBytes = (await getOutboundAttachmentMaxMb(env)) * 1_000_000;
	if (size > maxBytes) throw new MailUploadError("Attachment exceeds the outgoing size limit", 413);
	const stale = await db.select().from(mailAttachmentUploads)
		.where(and(eq(mailAttachmentUploads.userId, userId), lt(mailAttachmentUploads.updatedAt, new Date(Date.now() - UPLOAD_LIFETIME_MS)))).limit(5);
	for (const upload of stale) {
		try { await discard(env, upload); }
		catch (error) { console.error("Could not clean up expired attachment upload", error); }
	}
	const pending = await db.select().from(mailAttachmentUploads)
		.where(and(eq(mailAttachmentUploads.userId, userId), eq(mailAttachmentUploads.draftId, draftId)));
	const previous = pending.find((upload) => upload.fingerprint === fingerprint && upload.filename === filename && upload.size === size);
	if (previous) {
		const parts = await db.select({ partNumber: mailAttachmentUploadParts.partNumber }).from(mailAttachmentUploadParts).where(eq(mailAttachmentUploadParts.uploadId, previous.id));
		if (previous.state === "pending") {
			await db.update(mailAttachmentUploads).set({ updatedAt: new Date() })
				.where(and(eq(mailAttachmentUploads.id, previous.id), eq(mailAttachmentUploads.state, "pending")));
		}
		return { id: previous.id, partSize: previous.partSize, parts: Math.ceil(previous.size / previous.partSize), uploaded: parts.map((part) => part.partNumber) };
	}
	const id = newId("att");
	const objectKey = `attachments/${draftId}/${id}`;
	const upload = await env.BUCKET.createMultipartUpload(objectKey, { httpMetadata: { contentType: contentType || "application/octet-stream" } });
	try {
		const insert = await env.DB.prepare(`INSERT INTO mail_attachment_uploads
			(id, draft_id, user_id, object_key, upload_id, filename, content_type, size, part_size, fingerprint, updated_at)
			SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
			WHERE (SELECT COUNT(*) FROM message_attachments WHERE message_id = ? AND trashed_at IS NULL)
			  + (SELECT COUNT(*) FROM mail_attachment_uploads WHERE draft_id = ? AND user_id = ?) < ?
			AND (SELECT COALESCE(SUM(size), 0) FROM message_attachments WHERE message_id = ? AND trashed_at IS NULL)
			  + (SELECT COALESCE(SUM(size), 0) FROM mail_attachment_uploads WHERE draft_id = ? AND user_id = ?) + ? <= ?`)
			.bind(id, draftId, userId, objectKey, upload.uploadId, filename, contentType || "application/octet-stream", size,
				MAIL_UPLOAD_PART_BYTES, fingerprint, Math.floor(Date.now() / 1000), draftId, draftId, userId, MAX_ATTACHMENT_COUNT,
				draftId, draftId, userId, size, maxBytes).run();
		if (!insert.meta.changes) throw new MailUploadError("Draft attachments exceed the allowed count or size limit", 413);
	} catch (error) {
		try { await upload.abort(); } catch (abortError) { console.error("Could not abort attachment upload", abortError); }
		throw error;
	}
	return { id, partSize: MAIL_UPLOAD_PART_BYTES, parts: Math.ceil(size / MAIL_UPLOAD_PART_BYTES), uploaded: [] as number[] };
}

async function pendingUpload(env: CloudflareEnv, userId: string, draftId: string, id: string) {
	await ownedDraft(env, userId, draftId);
	const [upload] = await getDb(env).select().from(mailAttachmentUploads)
		.where(and(eq(mailAttachmentUploads.id, id), eq(mailAttachmentUploads.draftId, draftId), eq(mailAttachmentUploads.userId, userId))).limit(1);
	if (!upload) throw new MailUploadError("Upload not found", 404);
	return upload;
}

export async function uploadMailAttachmentPart(env: CloudflareEnv, userId: string, draftId: string, id: string, request: Request) {
	const upload = await pendingUpload(env, userId, draftId, id);
	if (upload.state !== "pending") throw new MailUploadError("Attachment upload is already being processed", 409);
	const partNumber = Number(new URL(request.url).searchParams.get("part"));
	const total = Math.ceil(upload.size / upload.partSize);
	const expected = partNumber < total ? upload.partSize : upload.size - (total - 1) * upload.partSize;
	const length = Number(request.headers.get("content-length"));
	if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > total || length !== expected || !request.body) {
		throw new MailUploadError("Invalid attachment part", 400);
	}
	let received = 0;
	const limiter = typeof FixedLengthStream === "undefined"
		? new TransformStream<Uint8Array, Uint8Array>({
			transform(chunk, controller) {
				received += chunk.byteLength;
				if (received > expected) throw new MailUploadError("Invalid attachment part size", 400);
				controller.enqueue(chunk);
			},
			flush() { if (received !== expected) throw new MailUploadError("Invalid attachment part size", 400); },
		})
		: new FixedLengthStream(expected);
	const transfer = request.body.pipeTo(limiter.writable);
	const [part] = await Promise.all([
		env.BUCKET.resumeMultipartUpload(upload.objectKey, upload.uploadId).uploadPart(partNumber, limiter.readable),
		transfer,
	]);
	const db = getDb(env);
	await db.insert(mailAttachmentUploadParts).values({ uploadId: id, partNumber, etag: part.etag })
		.onConflictDoUpdate({ target: [mailAttachmentUploadParts.uploadId, mailAttachmentUploadParts.partNumber], set: { etag: part.etag } });
	await db.update(mailAttachmentUploads).set({ updatedAt: new Date() }).where(eq(mailAttachmentUploads.id, id));
}

export async function completeMailAttachmentUpload(env: CloudflareEnv, userId: string, draftId: string, id: string) {
	await ownedDraft(env, userId, draftId);
	const db = getDb(env);
	const [existing] = await db.select().from(messageAttachments).where(and(eq(messageAttachments.id, id), eq(messageAttachments.messageId, draftId))).limit(1);
	if (existing) return { id: existing.id, filename: existing.filename, size: existing.size, type: existing.contentType, disposition: existing.disposition };
	const upload = await pendingUpload(env, userId, draftId, id);
	const lease = await claim(env, upload, "completing");
	try {
	const parts = await db.select({ partNumber: mailAttachmentUploadParts.partNumber, etag: mailAttachmentUploadParts.etag })
		.from(mailAttachmentUploadParts).where(eq(mailAttachmentUploadParts.uploadId, id));
	const total = Math.ceil(upload.size / upload.partSize);
	parts.sort((a, b) => a.partNumber - b.partNumber);
	if (parts.length !== total || parts.some((part, index) => part.partNumber !== index + 1)) throw new MailUploadError("Some attachment parts are missing", 409);
	let object = await env.BUCKET.head(upload.objectKey);
	if (!object) object = await env.BUCKET.resumeMultipartUpload(upload.objectKey, upload.uploadId).complete(parts);
	if (object.size !== upload.size) {
		await env.BUCKET.delete(upload.objectKey);
		throw new MailUploadError("Uploaded attachment size does not match", 400);
	}
	const maxBytes = (await getOutboundAttachmentMaxMb(env)) * 1_000_000;
	const timestamp = Math.floor(Date.now() / 1000);
	await env.DB.batch([
		env.DB.prepare(`INSERT INTO message_attachments (id, message_id, filename, content_type, size, disposition, r2_key, created_at)
			SELECT ?, ?, ?, ?, ?, 'attachment', ?, ?
			WHERE EXISTS (SELECT 1 FROM messages WHERE id = ? AND user_id = ? AND status = 'draft')
			AND EXISTS (SELECT 1 FROM mail_attachment_uploads WHERE id = ? AND user_id = ? AND draft_id = ? AND state = 'completing' AND lease_id = ?)
			AND (SELECT COUNT(*) FROM message_attachments WHERE message_id = ? AND trashed_at IS NULL) < ?
			AND (SELECT COALESCE(SUM(size), 0) FROM message_attachments WHERE message_id = ? AND trashed_at IS NULL) + ? <= ?
			ON CONFLICT(id) DO NOTHING`)
			.bind(id, draftId, upload.filename, upload.contentType, upload.size, upload.objectKey, timestamp, draftId, userId,
				id, userId, draftId, lease, draftId, MAX_ATTACHMENT_COUNT, draftId, upload.size, maxBytes),
		env.DB.prepare(`UPDATE agent_draft_metadata SET revision = revision + 1, human_edited_at = ?
			WHERE draft_id = ? AND EXISTS (SELECT 1 FROM mail_attachment_uploads WHERE id = ? AND state = 'completing' AND lease_id = ?)
			AND EXISTS (SELECT 1 FROM message_attachments WHERE id = ? AND message_id = ?)`)
			.bind(timestamp, draftId, id, lease, id, draftId),
		env.DB.prepare(`DELETE FROM mail_attachment_uploads WHERE id = ? AND user_id = ?
			AND state = 'completing' AND lease_id = ?
			AND EXISTS (SELECT 1 FROM message_attachments WHERE id = ? AND message_id = ?)`).bind(id, userId, lease, id, draftId),
	]);
	const [stored] = await db.select().from(messageAttachments).where(and(eq(messageAttachments.id, id), eq(messageAttachments.messageId, draftId))).limit(1);
	if (!stored) throw new MailUploadError("Draft attachments exceed the outgoing size limit", 413);
	return { id: stored.id, filename: stored.filename, size: stored.size, type: stored.contentType, disposition: stored.disposition };
	} catch (error) {
		await releaseClaim(env, id, "completing", lease);
		throw error;
	}
}

export async function cancelMailAttachmentUpload(env: CloudflareEnv, userId: string, draftId: string, id: string) {
	await discard(env, await pendingUpload(env, userId, draftId, id));
}
