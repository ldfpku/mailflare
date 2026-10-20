import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test, { after } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = mkdtempSync(join(tmpdir(), "mailflare-recipient-suggestions-"));
after(() => rmSync(outDir, { recursive: true, force: true }));
await build({
	entryPoints: [join(root, "src/components/compose/recipient-utils.ts")],
	outfile: join(outDir, "recipient-utils.mjs"),
	bundle: true,
	platform: "node",
	format: "esm",
	target: "node22",
	logLevel: "silent",
	alias: { "@": join(root, "src") },
	external: ["postal-mime"],
});
const { directorySuggestionEntries, shouldSuggestRecipients } = await import(pathToFileURL(join(outDir, "recipient-utils.mjs")).href);

test("the composer asks the directory only for a name being typed", () => {
	assert.equal(shouldSuggestRecipients("霞"), true);
	assert.equal(shouldSuggestRecipients(" wangxx "), true);
	assert.equal(shouldSuggestRecipients("lisi@smjtools.com"), true);
	assert.equal(shouldSuggestRecipients("   "), false);
	assert.equal(shouldSuggestRecipients("a@b.com, c@d.com"), false);
	assert.equal(shouldSuggestRecipients('"Kim" <kim@one.test>'), false);
});

test("suggestions skip people already added and carry the colleague's name", () => {
	const people = [
		{ name: "王小霞", email: "wangxx@smjtools.com", department: "", title: "" },
		{ name: "赵霞", email: "zhaox@smjtools.com", department: "生产制造部", title: "" },
	];
	const entries = directorySuggestionEntries(people, ["ZHAOX@smjtools.com"]);
	assert.deepEqual(entries.map(({ entry }) => entry), ['"王小霞" <wangxx@smjtools.com>']);
});
