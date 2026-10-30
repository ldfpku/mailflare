import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import test, { after } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const directory = mkdtempSync(join(root, "node_modules", "mail-hash-test-"));
after(() => rmSync(directory, { recursive: true, force: true }));
await build({
	entryPoints: [join(root, "src/lib/email/stream-hash.ts")], outfile: join(directory, "hash.mjs"),
	bundle: true, platform: "node", format: "esm", logLevel: "silent",
});
const { sha256Stream } = await import(pathToFileURL(join(directory, "hash.mjs")).href);

test("hashes 500 MB incrementally and checks the exact byte count", async () => {
	const bytes = new Uint8Array(8 * 1024 * 1024).fill(37);
	const total = 500_000_000;
	const expected = createHash("sha256");
	const stream = new ReadableStream({
		start(controller) {
			for (let offset = 0; offset < total; offset += bytes.length) {
				const chunk = bytes.subarray(0, Math.min(bytes.length, total - offset));
				expected.update(chunk);
				controller.enqueue(chunk);
			}
			controller.close();
		},
	});
	assert.equal(await sha256Stream(stream, total), expected.digest("hex"));
	await assert.rejects(sha256Stream(new Blob(["short"]).stream(), 6), /size does not match/);
});

test("incremental hashing runs in the configured Workers runtime", async (t) => {
	const script = await build({
		stdin: {
			contents: `import { sha256Stream } from "./src/lib/email/stream-hash.ts";
				export default { async fetch(request) { return new Response(await sha256Stream(request.body, Number(request.headers.get("content-length")))); } };`,
			resolveDir: root, loader: "ts",
		},
		bundle: true, write: false, platform: "browser", format: "esm", target: "es2022",
		external: ["cloudflare:workers", "node:*"], tsconfig: join(root, "tsconfig.json"), logLevel: "silent",
	});
	const mf = new Miniflare(convertV4MiniflareOptions({
		modules: true, script: script.outputFiles[0].text, compatibilityDate: "2026-05-20", compatibilityFlags: ["nodejs_compat"],
	}));
	t.after(() => mf.dispose());
	const data = new Uint8Array(9 * 1024 * 1024).fill(63);
	const response = await mf.dispatchFetch("http://localhost/", {
		method: "POST", headers: { "content-length": String(data.byteLength) }, body: data,
	});
	assert.equal(response.status, 200);
	assert.equal(await response.text(), createHash("sha256").update(data).digest("hex"));
});
