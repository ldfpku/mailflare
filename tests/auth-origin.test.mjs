import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import test, { after } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const directory = mkdtempSync(join(root, "node_modules", "auth-origin-test-"));
after(() => rmSync(directory, { recursive: true, force: true }));
await build({
	entryPoints: [join(root, "src/lib/auth/accounts.ts")],
	outfile: join(directory, "accounts.mjs"),
	bundle: true,
	platform: "node",
	format: "esm",
	packages: "external",
	alias: { "@": join(root, "src") },
	logLevel: "silent",
});
const { isSameOrigin } = await import(pathToFileURL(join(directory, "accounts.mjs")).href);

test("account switching checks the configured public origin behind a reverse proxy", () => {
	const request = (origin) => new Request("http://internal:3000/api/auth/switch", { headers: { Origin: origin } });
	assert.equal(isSameOrigin(request("https://mail.example.test"), "https://mail.example.test"), true);
	assert.equal(isSameOrigin(request("https://other.example.test"), "https://mail.example.test"), false);
	assert.equal(isSameOrigin(request("http://mail.example.test"), "https://mail.example.test"), false);
	assert.equal(isSameOrigin(request("https://mail.example.test:8443"), "https://mail.example.test"), false);
	assert.equal(isSameOrigin(request("null"), "https://mail.example.test"), false);
	assert.equal(isSameOrigin(request("https://mail.example.test"), "not a url"), false);
	assert.equal(isSameOrigin(request("http://internal:3000")), true);
	assert.equal(isSameOrigin(request("http://internal:3000"), "https://mail.example.test"), false);
	assert.equal(isSameOrigin(new Request("http://internal:3000/api/auth/switch")), true);
});
