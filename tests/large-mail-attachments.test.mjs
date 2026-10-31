import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import test, { after } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const directory = mkdtempSync(join(root, "node_modules", "large-mail-test-"));
after(() => rmSync(directory, { recursive: true, force: true }));
await build({
	stdin: {
		contents: `
			export * from "./src/lib/email/attachment-uploads.ts";
			export { copyMessageAttachments, loadMessageAttachmentReferences } from "./src/lib/email/attachments.ts";
			export { prepareCloudflareAttachments } from "./src/lib/email/cloud-attachment-utils.ts";
			export { SqliteDatabase } from "./server/runtime/sqlite-database.ts";
			export { sendEmail, processOutboundQueue } from "./src/lib/email/send.ts";
			export { GET as getSharedFile } from "./src/app/api/shared-files/[id]/route.ts";
			export { HEAD as headSharedFile } from "./src/app/api/shared-files/[id]/route.ts";
			export { assertBackupTablesCoverDatabase, exportDatabaseRecords, restoreDatabaseRecords } from "./src/lib/backups/export.ts";
			export { requestAgentSend, confirmAgentSend } from "./src/lib/agent/approvals/utils.ts";
			export { editAgentDraft } from "./src/lib/agent/edit-draft.ts";
		`,
		resolveDir: root,
		loader: "ts",
	},
	outfile: join(directory, "test.mjs"),
	bundle: true,
	platform: "node",
	format: "esm",
	target: "node24",
	external: ["better-sqlite3", "drizzle-orm", "drizzle-orm/*"],
	alias: { "@": join(root, "src") },
	plugins: [{
		name: "mail-delivery-stubs",
		setup(builder) {
			const modules = {
				"@/lib/cloudflare": "export const getEnv = () => globalThis.mailTestEnv;",
				"@/lib/email/sender": "export const getAuthorizedSenderAddress = async (_, input) => ({ fromAddr: input.from, mailboxId: input.mailboxId });",
				"@/lib/contacts/service": "export const upsertContactFromAddress = async () => {};",
				"@/lib/email/webhooks": "export const dispatchWebhooks = async () => {};",
				"@/lib/mailboxes/audit": "export const createAuditLog = async () => {};",
				"@/lib/email/outbound-provider": `export const getOutboundProviderConfig = async () => ({ provider: "resend", apiKey: "test" });
					export const sendThroughProvider = async (_, __, message) => { globalThis.mailTestSent.push(message); return { messageId: "<test@example.test>" }; };`,
			};
			builder.onResolve({ filter: /.*/ }, ({ path }) => path in modules ? { path, namespace: "mail-test-stub" } : undefined);
			builder.onLoad({ filter: /.*/, namespace: "mail-test-stub" }, ({ path }) => ({ contents: modules[path], loader: "js" }));
		},
	}],
	logLevel: "silent",
});
const { SqliteDatabase, startMailAttachmentUpload, uploadMailAttachmentPart, completeMailAttachmentUpload,
	cancelMailAttachmentUpload, cleanExpiredAttachmentUploads, copyMessageAttachments, loadMessageAttachmentReferences, prepareCloudflareAttachments,
	sendEmail, processOutboundQueue, getSharedFile, headSharedFile, assertBackupTablesCoverDatabase, exportDatabaseRecords, restoreDatabaseRecords,
	requestAgentSend, confirmAgentSend, editAgentDraft } =
	await import(pathToFileURL(join(directory, "test.mjs")).href);

