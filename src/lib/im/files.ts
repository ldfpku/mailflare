import { parseByteRange } from "@/lib/drive/content";
import { driveContentDisposition } from "@/lib/drive/utils";
import { getInlineContentType } from "@/lib/http/content-type";
import { ImChatError } from "./chat-utils";
import {
	IM_FILES_PATH,
	IM_FILE_LIMIT_BYTES,
	IM_MULTIPART_UPLOAD_TTL_MS,
	IM_SINGLE_UPLOAD_LIMIT_BYTES,
	IM_UPLOAD_PART_BYTES,
	IM_UPLOAD_TTL_MS,
	digestsMatch,
	imFileContentType,
	imFileCorsHeaders,
	imFileObjectKey,
	imFileUrl,
	imUnsentFileCutoff,
	imUploadPartSize,
	isImFileId,
	parseImUploadParts,
	randomHex,
	sanitizeImFileName,
	sha256Hex,
} from "./files-utils";

/**
 * Chat files live in `env.BUCKET` under `im-files/`, one `im_files` row each.
 * HuLa uploads with a plain PUT and loads images with `<img src>`, so neither
 * request carries its token: the upload URL holds a single-use token, and the
 * download URL's 128-bit random id is what grants access to a file.
 */
type Env = CloudflareEnv;

interface ImFileRow {
	id: string;
	uploader_id: string;
	object_key: string;
	file_name: string;
	content_type: string;
	size: number | null;
	upload_token_hash: string | null;
	upload_expires_at: number | null;
	uploaded_at: number | null;
	created_at: number;
}

/** HuLa's `ossToken`: where to PUT the file and the URL to send in the message once it is there. */
export async function createImUpload(env: Env, userId: string, fileName: unknown, origin: string) {
	const name = sanitizeImFileName(fileName);
	const id = randomHex(16);
	const token = randomHex(24);
	const now = Date.now();
	await env.DB.prepare(
		"INSERT INTO im_files (id, uploader_id, object_key, file_name, content_type, upload_token_hash, upload_expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
	)
		.bind(id, userId, imFileObjectKey(id), name, imFileContentType(name), await sha256Hex(token), now + IM_UPLOAD_TTL_MS, now)
		.run();
	const downloadUrl = imFileUrl(origin, id, name);
	return { uploadUrl: `${downloadUrl}?token=${token}`, downloadUrl, objectKey: imFileObjectKey(id), fileName: name };
}

async function findFile(env: Env, id: string): Promise<ImFileRow | null> {
	if (!isImFileId(id)) return null;
	return env.DB.prepare("SELECT * FROM im_files WHERE id = ?").bind(id).first<ImFileRow>();
}

const text = (status: number, message: string) => new Response(message, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });

/** The file behind an upload link that is still open, or the response that refuses it. */
async function openUpload(env: Env, id: string, token: string | null): Promise<{ file: ImFileRow & { upload_token_hash: string } } | { error: Response }> {
	const file = await findFile(env, id);
	if (!file) return { error: text(404, "Upload not found") };
	if (file.uploaded_at || !file.upload_token_hash) return { error: text(409, "Already uploaded") };
	if (!token || !digestsMatch(await sha256Hex(token), file.upload_token_hash)) return { error: text(403, "Invalid upload token") };
	if (!file.upload_expires_at || file.upload_expires_at < Date.now()) return { error: text(410, "Upload link expired") };
	return { file: file as ImFileRow & { upload_token_hash: string } };
}

/** Takes the upload token so only one request can finish the upload; false when another got there first. */
async function claimUpload(env: Env, file: ImFileRow & { upload_token_hash: string }): Promise<boolean> {
	const claimed = await env.DB.prepare("UPDATE im_files SET upload_token_hash = NULL WHERE id = ? AND upload_token_hash = ?")
		.bind(file.id, file.upload_token_hash)
		.run();
	return Boolean(claimed.meta?.changes);
}

async function releaseUpload(env: Env, file: ImFileRow & { upload_token_hash: string }): Promise<void> {
	await env.DB.prepare("UPDATE im_files SET upload_token_hash = ? WHERE id = ?").bind(file.upload_token_hash, file.id).run();
}

/**
 * The PUT that HuLa's uploaders send to the URL from `createImUpload`; the body is streamed into the bucket.
 * With `uploadId` and `partNumber` it is one part of a larger file instead (see `startImMultipartUpload`).
 */
