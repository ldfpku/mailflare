import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const bundleDirectory = mkdtempSync(join(root, "node_modules", "mailflare-send-json-bundle-"));
await build({
	stdin: {
		contents: `export { decodeJsonAttachments, parseSendRequest } from "./src/app/api/send/utils.ts";`,
		resolveDir: root,
		sourcefile: "send-json-test-entry.ts",
	},
	outfile: join(bundleDirectory, "entry.mjs"),
	bundle: true,
	platform: "node",
	format: "esm",
	target: "node24",
	tsconfig: join(root, "tsconfig.json"),
	packages: "external",
	alias: { "cloudflare:workers": "./server/runtime/cloudflare-workers.ts" },
	logLevel: "silent",
});
const { decodeJsonAttachments, parseSendRequest } = await import(pathToFileURL(join(bundleDirectory, "entry.mjs")).href);
rmSync(bundleDirectory, { recursive: true, force: true });

test("JSON sends decode contentBase64 into attachment bytes", async () => {
	const request = new Request("https://mail.example/api/send", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({
			from: "a@example.com",
			to: "b@example.com",
			subject: "Hi",
			attachments: [{ filename: "note.txt", type: "text/plain", contentBase64: Buffer.from("hello").toString("base64") }],
		}),
	});
	const payload = await parseSendRequest(request);
	assert.equal(payload.attachments.length, 1);
	assert.equal(payload.attachments[0].filename, "note.txt");
	assert.equal(payload.attachments[0].disposition, "attachment");
	assert.equal(new TextDecoder().decode(payload.attachments[0].content), "hello");
	assert.equal(payload.subject, "Hi");
});

test("JSON sends without attachments get an empty list", () => {
	assert.deepEqual(decodeJsonAttachments(undefined), []);
});

test("malformed JSON attachments are rejected instead of crashing the send", () => {
	assert.throws(() => decodeJsonAttachments([{ filename: "x.bin", content: "raw" }]));
	assert.throws(() => decodeJsonAttachments("nope"));
});
