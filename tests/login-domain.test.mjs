import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const bundleDirectory = mkdtempSync(join(root, "node_modules", "mailflare-login-domain-"));
await build({
	entryPoints: [join(root, "src/lib/auth/login-domain-utils.ts")],
	bundle: true,
	format: "esm",
	platform: "neutral",
	outfile: join(bundleDirectory, "login-domain-utils.mjs"),
});
const { completeLoginEmail, shortLoginName } = await import(pathToFileURL(join(bundleDirectory, "login-domain-utils.mjs")).href);
test.after(() => rmSync(bundleDirectory, { recursive: true, force: true }));

test("a bare sign-in name gets the login domain", () => {
	assert.equal(completeLoginEmail(" liss ", "smjtools.com"), "liss@smjtools.com");
});

test("a full address is taken as typed, on any domain", () => {
	assert.equal(completeLoginEmail("liss@smjtools.com", "smjtools.com"), "liss@smjtools.com");
	assert.equal(completeLoginEmail(" a@other.example ", "smjtools.com"), "a@other.example");
});

test("without a login domain the name is left alone", () => {
	assert.equal(completeLoginEmail("liss", null), "liss");
	assert.equal(completeLoginEmail("   ", "smjtools.com"), "");
});

test("a stored address on the login domain shows as the bare name", () => {
	assert.equal(shortLoginName("liss@smjtools.com", "smjtools.com"), "liss");
	assert.equal(shortLoginName("liss@SMJtools.com", "smjtools.com"), "liss");
	assert.equal(shortLoginName("a@other.example", "smjtools.com"), "a@other.example");
	assert.equal(shortLoginName("liss", null), "liss");
});
