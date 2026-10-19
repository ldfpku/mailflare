/**
 * Pure helpers for files sent in HuLa chats: names, types and the URLs HuLa
 * uploads to and loads from. HuLa's MinIO path asks for a presigned PUT URL and
 * a download URL, then sends the download URL in the message body; both point
 * at `/api/im/files/<id>/<name>` on our own origin.
 */

/** Workers accept request bodies up to 100 MB on the Free and Pro plans. */
export const IM_FILE_LIMIT_BYTES = 100 * 1024 * 1024;
export const IM_UPLOAD_TTL_MS = 30 * 60 * 1000;
export const IM_FILE_NAME_LIMIT = 120;
export const IM_FILES_PATH = "/api/im/files/";

const FILE_ID = /^[a-f0-9]{32}$/;

const TYPES_BY_EXTENSION: Record<string, string> = {
	png: "image/png",
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	gif: "image/gif",
	webp: "image/webp",
	avif: "image/avif",
	bmp: "image/bmp",
	mp3: "audio/mpeg",
	m4a: "audio/mp4",
	aac: "audio/aac",
	wav: "audio/wav",
	ogg: "audio/ogg",
	oga: "audio/ogg",
	opus: "audio/ogg",
	mp4: "video/mp4",
	m4v: "video/mp4",
	mov: "video/quicktime",
	webm: "video/webm",
	pdf: "application/pdf",
	txt: "text/plain; charset=utf-8",
	csv: "text/csv; charset=utf-8",
	json: "application/json",
};

/** A file name that is safe as one URL segment and as a download name: no separators, controls or leading dots. */
export function sanitizeImFileName(name: unknown): string {
	const raw = typeof name === "string" ? name : "";
	const base = raw.split(/[\\/]/).pop() ?? "";
	const cleaned = base
		.replace(/[\u0000-\u001f\u007f"<>|?*:]/g, "")
		.replace(/\s+/g, " ")
		.trim()
		.replace(/^\.+/, "");
	if (!cleaned) return "file";
	if (cleaned.length <= IM_FILE_NAME_LIMIT) return cleaned;
	const dot = cleaned.lastIndexOf(".");
	const extension = dot > 0 && cleaned.length - dot <= 10 ? cleaned.slice(dot) : "";
	return cleaned.slice(0, IM_FILE_NAME_LIMIT - extension.length) + extension;
}

/** The type a file is served with, from its extension; the uploader's Content-Type is not trusted. */
export function imFileContentType(fileName: string): string {
	const dot = fileName.lastIndexOf(".");
	const extension = dot >= 0 ? fileName.slice(dot + 1).toLowerCase() : "";
	return TYPES_BY_EXTENSION[extension] ?? "application/octet-stream";
}

export function isImFileId(value: unknown): value is string {
	return typeof value === "string" && FILE_ID.test(value);
}

export function imFileObjectKey(id: string): string {
	return `im-files/${id}`;
}

export function imFileUrl(origin: string, id: string, fileName: string): string {
	return `${origin}${IM_FILES_PATH}${id}/${encodeURIComponent(fileName)}`;
}

/**
 * The file id a message body's URL names, or null when the URL is not one of
 * our chat files. Message bodies only carry URLs we issued, so a client cannot
 * make others load an arbitrary address.
 */
export function imFileIdFromUrl(value: unknown, origin: string): string | null {
	if (typeof value !== "string" || !value.startsWith(`${origin}${IM_FILES_PATH}`)) return null;
	const [id, name, ...rest] = value.slice(origin.length + IM_FILES_PATH.length).split("?")[0].split("/");
	return rest.length === 0 && name && isImFileId(id) ? id : null;
}

export function randomHex(bytes: number): string {
	const buffer = crypto.getRandomValues(new Uint8Array(bytes));
	return Array.from(buffer, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(value: string): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Compares two equal-length hex digests without stopping at the first difference. */
export function digestsMatch(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let difference = 0;
	for (let index = 0; index < a.length; index++) difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
	return difference === 0;
}
