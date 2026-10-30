import { and, eq, inArray, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { messageAttachments, messages } from "@/db/schema";
import { newId } from "@/lib/ids";
import { getMailboxAccessLevel } from "@/lib/mailboxes/access";
import type { SessionUser } from "@/lib/auth/types";
import type {
	AttachmentContent,
	AttachmentMetadata,
	AttachmentReference,
	StoredAttachment,
} from "./attachment-types";

export const MAX_ATTACHMENT_SIZE = 25_000_000;
export const MAX_TOTAL_ATTACHMENT_SIZE = 25_000_000;
export const MAX_ATTACHMENT_COUNT = 10;
const COPY_PART_SIZE = 8 * 1024 * 1024;
type CopyCapableBucket = R2Bucket & {
	copyObject?: (sourceKey: string, targetKey: string, options: { httpMetadata: { contentType: string }; customMetadata: Record<string, string> }) => Promise<void>;
};

export function decodeBase64Content(content: string): ArrayBuffer {
	const binary = atob(content.replace(/\s/g, ""));
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index += 1) {
		bytes[index] = binary.charCodeAt(index);
	}
	return bytes.buffer;
}

export function normalizeAttachmentContent(
	content: ArrayBuffer | Uint8Array | string,
	encoding?: "base64" | "utf8",
): ArrayBuffer {
	if (content instanceof ArrayBuffer) return content;
	if (content instanceof Uint8Array) {
		return content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength) as ArrayBuffer;
	}
	if (encoding === "base64") return decodeBase64Content(content);
	return new TextEncoder().encode(content).buffer;
}

function sanitizeFilename(filename: string): string {
	const normalized = Array.from(filename.trim().replace(/[\u0000-\u001f\u007f/\\]/g, "_")).slice(0, 255).join("");
	return normalized || "attachment";
}

export function validateAttachments(attachments: AttachmentContent[]): void {
	if (attachments.length > MAX_ATTACHMENT_COUNT) {
		throw new Error(`A message can include at most ${MAX_ATTACHMENT_COUNT} attachments`);
	}

	let totalSize = 0;
	for (const attachment of attachments) {
		const size = attachment.content.byteLength;
		if (size > MAX_ATTACHMENT_SIZE) {
			throw new Error(`${attachment.filename} exceeds the 25 MB attachment limit`);
		}
		totalSize += size;
	}

	if (totalSize > MAX_TOTAL_ATTACHMENT_SIZE) {
		throw new Error("Attachments exceed the 25 MB total limit");
	}
}

export async function storeMessageAttachments(
	env: CloudflareEnv,
	messageId: string,
	attachments: AttachmentContent[],
	options?: { validate?: boolean },
): Promise<StoredAttachment[]> {
	if (options?.validate !== false) validateAttachments(attachments);
	const db = getDb(env);
	const stored: StoredAttachment[] = [];

	try {
		for (const attachment of attachments) {
			const id = newId("att");
			const filename = sanitizeFilename(attachment.filename);
			const r2Key = `attachments/${messageId}/${id}`;
			const disposition = attachment.disposition ?? "attachment";

			await env.BUCKET.put(r2Key, attachment.content, {
				httpMetadata: { contentType: attachment.type },
				customMetadata: { messageId },
			});
			stored.push({
				id,
				messageId,
				filename,
				type: attachment.type,
				size: attachment.content.byteLength,
				disposition,
				contentId: attachment.contentId ?? null,
				r2Key,
			});
			await db.insert(messageAttachments).values({
				id,
				messageId,
				filename,
				contentType: attachment.type,
				size: attachment.content.byteLength,
				disposition,
				contentId: attachment.contentId ?? null,
				r2Key,
			});
		}
	} catch (error) {
		await Promise.all(stored.map((attachment) => env.BUCKET.delete(attachment.r2Key)));
		throw error;
	}

	return stored;
}

/**
 * Duplicate a message's attachments onto another message (a forward draft).
 * R2 keys are unique per row, so the objects are copied rather than shared,
 * which keeps deleting the draft from touching the original.
 */