export async function receiveImUpload(env: Env, request: Request, id: string, token: string | null): Promise<Response> {
	const opened = await openUpload(env, id, token);
	if ("error" in opened) return opened.error;
	const { file } = opened;
	const params = new URL(request.url).searchParams;
	const uploadId = params.get("uploadId");
	const length = Number(request.headers.get("Content-Length"));
	if (!Number.isSafeInteger(length) || length < 0 || !request.body) return text(411, "Content-Length required");
	if (uploadId) return receiveImUploadPart(env, request, file, uploadId, Number(params.get("partNumber")), length);
	if (length > IM_SINGLE_UPLOAD_LIMIT_BYTES) return text(413, "File too large");

	// Claim the token before writing, so two PUTs with the same link cannot both land.
	if (!(await claimUpload(env, file))) return text(409, "Already uploaded");
	try {
		const stored = await env.BUCKET.put(file.object_key, request.body, { httpMetadata: { contentType: file.content_type } });
		await env.DB.prepare("UPDATE im_files SET size = ?, uploaded_at = ? WHERE id = ?").bind(stored?.size ?? length, Date.now(), id).run();
	} catch (error) {
		await releaseUpload(env, file);
		throw error;
	}
	return new Response(null, { status: 200 });
}

/**
 * `POST <upload URL>&uploads&size=<bytes>`: starts sending a file too large for one request, in parts of
 * `partSize`. The declared size is kept in `size` until the upload completes (`uploaded_at` stays null till then),
 * and the link stays open long enough for a slow connection. Clients send files of one part as a plain PUT.
 */
export async function startImMultipartUpload(env: Env, request: Request, id: string, token: string | null): Promise<Response> {
	const opened = await openUpload(env, id, token);
	if ("error" in opened) return opened.error;
	const { file } = opened;
	const size = Number(new URL(request.url).searchParams.get("size"));
	if (!Number.isSafeInteger(size) || size < 1) return text(400, "size required");
	if (size > IM_FILE_LIMIT_BYTES) return text(413, "File too large");
	const upload = await env.BUCKET.createMultipartUpload(file.object_key, { httpMetadata: { contentType: file.content_type } });
	await env.DB.prepare("UPDATE im_files SET size = ?, upload_expires_at = ? WHERE id = ?")
		.bind(size, Date.now() + IM_MULTIPART_UPLOAD_TTL_MS, id)
		.run();
	return Response.json({ uploadId: upload.uploadId, partSize: IM_UPLOAD_PART_BYTES, parts: Math.ceil(size / IM_UPLOAD_PART_BYTES) });
}

async function receiveImUploadPart(env: Env, request: Request, file: ImFileRow, uploadId: string, partNumber: number, length: number): Promise<Response> {
	if (file.size === null) return text(409, "Upload not started");
	const expected = imUploadPartSize(file.size, partNumber);
	if (expected === null) return text(400, "Invalid part number");
	if (length !== expected) return text(400, "Invalid part size");
	let etag: string;
	try {
		etag = (await env.BUCKET.resumeMultipartUpload(file.object_key, uploadId).uploadPart(partNumber, request.body!)).etag;
	} catch {
		return text(404, "Upload not found");
	}
	return Response.json({ partNumber, etag });
}

/** `POST <upload URL>&uploadId=<id>` with `{ parts: [{ partNumber, etag }] }`: joins the parts into the file. */
export async function completeImMultipartUpload(env: Env, request: Request, id: string, token: string | null): Promise<Response> {
	const opened = await openUpload(env, id, token);
	if ("error" in opened) return opened.error;
	const { file } = opened;
	const uploadId = new URL(request.url).searchParams.get("uploadId");
	if (!uploadId || file.size === null) return text(409, "Upload not started");
	const parts = parseImUploadParts(await request.json().catch(() => null), file.size);
	if (!parts) return text(400, "Invalid part list");
	if (!(await claimUpload(env, file))) return text(409, "Already uploaded");
	let stored: { size: number } | null = null;
	try {
		stored = await env.BUCKET.resumeMultipartUpload(file.object_key, uploadId).complete(parts);
	} catch {
		await releaseUpload(env, file);
		return text(400, "Could not complete the upload");
	}
	if (stored?.size !== file.size) {
		await env.BUCKET.delete(file.object_key).catch(() => undefined);
		await releaseUpload(env, file);
		return text(400, "Uploaded size does not match");
	}
	await env.DB.prepare("UPDATE im_files SET uploaded_at = ? WHERE id = ?").bind(Date.now(), id).run();
	return new Response(null, { status: 200 });
}

