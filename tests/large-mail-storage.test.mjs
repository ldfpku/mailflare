import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import test, { after } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const directory = mkdtempSync(join(root, "node_modules", "mail-storage-test-"));
after(() => rmSync(directory, { recursive: true, force: true }));
await build({
	stdin: { contents: `export { FileBucket } from "./server/runtime/file-bucket.ts"; export { B2Bucket } from "./src/lib/storage/b2-bucket.ts";`, resolveDir: root, loader: "ts" },
	outfile: join(directory, "storage.mjs"), bundle: true, platform: "node", format: "esm",
	external: ["better-sqlite3"], alias: { "@": join(root, "src") }, logLevel: "silent",
});
const { FileBucket, B2Bucket } = await import(pathToFileURL(join(directory, "storage.mjs")).href);

test("local file storage copies content and metadata without buffering the object", async () => {
	const bucket = new FileBucket(join(directory, "files"));
	const data = new Uint8Array(9 * 1024 * 1024).fill(42);
	await bucket.put("draft/file", data);
	await bucket.copyObject("draft/file", "sent/file", { httpMetadata: { contentType: "application/test" }, customMetadata: { messageId: "sent" } });
	const result = await bucket.get("sent/file");
	assert.equal(result.size, data.byteLength);
	assert.equal(result.httpMetadata.contentType, "application/test");
	assert.equal(result.customMetadata.messageId, "sent");
	assert.deepEqual(new Uint8Array(await result.arrayBuffer()), data);
});

test("S3-compatible storage performs a signed server-side object copy", async () => {
	const originalFetch = globalThis.fetch;
	const requests = [];
	globalThis.fetch = async (url, init) => {
		requests.push({ url: String(url), init });
		return new Response("<CopyObjectResult><ETag>copy</ETag></CopyObjectResult>", { status: 200 });
	};
	try {
		const bucket = new B2Bucket({ bucket: "test-bucket", endpoint: "s3.example.test", region: "us-east-1", keyId: "EXAMPLE", applicationKey: "test-secret" });
		await bucket.copyObject("draft/a b.txt", "sent/a b.txt", { httpMetadata: { contentType: "text/plain" }, customMetadata: { messageId: "sent" } });
		assert.equal(requests.length, 1);
		assert.match(requests[0].url, /sent\/a%20b\.txt$/);
		assert.equal(requests[0].init.headers["x-amz-copy-source"], "/test-bucket/draft/a%20b.txt");
		assert.equal(requests[0].init.headers["x-amz-metadata-directive"], "REPLACE");
		assert.equal(requests[0].init.body, "");
	} finally { globalThis.fetch = originalFetch; }
});

test("R2 binding streams an attachment copy inside a real Workers runtime", async (t) => {
	const script = await build({
		stdin: {
			contents: `import { copyMessageAttachments } from "./src/lib/email/attachments.ts";
				export default { async fetch(request, env) { await copyMessageAttachments(env, "draft", "sent"); return new Response("ok"); } };`,
			resolveDir: root, loader: "ts",
		},
		bundle: true, write: false, platform: "browser", format: "esm", target: "es2022",
		external: ["cloudflare:workers", "node:*"], tsconfig: join(root, "tsconfig.json"), logLevel: "silent",
	});
	const mf = new Miniflare(convertV4MiniflareOptions({
		modules: true, script: script.outputFiles[0].text, compatibilityDate: "2026-05-20",
		compatibilityFlags: ["nodejs_compat"], d1Databases: { DB: "large-copy-test" }, r2Buckets: { BUCKET: "large-copy-test" },
	}));
	t.after(() => mf.dispose());
	const db = await mf.getD1Database("DB");
	await db.prepare(`CREATE TABLE message_attachments (id TEXT PRIMARY KEY, message_id TEXT NOT NULL, filename TEXT NOT NULL,
		content_type TEXT NOT NULL, size INTEGER NOT NULL, disposition TEXT NOT NULL, content_id TEXT,
		r2_key TEXT NOT NULL UNIQUE, trashed_at INTEGER, created_at INTEGER NOT NULL)`).run();
	const data = new Uint8Array(9 * 1024 * 1024).fill(37);
	const bucket = await mf.getR2Bucket("BUCKET");
	await bucket.put("draft/file", data);
	await db.prepare(`INSERT INTO message_attachments (id, message_id, filename, content_type, size, disposition, r2_key, created_at)
		VALUES ('att1', 'draft', 'file.bin', 'application/octet-stream', ?, 'attachment', 'draft/file', 1)`).bind(data.byteLength).run();
	const response = await mf.dispatchFetch("http://localhost/copy");
	assert.equal(response.status, 200, await response.text());
	const row = await db.prepare("SELECT r2_key FROM message_attachments WHERE message_id = 'sent'").first();
	assert.deepEqual(new Uint8Array(await (await bucket.get(row.r2_key)).arrayBuffer()), data);
});