function fakeBucket() {
	const uploads = new Map();
	const objects = new Map();
	const bytes = new Uint8Array(8 * 1024 * 1024);
	const stream = (size) => new ReadableStream({
		start(controller) {
			for (let offset = 0; offset < size; offset += bytes.length) controller.enqueue(bytes.subarray(0, Math.min(bytes.length, size - offset)));
			controller.close();
		},
	});
	const api = {
		uploads, objects,
		async head(key) { const size = objects.get(key); return size === undefined ? null : { size }; },
		async get(key, options) {
			const size = objects.get(key);
			if (size === undefined) return null;
			const length = options?.range?.length ?? size;
			return { size, body: stream(length), async arrayBuffer() {
				if (length > 8 * 1024 * 1024) throw new Error("Large objects must be streamed");
				return new ArrayBuffer(length);
			} };
		},
		async put(key, body) {
			let size = 0;
			for await (const chunk of body) size += chunk.byteLength;
			objects.set(key, size);
			return { size };
		},
		async delete(key) { for (const item of Array.isArray(key) ? key : [key]) objects.delete(item); },
		async createMultipartUpload(key) {
			const id = crypto.randomUUID();
			uploads.set(id, { key, parts: new Map() });
			return api.resumeMultipartUpload(key, id);
		},
		resumeMultipartUpload(key, id) {
			return {
				uploadId: id,
				async uploadPart(partNumber, body) {
					const upload = uploads.get(id);
					if (!upload || upload.key !== key) throw new Error("upload missing");
					let size = 0;
					for await (const chunk of body) size += chunk.byteLength;
					upload.parts.set(partNumber, size);
					return { partNumber, etag: `part-${partNumber}` };
				},
				async complete(parts) {
					const upload = uploads.get(id);
					if (!upload) throw new Error("upload missing");
					const size = parts.reduce((total, part) => total + (upload.parts.get(part.partNumber) ?? 0), 0);
					objects.set(key, size);
					uploads.delete(id);
					return { size };
				},
				async abort() { if (!uploads.delete(id)) throw new Error("upload missing"); },
			};
		},
	};
	return api;
}

function fixture(t) {
	const db = new SqliteDatabase(":memory:");
	t.after(() => db.db.close());
	db.db.exec(`
		CREATE TABLE users (id TEXT PRIMARY KEY);
		CREATE TABLE messages (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, status TEXT NOT NULL);
		CREATE TABLE app_settings (id TEXT PRIMARY KEY, outbound_attachment_max_mb INTEGER NOT NULL);
		CREATE TABLE message_attachments (id TEXT PRIMARY KEY, message_id TEXT NOT NULL REFERENCES messages(id),
			filename TEXT NOT NULL, content_type TEXT NOT NULL, size INTEGER NOT NULL, disposition TEXT NOT NULL,
			content_id TEXT, r2_key TEXT NOT NULL UNIQUE, trashed_at INTEGER, created_at INTEGER NOT NULL);
		CREATE TABLE agent_draft_metadata (draft_id TEXT PRIMARY KEY, revision INTEGER NOT NULL, human_edited_at INTEGER);
		CREATE TABLE shared_attachment_links (id TEXT PRIMARY KEY, attachment_id TEXT NOT NULL UNIQUE REFERENCES message_attachments(id),
			expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL);
		CREATE TABLE mail_attachment_uploads (id TEXT PRIMARY KEY, draft_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
			user_id TEXT NOT NULL REFERENCES users(id), object_key TEXT NOT NULL, upload_id TEXT NOT NULL,
			filename TEXT NOT NULL, content_type TEXT NOT NULL, size INTEGER NOT NULL, part_size INTEGER NOT NULL,
			fingerprint TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'pending', lease_id TEXT, updated_at INTEGER NOT NULL);
		CREATE TABLE mail_attachment_upload_parts (upload_id TEXT NOT NULL REFERENCES mail_attachment_uploads(id) ON DELETE CASCADE,
			part_number INTEGER NOT NULL, etag TEXT NOT NULL, PRIMARY KEY (upload_id, part_number));
		INSERT INTO users VALUES ('u1'), ('u2');
		INSERT INTO messages VALUES ('draft1', 'u1', 'draft'), ('sent1', 'u1', 'queued');
		INSERT INTO app_settings VALUES ('default', 500);
	`);
	return { DB: db, BUCKET: fakeBucket(), APP_URL: "https://mail.example.test" };
}

function partRequest(part, size) {
	const bytes = new Uint8Array(Math.min(size, 8 * 1024 * 1024));
	const body = new ReadableStream({ start(controller) { controller.enqueue(bytes); controller.close(); } });
	return new Request(`https://mail.example.test/upload?part=${part}`, {
		method: "PUT", headers: { "content-length": String(size) }, body, duplex: "half",
	});
}