/** `DELETE <upload URL>&uploadId=<id>`: drops the parts sent so far; the link can start over. */
export async function abortImMultipartUpload(env: Env, request: Request, id: string, token: string | null): Promise<Response> {
	const opened = await openUpload(env, id, token);
	if ("error" in opened) return opened.error;
	const uploadId = new URL(request.url).searchParams.get("uploadId");
	if (!uploadId) return text(400, "uploadId required");
	await env.BUCKET.resumeMultipartUpload(opened.file.object_key, uploadId).abort().catch(() => undefined);
	return new Response(null, { status: 204 });
}

/** Serves a chat file with range support. Files never change, so clients may cache them for good. */
export async function serveImFile(env: Env, request: Request, id: string): Promise<Response> {
	const file = await findFile(env, id);
	if (!file?.uploaded_at || file.size === null) return text(404, "Not found");
	const download = new URL(request.url).searchParams.get("download") === "1";
	const inlineType = download ? null : getInlineContentType(file.content_type);
	const etag = `"${file.id}"`;
	const headers = new Headers({
		"Content-Type": inlineType ?? "application/octet-stream",
		"Content-Disposition": driveContentDisposition(file.file_name, inlineType !== null),
		"Accept-Ranges": "bytes",
		ETag: etag,
		"X-Content-Type-Options": "nosniff",
		"Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
		"Referrer-Policy": "no-referrer",
		"Cache-Control": "private, max-age=31536000, immutable",
		Vary: "Origin",
		...imFileCorsHeaders(request.headers.get("Origin")),
	});
	if (request.headers.get("If-None-Match") === etag) return new Response(null, { status: 304, headers });

	const ifRange = request.headers.get("If-Range");
	const range = ifRange && ifRange !== etag ? null : parseByteRange(request.headers.get("Range"), file.size);
	if (range === "invalid") {
		headers.set("Content-Range", `bytes */${file.size}`);
		return new Response(null, { status: 416, headers });
	}
	if (request.method === "HEAD") {
		headers.set("Content-Length", String(file.size));
		return new Response(null, { headers });
	}
	const object = range
		? await env.BUCKET.get(file.object_key, { range: { offset: range.start, length: range.end - range.start + 1 } })
		: await env.BUCKET.get(file.object_key);
	if (!object) return text(404, "Not found");
	if (!range) {
		headers.set("Content-Length", String(file.size));
		return new Response(object.body, { headers });
	}
	headers.set("Content-Range", `bytes ${range.start}-${range.end}/${file.size}`);
	headers.set("Content-Length", String(range.end - range.start + 1));
	return new Response(object.body, { status: 206, headers });
}

/** The CORS preflight the desktop client sends before a ranged download. */
export function preflightImFile(request: Request): Response {
	return new Response(null, { status: 204, headers: { Vary: "Origin", ...imFileCorsHeaders(request.headers.get("Origin"), true) } });
}

/** Message bodies may only point at uploaded chat files; this throws for anything else. */
export async function requireUploadedImFiles(env: Env, ids: string[]): Promise<void> {
	for (const id of new Set(ids)) {
		const file = await findFile(env, id);
		if (!file?.uploaded_at) throw new ImChatError(400, "文件未上传完成");
	}
}

/**
 * Copies a stored object to a new key without holding it in memory. Workers' R2 only takes a stream of known
 * length, which `FixedLengthStream` gives it; the B2 and Node buckets read any stream.
 */
export async function copyBucketObject(env: Env, fromKey: string, toKey: string, contentType: string): Promise<number> {
	const object = await env.BUCKET.get(fromKey);
	if (!object?.body) throw new ImChatError(404, "文件不存在");
	let body: ReadableStream = object.body;
	const Fixed = (globalThis as { FixedLengthStream?: new (length: number) => TransformStream }).FixedLengthStream;
	if (Fixed && typeof object.size === "number") {
		const fixed = new Fixed(object.size);
		object.body.pipeTo(fixed.writable).catch(() => undefined);
		body = fixed.readable;
	}
	const stored = await env.BUCKET.put(toKey, body, { httpMetadata: { contentType } });
	return stored?.size ?? object.size ?? 0;
}