test("R2 accepts bounded multipart attachment streams in a real Workers runtime", async (t) => {
	const script = await build({
		stdin: {
			contents: `import { startMailAttachmentUpload, uploadMailAttachmentPart, completeMailAttachmentUpload } from "./src/lib/email/attachment-uploads.ts";
				export default { async fetch(request, env) {
					const url = new URL(request.url);
					if (url.pathname === "/start") return Response.json(await startMailAttachmentUpload(env, "u1", "draft", await request.json()));
					if (url.pathname === "/part") { await uploadMailAttachmentPart(env, "u1", "draft", url.searchParams.get("id"), request); return new Response("ok"); }
					return Response.json(await completeMailAttachmentUpload(env, "u1", "draft", url.searchParams.get("id")));
				} };`,
			resolveDir: root, loader: "ts",
		},
		bundle: true, write: false, platform: "browser", format: "esm", target: "es2022",
		external: ["cloudflare:workers", "node:*"], tsconfig: join(root, "tsconfig.json"), logLevel: "silent",
	});
	const mf = new Miniflare(convertV4MiniflareOptions({
		modules: true, script: script.outputFiles[0].text, compatibilityDate: "2026-05-20",
		compatibilityFlags: ["nodejs_compat"], d1Databases: { DB: "large-upload-test" }, r2Buckets: { BUCKET: "large-upload-test" },
	}));
	t.after(() => mf.dispose());
	const db = await mf.getD1Database("DB");
	for (const sql of [
		"CREATE TABLE users (id TEXT PRIMARY KEY)",
		"CREATE TABLE messages (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, status TEXT NOT NULL)",
		"CREATE TABLE app_settings (id TEXT PRIMARY KEY, outbound_attachment_max_mb INTEGER NOT NULL)",
		`CREATE TABLE message_attachments (id TEXT PRIMARY KEY, message_id TEXT NOT NULL, filename TEXT NOT NULL, content_type TEXT NOT NULL,
			size INTEGER NOT NULL, disposition TEXT NOT NULL, content_id TEXT, r2_key TEXT NOT NULL UNIQUE, trashed_at INTEGER, created_at INTEGER NOT NULL)`,
		"CREATE TABLE agent_draft_metadata (draft_id TEXT PRIMARY KEY, revision INTEGER NOT NULL, human_edited_at INTEGER)",
		`CREATE TABLE mail_attachment_uploads (id TEXT PRIMARY KEY, draft_id TEXT NOT NULL, user_id TEXT NOT NULL, object_key TEXT NOT NULL,
			upload_id TEXT NOT NULL, filename TEXT NOT NULL, content_type TEXT NOT NULL, size INTEGER NOT NULL, part_size INTEGER NOT NULL,
			fingerprint TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'pending', lease_id TEXT, updated_at INTEGER NOT NULL)`,
		"CREATE TABLE mail_attachment_upload_parts (upload_id TEXT NOT NULL, part_number INTEGER NOT NULL, etag TEXT NOT NULL, PRIMARY KEY (upload_id, part_number))",
		"INSERT INTO users VALUES ('u1')",
		"INSERT INTO messages VALUES ('draft', 'u1', 'draft')",
		"INSERT INTO app_settings VALUES ('default', 500)",
	]) await db.prepare(sql).run();
	const size = 9 * 1024 * 1024;
	const start = await mf.dispatchFetch("http://localhost/start", {
		method: "POST", headers: { "content-type": "application/json" },
		body: JSON.stringify({ name: "test.bin", size, contentType: "application/octet-stream", fingerprint: "test" }),
	});
	assert.equal(start.status, 200, await start.clone().text());
	const session = await start.json();
	const data = new Uint8Array(size).fill(91);
	for (let part = 1; part <= session.parts; part++) {
		const bytes = data.subarray((part - 1) * session.partSize, Math.min(part * session.partSize, size));
		const result = await mf.dispatchFetch(`http://localhost/part?id=${session.id}&part=${part}`, {
			method: "PUT", headers: { "content-length": String(bytes.length) }, body: bytes,
		});
		assert.equal(result.status, 200, await result.text());
	}
	const finish = await mf.dispatchFetch(`http://localhost/complete?id=${session.id}`);
	assert.equal(finish.status, 200, await finish.clone().text());
	assert.equal((await finish.json()).size, size);
	const row = await db.prepare("SELECT r2_key FROM message_attachments WHERE id = ?").bind(session.id).first();
	const bucket = await mf.getR2Bucket("BUCKET");
	assert.deepEqual(new Uint8Array(await (await bucket.get(row.r2_key)).arrayBuffer()), data);
});