test("500 MB uploads in bounded parts, survives completion retry, and becomes a downloadable link", async (t) => {
	const env = fixture(t);
	const size = 500_000_000;
	const input = { name: "项目📎.bin", size, contentType: "application/octet-stream", fingerprint: "file-1" };
	const session = await startMailAttachmentUpload(env, "u1", "draft1", input);
	assert.equal(session.parts, Math.ceil(size / session.partSize));
	assert.equal((await startMailAttachmentUpload(env, "u1", "draft1", input)).id, session.id);
	await assert.rejects(startMailAttachmentUpload(env, "u1", "draft1", { ...input, size: size + 1 }), /size limit/);
	await assert.rejects(uploadMailAttachmentPart(env, "u2", "draft1", session.id, partRequest(1, session.partSize)), /Draft not found/);
	await assert.rejects(completeMailAttachmentUpload(env, "u1", "draft1", session.id), /parts are missing/);
	for (let part = 1; part <= session.parts; part++) {
		const partSize = part < session.parts ? session.partSize : size - (session.parts - 1) * session.partSize;
		await uploadMailAttachmentPart(env, "u1", "draft1", session.id, partRequest(part, partSize));
	}
	const stored = await completeMailAttachmentUpload(env, "u1", "draft1", session.id);
	assert.equal(stored.size, size);
	assert.equal(stored.filename, "项目📎.bin");
	assert.deepEqual(await completeMailAttachmentUpload(env, "u1", "draft1", session.id), stored);
	await copyMessageAttachments(env, "draft1", "sent1");
	const references = await loadMessageAttachmentReferences(env, "sent1");
	assert.equal(references[0].size, size);
	const prepared = await prepareCloudflareAttachments(env, references, { subject: "File", headers: {} });
	assert.equal(prepared.attachments.length, 0);
	assert.match(prepared.text, /https:\/\/mail\.example\.test\/api\/shared-files\//);
	assert.match(prepared.text, /500\.0 MB/);
	assert.match(prepared.text, /项目📎\.bin/);
	assert.match(prepared.html, /aria-label="项目📎\.bin">↓<\/a>/);
	assert.doesNotMatch(prepared.html, />Download file<\/a>/);
});

test("rejects malformed parts and cancels an owned unfinished upload", async (t) => {
	const env = fixture(t);
	const session = await startMailAttachmentUpload(env, "u1", "draft1", { name: "x", size: 30_000_000, fingerprint: "x" });
	await assert.rejects(uploadMailAttachmentPart(env, "u1", "draft1", session.id, partRequest(1, 100)), /Invalid attachment part/);
	const short = partRequest(1, session.partSize);
	const shortBody = new Request(short.url, {
		method: "PUT", headers: { "content-length": String(session.partSize) },
		body: new Uint8Array(100), duplex: "half",
	});
	await assert.rejects(uploadMailAttachmentPart(env, "u1", "draft1", session.id, shortBody), /Invalid attachment part size/);
	assert.equal(env.DB.db.prepare("SELECT COUNT(*) AS count FROM mail_attachment_upload_parts").get().count, 0);
	await assert.rejects(cancelMailAttachmentUpload(env, "u2", "draft1", session.id), /Draft not found/);
	await cancelMailAttachmentUpload(env, "u1", "draft1", session.id);
	assert.equal(env.BUCKET.uploads.size, 0);
});

test("reserves the combined 500 MB limit across simultaneous files", async (t) => {
	const env = fixture(t);
	const first = await startMailAttachmentUpload(env, "u1", "draft1", { name: "a", size: 400_000_000, fingerprint: "a" });
	await startMailAttachmentUpload(env, "u1", "draft1", { name: "b", size: 100_000_000, fingerprint: "b" });
	await assert.rejects(startMailAttachmentUpload(env, "u1", "draft1", { name: "c", size: 1, fingerprint: "c" }), /size limit/);
	await cancelMailAttachmentUpload(env, "u1", "draft1", first.id);
	await startMailAttachmentUpload(env, "u1", "draft1", { name: "c", size: 1, fingerprint: "c" });
});

test("recovers if storage completes an upload but its response is lost", async (t) => {
	const env = fixture(t);
	const session = await startMailAttachmentUpload(env, "u1", "draft1", { name: "x", size: 10, fingerprint: "lost" });
	await uploadMailAttachmentPart(env, "u1", "draft1", session.id, partRequest(1, 10));
	const original = env.BUCKET.resumeMultipartUpload;
	let failOnce = true;
	env.BUCKET.resumeMultipartUpload = (key, id) => {
		const upload = original(key, id);
		const complete = upload.complete;
		upload.complete = async (parts) => {
			const result = await complete(parts);
			if (failOnce) { failOnce = false; throw new Error("response lost"); }
			return result;
		};
		return upload;
	};
	await assert.rejects(completeMailAttachmentUpload(env, "u1", "draft1", session.id), /response lost/);
	assert.equal((await completeMailAttachmentUpload(env, "u1", "draft1", session.id)).size, 10);
});

test("cannot cancel an upload while its completed file is being committed", async (t) => {
	const env = fixture(t);
	const session = await startMailAttachmentUpload(env, "u1", "draft1", { name: "x", size: 10, fingerprint: "race" });
	await uploadMailAttachmentPart(env, "u1", "draft1", session.id, partRequest(1, 10));
	const original = env.BUCKET.resumeMultipartUpload;
	let resume;
	let notifyStarted;
	const started = new Promise((resolve) => { notifyStarted = resolve; });
	env.BUCKET.resumeMultipartUpload = (key, id) => {
		const upload = original(key, id);
		const complete = upload.complete;
		upload.complete = async (parts) => {
			notifyStarted();
			await new Promise((resolve) => { resume = resolve; });
			return complete(parts);
		};
		return upload;
	};
	const completing = completeMailAttachmentUpload(env, "u1", "draft1", session.id);
	await started;
	await assert.rejects(cancelMailAttachmentUpload(env, "u1", "draft1", session.id), /already being processed/);
	resume();
	assert.equal((await completing).size, 10);
	assert.equal(env.BUCKET.objects.size, 1);
});

test("expired unfinished uploads are removed without deleting completed attachments", async (t) => {
	const env = fixture(t);
	const session = await startMailAttachmentUpload(env, "u1", "draft1", { name: "x", size: 10, fingerprint: "stale" });
	env.DB.db.prepare("UPDATE mail_attachment_uploads SET updated_at = 1 WHERE id = ?").run(session.id);
	await cleanExpiredAttachmentUploads(env, new Date());
	assert.equal(env.BUCKET.uploads.size, 0);
	assert.equal(env.DB.db.prepare("SELECT COUNT(*) AS count FROM mail_attachment_uploads").get().count, 0);
});

test("copying selected attachments does not copy unrelated files", async (t) => {
	const env = fixture(t);
	const insert = env.DB.db.prepare(`INSERT INTO message_attachments
		(id, message_id, filename, content_type, size, disposition, r2_key, created_at)
		VALUES (?, 'draft1', ?, 'application/octet-stream', 10, 'attachment', ?, 1)`);
	insert.run("a1", "one", "one");
	insert.run("a2", "two", "two");
	env.BUCKET.objects.set("one", 10);
	env.BUCKET.objects.set("two", 10);
	await copyMessageAttachments(env, "draft1", "sent1", ["a2"]);
	assert.deepEqual((await loadMessageAttachmentReferences(env, "sent1")).map((item) => item.filename), ["two"]);
	await assert.rejects(copyMessageAttachments(env, "draft1", "sent1", ["missing"]), /unavailable/);
});

test("sending and scheduled delivery preserve a 500 MB file after its draft is removed", async (t) => {
	const db = new SqliteDatabase(":memory:");
	t.after(() => db.db.close());
	db.db.pragma("foreign_keys = OFF");
	const { migrations } = JSON.parse(readFileSync(join(root, "src/lib/migrations/bundle.json"), "utf8"));
	for (const migration of migrations) for (const statement of migration.statements) db.db.exec(statement);
	db.db.pragma("foreign_keys = ON");
	db.db.exec(`
		INSERT INTO users (id, email, password_hash, name, created_at) VALUES ('u1', 'user@example.test', 'hash', 'User', 1);
		INSERT INTO domains (id, user_id, hostname, zone_id, created_at) VALUES ('dom1', 'u1', 'example.test', 'zone', 1);
		INSERT INTO mailboxes (id, user_id, domain_id, local_part, created_at) VALUES ('box1', 'u1', 'dom1', 'user', 1);
		INSERT INTO messages (id, user_id, mailbox_id, direction, from_addr, to_addr, status, created_at)
			VALUES ('draft1', 'u1', 'box1', 'outbound', 'user@example.test', 'receiver@example.test', 'draft', 1);
		INSERT INTO message_attachments (id, message_id, filename, content_type, size, disposition, r2_key, created_at)
			VALUES ('att-source', 'draft1', '项目📎 O''Brien.bin', 'application/octet-stream', 500000000, 'attachment', 'draft/source', 1);
		INSERT INTO messages (id, user_id, mailbox_id, direction, from_addr, to_addr, subject, status, created_at)
			VALUES ('agent-draft', 'u1', 'box1', 'outbound', 'user@example.test', 'receiver@example.test', 'Large file', 'draft', 1);
		INSERT INTO message_attachments (id, message_id, filename, content_type, size, disposition, r2_key, created_at)
			VALUES ('agent-att', 'agent-draft', 'agent.bin', 'application/octet-stream', 500000000, 'attachment', 'draft/agent', 1);
		INSERT INTO agent_draft_metadata (draft_id, mailbox_id, origin, revision, created_at) VALUES ('agent-draft', 'box1', 'chat', 1, 1);
		INSERT INTO messages (id, user_id, mailbox_id, direction, from_addr, to_addr, subject, status, created_at)
			VALUES ('small-draft', 'u1', 'box1', 'outbound', 'user@example.test', 'receiver@example.test', 'File', 'draft', 1);
		INSERT INTO message_attachments (id, message_id, filename, content_type, size, disposition, r2_key, created_at)
			VALUES ('small-att', 'small-draft', 'small.bin', 'application/octet-stream', 10, 'attachment', 'draft/small', 1);
	`);
	assert.equal(db.db.prepare("SELECT outbound_attachment_max_mb AS size FROM app_settings WHERE id = 'default'").get().size, 500);
	const queued = [];
	const env = { DB: db, BUCKET: fakeBucket(), APP_URL: "https://mail.example.test", OUTBOUND_QUEUE: { send: async (message) => queued.push(message) } };
	env.BUCKET.objects.set("draft/source", 500_000_000);
	env.BUCKET.objects.set("draft/agent", 500_000_000);
	env.BUCKET.objects.set("draft/small", 10);
	globalThis.mailTestEnv = env;
	globalThis.mailTestSent = [];
	const context = { env, user: { id: "u1", role: "user", email: "user@example.test" }, mailboxId: "box1" };
	const edit = { draftId: "agent-draft", expectedRevision: 1, addAttachments: [{ sourceEmailId: "draft1", attachmentId: "att-source" }], removeAttachmentIds: ["agent-att"] };
	await assert.rejects(editAgentDraft({ ...context, user: { ...context.user, id: "other" } }, edit), /cannot edit drafts/i);
	assert.equal((await editAgentDraft(context, edit)).revision, 2);
	assert.equal((await loadMessageAttachmentReferences(env, "agent-draft"))[0].size, 500_000_000);
	const review = await requestAgentSend(env, { id: "u1" }, "agent-draft", 2);
	assert.equal(review.snapshot.attachments[0].size, 500_000_000);
	assert.equal(review.snapshot.attachments[0].digest.length, 64);
	assert.equal((await confirmAgentSend(env, { id: "u1" }, review.approvalId)).status, "sent");
	assert.match(globalThis.mailTestSent[0].text, /500\.0 MB/);
	globalThis.mailTestSent = [];
	const input = { userId: "u1", mailboxId: "box1", from: "user@example.test", to: "receiver@example.test", subject: "Large file", sourceDraftId: "draft1" };
	await sendEmail(env, { ...input, subject: "File", sourceDraftId: "small-draft" });
	assert.equal(globalThis.mailTestSent[0].text, " ");
	assert.equal(globalThis.mailTestSent[0].attachments[0].content.byteLength, 10);
	globalThis.mailTestSent = [];
	const sent = await sendEmail(env, input);
	assert.equal(globalThis.mailTestSent.length, 1);
	assert.equal(globalThis.mailTestSent[0].attachments.length, 0);
	const url = new URL(globalThis.mailTestSent[0].text.match(/https:\/\/\S+/)[0]);
	assert.equal(db.db.prepare("SELECT status FROM messages WHERE id = ?").get(sent.messageId).status, "sent");
	const scheduled = await sendEmail(env, { ...input, scheduledAt: new Date(Date.now() + 60_000) });
	assert.equal(scheduled.scheduled, true);
	const missing = await sendEmail(env, { ...input, scheduledAt: new Date(Date.now() + 60_000) });
	assert.equal(queued.length, 2);
	const missingKey = db.db.prepare("SELECT r2_key FROM message_attachments WHERE message_id = ?").get(missing.messageId).r2_key;
	await env.BUCKET.delete(missingKey);
	await env.BUCKET.delete("draft/source");
	db.db.prepare("DELETE FROM messages WHERE id = 'draft1'").run();
	const params = { params: Promise.resolve({ id: url.pathname.split("/").at(-1) }) };
	const getObject = env.BUCKET.get;
	let objectReads = 0;
	env.BUCKET.get = (...args) => { objectReads++; return getObject(...args); };
	const head = await headSharedFile(new Request(url, { method: "HEAD" }), params);
	assert.equal(head.status, 200);
	assert.equal(Number(head.headers.get("content-length")), 500_000_000);
	assert.equal(await head.text(), "");
	assert.match(head.headers.get("content-disposition"), /filename\*=UTF-8''/);
	assert.equal(objectReads, 0, "HEAD does not read or buffer the attachment body");
	const sentKey = db.db.prepare("SELECT r2_key FROM message_attachments WHERE message_id = ?").get(sent.messageId).r2_key;
	const savedSize = env.BUCKET.objects.get(sentKey);
	env.BUCKET.objects.delete(sentKey);
	assert.equal((await headSharedFile(new Request(url, { method: "HEAD" }), params)).status, 404);
	env.BUCKET.objects.set(sentKey, savedSize);
	const response = await getSharedFile(new Request(url), { params: Promise.resolve({ id: url.pathname.split("/").at(-1) }) });
	assert.equal(response.status, 200);
	assert.equal(Number(response.headers.get("content-length")), 500_000_000);
	assert.match(response.headers.get("content-disposition"), /filename\*=UTF-8''%E9%A1%B9%E7%9B%AE%F0%9F%93%8E%20O%27Brien\.bin/);
	let received = 0;
	for await (const chunk of response.body) received += chunk.byteLength;
	assert.equal(received, 500_000_000);
	db.db.prepare("UPDATE shared_attachment_links SET expires_at = 1 WHERE id = ?").run(url.pathname.split("/").at(-1));
	assert.equal((await getSharedFile(new Request(url), { params: Promise.resolve({ id: url.pathname.split("/").at(-1) }) })).status, 404);
	assert.equal((await headSharedFile(new Request(url, { method: "HEAD" }), params)).status, 404);
	await processOutboundQueue(env, { ...queued[0], scheduledAt: new Date(Date.now() - 1000).toISOString() });
	assert.equal(globalThis.mailTestSent.length, 2);
	assert.match(globalThis.mailTestSent[1].text, /500\.0 MB/);
	assert.equal(db.db.prepare("SELECT status FROM messages WHERE id = ?").get(scheduled.messageId).status, "sent");
	await assert.rejects(processOutboundQueue(env, { ...queued[1], scheduledAt: new Date(Date.now() - 1000).toISOString() }), /unavailable/);
	assert.equal(db.db.prepare("SELECT status FROM messages WHERE id = ?").get(missing.messageId).status, "failed");
	assert.equal(globalThis.mailTestSent.length, 2);
});

test("ten large attachments generate links in one database batch", async (t) => {
	const env = fixture(t);
	const insert = env.DB.db.prepare(`INSERT INTO message_attachments
		(id, message_id, filename, content_type, size, disposition, r2_key, created_at)
		VALUES (?, 'draft1', ?, 'application/octet-stream', 50000000, 'attachment', ?, 1)`);
	for (let index = 0; index < 10; index++) {
		const id = `att-${index}`;
		const key = `file-${index}`;
		insert.run(id, `${id}.bin`, key);
		env.BUCKET.objects.set(key, 50_000_000);
	}
	const batch = env.DB.batch.bind(env.DB);
	let calls = 0;
	env.DB.batch = async (statements) => { calls++; return batch(statements); };
	const refs = await loadMessageAttachmentReferences(env, "draft1");
	const first = await prepareCloudflareAttachments(env, refs, { subject: "files", headers: {} });
	assert.equal(calls, 1);
	assert.equal((first.text.match(/https:\/\/mail\.example\.test\/api\/shared-files\//g) ?? []).length, 10);
	const second = await prepareCloudflareAttachments(env, refs, { subject: "files", headers: {} });
	assert.equal(second.text, first.text);
});

test("the migration raises the old default, preserves custom limits, and keeps backups valid before and after", async (t) => {
	const db = new SqliteDatabase(":memory:");
	t.after(() => db.db.close());
	db.db.pragma("foreign_keys = OFF");
	const { migrations } = JSON.parse(readFileSync(join(root, "src/lib/migrations/bundle.json"), "utf8"));
	const latest = migrations.find((migration) => migration.name === "0095_mail_attachment_uploads.sql");
	assert.ok(latest);
	for (const migration of migrations.filter((item) => item !== latest)) for (const statement of migration.statements) db.db.exec(statement);
	db.db.prepare("UPDATE app_settings SET outbound_attachment_max_mb = 25 WHERE id = 'default'").run();
	db.db.prepare("INSERT INTO app_settings (id, outbound_attachment_max_mb, updated_at) VALUES ('custom', 42, 1)").run();
	await assertBackupTablesCoverDatabase(db);
	const before = await exportDatabaseRecords(db);
	await restoreDatabaseRecords(db, before.buffer);
	for (const statement of latest.statements) db.db.exec(statement);
	assert.equal(db.db.prepare("SELECT outbound_attachment_max_mb AS value FROM app_settings WHERE id = 'default'").get().value, 500);
	assert.equal(db.db.prepare("SELECT outbound_attachment_max_mb AS value FROM app_settings WHERE id = 'custom'").get().value, 42);
	await assertBackupTablesCoverDatabase(db);
	const after = await exportDatabaseRecords(db);
	await restoreDatabaseRecords(db, after.buffer);
	db.db.exec(`INSERT INTO users (id, email, password_hash, name, created_at) VALUES ('u1', 'user@example.test', 'hash', 'User', 1);
		INSERT INTO messages (id, user_id, direction, from_addr, to_addr, status, created_at)
			VALUES ('d1', 'u1', 'outbound', 'user@example.test', '', 'draft', 1);
		INSERT INTO mail_attachment_uploads (id, draft_id, user_id, object_key, upload_id, filename, content_type, size, part_size, fingerprint, updated_at)
			VALUES ('upload', 'd1', 'u1', 'key', 'pending', 'x', 'text/plain', 10, 10, 'x', 1);`);
	await assert.rejects(restoreDatabaseRecords(db, after.buffer), /uploads are unfinished/);
	assert.equal(db.db.prepare("SELECT COUNT(*) AS count FROM mail_attachment_uploads").get().count, 1);
});