/** A chat file made from an object already in the bucket (a Drive file sent into a chat); returns its download URL. */
export async function createImFileFromObject(
	env: Env,
	userId: string,
	sourceKey: string,
	fileName: unknown,
	origin: string,
): Promise<{ id: string; url: string; fileName: string; size: number; contentType: string }> {
	const name = sanitizeImFileName(fileName);
	const id = randomHex(16);
	const contentType = imFileContentType(name);
	const size = await copyBucketObject(env, sourceKey, imFileObjectKey(id), contentType);
	const now = Date.now();
	await env.DB.prepare(
		"INSERT INTO im_files (id, uploader_id, object_key, file_name, content_type, size, uploaded_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
	)
		.bind(id, userId, imFileObjectKey(id), name, contentType, size, now, now)
		.run();
	return { id, url: imFileUrl(origin, id, name), fileName: name, size, contentType };
}

/** The stored object behind an uploaded chat file. */
export async function findUploadedImFile(env: Env, id: string): Promise<{ objectKey: string; fileName: string; contentType: string; size: number; uploaderId: string } | null> {
	const file = await findFile(env, id);
	if (!file?.uploaded_at || file.size === null) return null;
	return { objectKey: file.object_key, fileName: file.file_name, contentType: file.content_type, size: file.size, uploaderId: file.uploader_id };
}

/** Matches a stored message body that points at the chat file `id` (a bound parameter or a column). */
function fileReferenceSql(column: string, id = "?"): string {
	return `instr(${column}, '${IM_FILES_PATH}' || ${id} || '/') > 0`;
}

/**
 * Removes chat files from the bucket and `im_files`, except those another message still points at (a forwarded
 * copy carries the same URL). `exceptMsgId` is the message the files are being taken out of. Returns the ids removed.
 */
export async function deleteImFilesUnlessShared(env: Env, ids: string[], exceptMsgId: number | null): Promise<string[]> {
	const removed: string[] = [];
	for (const id of new Set(ids)) {
		const file = await findFile(env, id);
		if (!file) continue;
		const shared = await env.DB.prepare(`SELECT 1 FROM im_messages WHERE id <> ? AND recalled_by IS NULL AND ${fileReferenceSql("body")} LIMIT 1`)
			.bind(exceptMsgId ?? -1, id)
			.first();
		if (shared) continue;
		await env.BUCKET.delete(file.object_key);
		await env.DB.prepare("DELETE FROM im_files WHERE id = ?").bind(id).run();
		removed.push(id);
	}
	return removed;
}

/**
 * The caller's uploads that never reached a message: a file picked and then not sent, an upload that failed half
 * way, or a test upload. Recent ones are left out, since their message may still be on its way.
 */
export async function listUnsentImFiles(env: Env, userId: string) {
	const result = await env.DB.prepare(
		`SELECT f.id, f.file_name, f.size, f.uploaded_at, f.created_at FROM im_files f
		WHERE f.uploader_id = ? AND f.created_at < ?
		AND NOT EXISTS (SELECT 1 FROM im_messages m WHERE ${fileReferenceSql("m.body", "f.id")})
		ORDER BY f.created_at LIMIT 500`,
	)
		.bind(userId, imUnsentFileCutoff(Date.now()))
		.all<Pick<ImFileRow, "id" | "file_name" | "size" | "uploaded_at" | "created_at">>();
	return result.results.map((row) => ({
		id: row.id,
		fileName: row.file_name,
		size: row.size ?? 0,
		uploaded: row.uploaded_at !== null,
		createdAt: row.created_at,
	}));
}

/** Deletes some of the caller's unsent uploads (see `listUnsentImFiles`); ids that are not one of them are skipped. */
export async function deleteUnsentImFiles(env: Env, userId: string, ids: unknown): Promise<{ deleted: string[] }> {
	if (!Array.isArray(ids) || ids.length > 100) throw new ImChatError(400, "请选择要删除的文件");
	const unsent = new Set((await listUnsentImFiles(env, userId)).map((file) => file.id));
	const chosen = ids.filter((id): id is string => typeof id === "string" && unsent.has(id));
	return { deleted: await deleteImFilesUnlessShared(env, chosen, null) };
}