export async function copyMessageAttachments(
	env: CloudflareEnv,
	fromMessageId: string,
	toMessageId: string,
	attachmentIds?: string[],
): Promise<AttachmentMetadata[]> {
	const db = getDb(env);
	if (attachmentIds?.length === 0) return [];
	const rows = await db.select().from(messageAttachments).where(and(eq(messageAttachments.messageId, fromMessageId),
		isNull(messageAttachments.trashedAt), attachmentIds ? inArray(messageAttachments.id, attachmentIds) : undefined));
	if (attachmentIds && rows.length !== new Set(attachmentIds).size) throw new Error("Attachment is unavailable");
	const copied: AttachmentMetadata[] = [];
	const keys: string[] = [];
	const inserts: D1PreparedStatement[] = [];
	try {
		for (const row of rows) {
			const id = newId("att");
			const r2Key = `attachments/${toMessageId}/${id}`;
			const metadata = { httpMetadata: { contentType: row.contentType }, customMetadata: { messageId: toMessageId } };
			keys.push(r2Key);
			const bucket: CopyCapableBucket = env.BUCKET;
			if (bucket.copyObject) {
				const source = await env.BUCKET.head(row.r2Key);
				if (!source || source.size !== row.size) throw new Error(`Attachment ${row.filename} is unavailable`);
				await bucket.copyObject(row.r2Key, r2Key, metadata);
				const copiedObject = await env.BUCKET.head(r2Key);
				if (!copiedObject || copiedObject.size !== row.size) throw new Error(`Attachment ${row.filename} could not be copied completely`);
			} else {
				const object = await env.BUCKET.get(row.r2Key);
				if (!object || object.size !== row.size) throw new Error(`Attachment ${row.filename} is unavailable`);
				const copiedObject = await env.BUCKET.put(r2Key, object.body, metadata);
				if (!copiedObject || copiedObject.size !== row.size) throw new Error(`Attachment ${row.filename} could not be copied completely`);
			}
			inserts.push(env.DB.prepare(`INSERT INTO message_attachments
				(id, message_id, filename, content_type, size, disposition, content_id, r2_key, created_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
				.bind(id, toMessageId, row.filename, row.contentType, row.size, row.disposition, row.contentId, r2Key, Math.floor(Date.now() / 1000)));
			copied.push({ id, messageId: toMessageId, filename: row.filename, type: row.contentType, size: row.size, disposition: row.disposition, contentId: row.contentId });
		}
		if (inserts.length) await env.DB.batch(inserts);
	} catch (error) {
		try {
			if (keys.length) await db.delete(messageAttachments).where(and(eq(messageAttachments.messageId, toMessageId), inArray(messageAttachments.r2Key, keys)));
			if (keys.length) await env.BUCKET.delete(keys);
		} catch (cleanupError) {
			throw new AggregateError([error, cleanupError], "Attachment copy and cleanup failed");
		}
		throw error;
	}
	return copied;
}

export async function loadMessageAttachmentReferences(
	env: CloudflareEnv,
	messageId: string,
): Promise<AttachmentReference[]> {
	const rows = await getDb(env).select().from(messageAttachments)
		.where(and(eq(messageAttachments.messageId, messageId), isNull(messageAttachments.trashedAt)));
	return rows.map((row) => ({ storageId: row.id, objectKey: row.r2Key, filename: row.filename, type: row.contentType, size: row.size, disposition: row.disposition, contentId: row.contentId }));
}

export async function loadSmallAttachment(env: CloudflareEnv, reference: AttachmentReference): Promise<AttachmentContent> {
	if (reference.size > COPY_PART_SIZE) throw new Error(`Attachment ${reference.filename} is unavailable`);
	const object = await env.BUCKET.get(reference.objectKey);
	if (!object || object.size !== reference.size) throw new Error(`Attachment ${reference.filename} is unavailable`);
	return { storageId: reference.storageId, filename: reference.filename, type: reference.type, content: await object.arrayBuffer(), disposition: reference.disposition, contentId: reference.contentId };
}

/** Remove one attachment (row and object). Returns false when it is not on that message. */
export async function deleteMessageAttachment(
	env: CloudflareEnv,
	messageId: string,
	attachmentId: string,
): Promise<boolean> {
	const db = getDb(env);
	const [row] = await db
		.select({ r2Key: messageAttachments.r2Key })
		.from(messageAttachments)
		.where(and(eq(messageAttachments.id, attachmentId), eq(messageAttachments.messageId, messageId)))
		.limit(1);
	if (!row) return false;
	await db.delete(messageAttachments).where(eq(messageAttachments.id, attachmentId));
	await env.BUCKET.delete(row.r2Key);
	return true;
}

/** Remove every attachment object of a message; the rows cascade with the message row. */
export async function deleteMessageAttachmentObjects(env: CloudflareEnv, messageId: string): Promise<void> {
	const db = getDb(env);
	const rows = await db
		.select({ r2Key: messageAttachments.r2Key })
		.from(messageAttachments)
		.where(eq(messageAttachments.messageId, messageId));
	await Promise.all(rows.map((row) => env.BUCKET.delete(row.r2Key)));
}

export async function listMessageAttachments(
	env: CloudflareEnv,
	messageId: string,
): Promise<AttachmentMetadata[]> {
	const db = getDb(env);
	const rows = await db
		.select()
		.from(messageAttachments)
		.where(and(eq(messageAttachments.messageId, messageId), isNull(messageAttachments.trashedAt)));

	return rows.map((attachment) => ({
		id: attachment.id,
		messageId: attachment.messageId,
		filename: attachment.filename,
		type: attachment.contentType,
		size: attachment.size,
		disposition: attachment.disposition as "attachment" | "inline",
		contentId: attachment.contentId,
	}));
}

export async function getAttachmentMetadataForUser(
	env: CloudflareEnv,
	user: SessionUser,
	messageId: string,
	attachmentId: string,
) {
	const db = getDb(env);
	const [message] = await db.select().from(messages).where(eq(messages.id, messageId)).limit(1);
	if (!message) return null;

	if (message.mailboxId) {
		const access = await getMailboxAccessLevel(db, user, message.mailboxId);
		if (!access?.canRead) return null;
	} else if (message.userId !== user.id) {
		return null;
	}

	const [attachment] = await db
		.select()
		.from(messageAttachments)
		.where(
			and(
				eq(messageAttachments.id, attachmentId),
				eq(messageAttachments.messageId, messageId),
				isNull(messageAttachments.trashedAt),
			),
		)
		.limit(1);
	if (!attachment) return null;

	return attachment;
}

export async function getAttachmentForUser(
	env: CloudflareEnv, user: SessionUser, messageId: string, attachmentId: string,
) {
	const attachment = await getAttachmentMetadataForUser(env, user, messageId, attachmentId);
	if (!attachment) return null;
	const object = await env.BUCKET.get(attachment.r2Key);
	if (!object) return null;
	return { attachment, object };
}
