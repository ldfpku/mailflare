import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import test, { after } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const directory = mkdtempSync(join(root, "node_modules", "mailflare-agent-quota-test-"));
after(() => rmSync(directory, { recursive: true, force: true }));
await build({
	stdin: {
		contents: `
			export { SqliteDatabase } from "./server/runtime/sqlite-database.ts";
			export { applyMigrations } from "./server/runtime/migrate.ts";
			export * from "./src/lib/agent/rate-limit.ts";
		`,
		resolveDir: root,
		sourcefile: "agent-quota-test-entry.ts",
	},
	outfile: join(directory, "entry.mjs"),
	bundle: true,
	platform: "node",
	format: "esm",
	target: "node22",
	tsconfig: join(root, "tsconfig.json"),
	packages: "external",
	alias: { "cloudflare:workers": "./server/runtime/cloudflare-workers.ts" },
	logLevel: "silent",
});
const { SqliteDatabase, applyMigrations, checkAgentLimits, allowAgentRequest, agentDailyLimits, agentLimitResponse, countAgentCall, secondsUntilUtcMidnight } = await import(pathToFileURL(join(directory, "entry.mjs")).href);

/** A Rate Limiting binding stand-in with a fixed verdict that records the keys it saw. */
function limiter(success) {
	const keys = [];
	return { keys, async limit({ key }) { keys.push(key); return { success }; } };
}

async function fixture(t, vars = {}, { migrate = true } = {}) {
	const database = new SqliteDatabase(":memory:");
	t.after(() => database.db.close());
	if (migrate) await applyMigrations(database, join(root, "drizzle/migrations"));
	return { DB: database, ...vars };
}

test("the per-user daily cap counts chat, MCP and summaries together and resets per UTC day", async (t) => {
	const env = await fixture(t, { AGENT_DAILY_LIMIT: "3" });
	for (const key of ["chat:u1", "mcp:key1", "im-ai:u1"]) assert.deepEqual(await checkAgentLimits(env, key, "user:u1"), { allowed: true });
	const refused = await checkAgentLimits(env, "chat:u1", "user:u1");
	assert.equal(refused.allowed, false);
	assert.equal(refused.reason, "user-daily");
	assert.equal(refused.limit, 3);
	assert.ok(refused.retryAfterSeconds >= 1 && refused.retryAfterSeconds <= 86_400);
	// Another person still has their own budget.
	assert.deepEqual(await checkAgentLimits(env, "chat:u2", "user:u2"), { allowed: true });
	assert.equal(await allowAgentRequest(env, "chat:u1", "user:u1"), false);
	// A call refused by the per-user cap is not charged to the global budget (the global counter is checked second).
	const rows = await env.DB.prepare("SELECT scope, day, count FROM ai_daily_counters ORDER BY scope").all();
	assert.deepEqual(rows.results.map((row) => [row.scope, row.count]), [["global", 4], ["user:u1", 5], ["user:u2", 1]]);
	assert.match(rows.results[0].day, /^\d{4}-\d{2}-\d{2}$/);
	// A new day starts a new row, so yesterday's refusals do not carry over.
	assert.equal(await countAgentCall(env, "user:u1", "2000-01-01"), 1);
});

test("the global daily cap applies across everyone, after the per-user cap", async (t) => {
	const env = await fixture(t, { AGENT_DAILY_LIMIT: "100", AGENT_DAILY_GLOBAL_LIMIT: "2" });
	assert.equal((await checkAgentLimits(env, "chat:a", "user:a")).allowed, true);
	assert.equal((await checkAgentLimits(env, "chat:b", "user:b")).allowed, true);
	const refused = await checkAgentLimits(env, "chat:c", "user:c");
	assert.deepEqual([refused.allowed, refused.reason, refused.limit], [false, "global-daily", 2]);
	const response = agentLimitResponse(refused);
	assert.equal(response.status, 429);
	assert.equal(response.headers.get("Retry-After"), String(refused.retryAfterSeconds));
	assert.equal((await response.json()).reason, "global-daily");
});

test("the per-minute binding is checked first and a refusal there does not touch the counters", async (t) => {
	const perMinute = limiter(false);
	const env = await fixture(t, { AGENT_RATE_LIMIT: perMinute });
	const refused = await checkAgentLimits(env, "chat:u1", "user:u1");
	assert.deepEqual(refused, { allowed: false, reason: "rate", retryAfterSeconds: 60 });
	assert.deepEqual(perMinute.keys, ["chat:u1"]);
	assert.equal((await env.DB.prepare("SELECT COUNT(*) AS n FROM ai_daily_counters").first()).n, 0);
	const broken = { async limit() { throw new Error("binding down"); } };
	assert.equal((await checkAgentLimits({ ...env, AGENT_RATE_LIMIT: broken }, "chat:u1", "user:u1")).reason, "rate");
});

test("defaults, disabling with 0, and ignoring malformed settings", async (t) => {
	assert.deepEqual(agentDailyLimits({}), { perUser: 200, global: 2000 });
	assert.deepEqual(agentDailyLimits({ AGENT_DAILY_LIMIT: "0", AGENT_DAILY_GLOBAL_LIMIT: "  " }), { perUser: 0, global: 2000 });
	assert.deepEqual(agentDailyLimits({ AGENT_DAILY_LIMIT: "lots", AGENT_DAILY_GLOBAL_LIMIT: "-5" }), { perUser: 200, global: 2000 });
	const env = await fixture(t, { AGENT_DAILY_LIMIT: "0", AGENT_DAILY_GLOBAL_LIMIT: "0" }, { migrate: false });
	// Both caps off: nothing is counted, so the missing table does not matter either.
	assert.deepEqual(await checkAgentLimits(env, "chat:u1", "user:u1"), { allowed: true });
	assert.ok(secondsUntilUtcMidnight(new Date("2026-10-20T23:59:30Z")) === 30);
	assert.ok(secondsUntilUtcMidnight(new Date("2026-10-20T00:00:00Z")) === 86_400);
});

test("a counter that cannot be read or written refuses the call instead of opening the cap", async (t) => {
	const env = await fixture(t, {}, { migrate: false });
	const refused = await checkAgentLimits(env, "chat:u1", "user:u1");
	assert.equal(refused.allowed, false);
	assert.equal(refused.reason, "user-daily");
});
