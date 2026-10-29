import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

test("upstream code-update workflow and endpoint stay removed", () => {
	assert.equal(existsSync(new URL(".github/workflows/deploy-update.yml", root)), false);
	assert.equal(existsSync(new URL("src/app/api/admin/update", root)), false);
});

test("runtime and deployment configuration do not request GitHub update credentials", () => {
	for (const path of ["package.json", ".dev.vars.example", "server/runtime/env.ts"]) {
		assert.doesNotMatch(read(path), /GITHUB_UPDATE_(TOKEN|REPO|REF)/, path);
	}
});

test("the admin card retains database migrations without code-update dispatch", () => {
	const helpers = read("src/components/admin-update-card-utils.ts");
	assert.match(helpers, /fetch\("\/api\/admin\/migrations", \{ cache: "no-store" \}\)/);
	assert.match(helpers, /fetch\("\/api\/admin\/migrations", \{ method: "POST" \}\)/);
	assert.doesNotMatch(helpers, /\/api\/admin\/update|api\.github\.com/);
	const card = read("src/components/admin-update-card.tsx");
	assert.match(card, /getMigrationStatus\(\)/);
	assert.match(card, /applyDatabaseMigrations\(\)/);
	assert.doesNotMatch(card, /\/api\/admin\/update|api\.github\.com/);
});
