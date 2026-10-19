import { parseByteRange } from "@/lib/drive/content";
import { driveContentDisposition } from "@/lib/drive/utils";
import { getInlineContentType } from "@/lib/http/content-type";
import { ImChatError } from "./chat-utils";
import {
	IM_FILE_LIMIT_BYTES,
	IM_UPLOAD_TTL_MS,
	digestsMatch,
	imFileContentType,
	imFileObjectKey,
	imFileUrl,
	isImFileId,
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

/** The PUT that HuLa's Rust uploader sends to the URL from `createImUpload`; the body is streamed into the bucket. */
export async function receiveImUpload(env: Env, request: Request, id: string, token: string | null): Promise<Response> {
	const file = await findFile(env, id);
	if (!file) return text(404, "Upload not found");
	if (file.uploaded_at || !file.upload_token_hash) return text(409, "Already uploaded");
	if (!token || !digestsMatch(await sha256Hex(token), file.upload_token_hash)) return text(403, "Invalid upload token");
	if (!file.upload_expires_at || file.upload_expires_at < Date.now()) return text(410, "Upload link expired");
	const length = Number(request.headers.get("Content-Length"));
	if (!Number.isSafeInteger(length) || length < 0 || !request.body) return text(411, "Content-Length required");
	if (length > IM_FILE_LIMIT_BYTES) return text(413, "File too large");

	// Claim the token before writing, so two PUTs with the same link cannot both land.
	const claimed = await env.DB.prepare("UPDATE im_files SET upload_token_hash = NULL WHERE id = ? AND upload_token_hash = ?")
		.bind(id, file.upload_token_hash)
		.run();
	if (!claimed.meta?.changes) return text(409, "Already uploaded");
	try {
		const stored = await env.BUCKET.put(file.object_key, request.body, { httpMetadata: { contentType: file.content_type } });
		await env.DB.prepare("UPDATE im_files SET size = ?, uploaded_at = ? WHERE id = ?").bind(stored?.size ?? length, Date.now(), id).run();
	} catch (error) {
		await env.DB.prepare("UPDATE im_files SET upload_token_hash = ? WHERE id = ?").bind(file.upload_token_hash, id).run();
		throw error;
	}
	return new Response(null, { status: 200 });
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
export async function findUploadedImFile(env: Env, id: string): Promise<{ objectKey: string; fileName: string; contentType: string; size: number } | null> {
	const file = await findFile(env, id);
	if (!file?.uploaded_at || file.size === null) return null;
	return { objectKey: file.object_key, fileName: file.file_name, contentType: file.content_type, size: file.size };
}
