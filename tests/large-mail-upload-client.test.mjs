import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import test, { after } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const directory = mkdtempSync(join(root, "node_modules", "mail-upload-client-test-"));
after(() => rmSync(directory, { recursive: true, force: true }));
await build({
	entryPoints: [join(root, "src/components/compose/attachment-upload.ts")],
	outfile: join(directory, "upload.mjs"),
	bundle: true,
	platform: "browser",
	format: "esm",
	plugins: [{
		name: "auth-stub",
		setup(builder) {
			builder.onResolve({ filter: /^@\/lib\/auth\/client$/ }, () => ({ path: "auth", namespace: "stub" }));
			builder.onLoad({ filter: /.*/, namespace: "stub" }, () => ({ contents: "export const authFetch = (...args) => globalThis.mailUploadFetch(...args)", loader: "js" }));
		},
	}],
	logLevel: "silent",
});
const { uploadLargeDraftAttachment, cancelLargeDraftAttachment } = await import(pathToFileURL(join(directory, "upload.mjs")).href);

test("the browser sends exactly 500 MB in bounded parts and reports real progress", async () => {
	const size = 500_000_000;
	const partSize = 8 * 1024 * 1024;
	const lengths = [];
	const progress = [];
	let starts = 0;
	globalThis.mailUploadFetch = async (url, init) => {
		if (url.endsWith("/uploads")) {
			starts++;
			return Response.json({ id: "att-1", partSize, parts: Math.ceil(size / partSize), uploaded: [] });
		}
		if (init.method === "PUT") { lengths.push(init.body.size); return Response.json({ ok: true }); }
		return Response.json({ attachment: { id: "att-1", filename: "large.bin", size, type: "application/octet-stream", disposition: "attachment" } });
	};
	const file = { name: "large.bin", size, type: "application/octet-stream", slice: (start, end) => ({ size: Math.min(end, size) - start }) };
	const result = await uploadLargeDraftAttachment("draft", file, "fingerprint", new Map(), (value) => progress.push(value), () => true);
	assert.equal(result.size, size);
	assert.equal(starts, 1);
	assert.equal(lengths.reduce((sum, length) => sum + length, 0), size);
	assert.ok(lengths.every((length) => length > 0 && length <= partSize));
	assert.equal(progress[0], 0);
	assert.equal(progress.at(-2), 99);
	assert.equal(progress.at(-1), 100);
});

test("retries completion without uploading or creating a second attachment", async () => {
	const sessions = new Map();
	let starts = 0;
	let parts = 0;
	let finishes = 0;
	globalThis.mailUploadFetch = async (url, init) => {
		if (url.endsWith("/uploads")) {
			starts++;
			return Response.json({ id: "att-1", partSize: 10, parts: 1, uploaded: [] });
		}
		if (init.method === "PUT") { parts++; return Response.json({ ok: true }); }
		finishes++;
		if (finishes === 1) throw new Error("connection lost after completion");
		return Response.json({ attachment: { id: "att-1", filename: "x", size: 10, type: "", disposition: "attachment" } });
	};
	const file = { name: "x", size: 10, type: "", slice: () => ({ size: 10 }) };
	await assert.rejects(uploadLargeDraftAttachment("draft", file, "fingerprint", sessions, () => {}, () => true), /connection lost/);
	await uploadLargeDraftAttachment("draft", file, "fingerprint", sessions, () => {}, () => true);
	assert.equal(starts, 1);
	assert.equal(parts, 1);
	assert.equal(finishes, 2);
});

test("does not continue sending parts after the account changes", async () => {
	let active = true;
	let parts = 0;
	globalThis.mailUploadFetch = async (url, init) => {
		if (url.endsWith("/uploads")) return Response.json({ id: "att-1", partSize: 10, parts: 2, uploaded: [] });
		if (init.method === "PUT") { parts++; active = false; return Response.json({ ok: true }); }
		throw new Error("unexpected request");
	};
	const file = { name: "x", size: 20, type: "", slice: () => ({ size: 10 }) };
	await assert.rejects(uploadLargeDraftAttachment("draft", file, "fingerprint", new Map(), () => {}, () => active), /account or draft changed/);
	assert.equal(parts, 1);
});

test("removing a pending file also removes a completed upload whose response was lost", async () => {
	const sessions = new Map([["fingerprint", { id: "att-1", partSize: 10, parts: 1, uploaded: new Set([1]) }]]);
	const calls = [];
	globalThis.mailUploadFetch = async (url) => {
		calls.push(url);
		return calls.length === 1 ? new Response(null, { status: 404 }) : Response.json({ ok: true });
	};
	await cancelLargeDraftAttachment("draft", "fingerprint", sessions);
	assert.equal(calls.length, 2);
	assert.match(calls[1], /attachments\/att-1$/);
	assert.equal(sessions.size, 0);
});
