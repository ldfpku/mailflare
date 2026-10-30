import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const bundle = await build({
	stdin: {
		contents: `
			import { ImUserHub as BaseHub } from "./src/lib/im/hub.ts";
			import { triggerPendingUserState, retryPendingUserStates } from "./src/lib/im/state-outbox.ts";
			import { scheduleImMinuteTasks } from "./src/lib/im/scheduled.ts";
			export class ImUserHub extends BaseHub {
				async fetch(request) {
					const path = new URL(request.url).pathname;
					if (path !== "/notify") return super.fetch(request);
					const event = await request.json();
					const control = await this.env.DB.prepare("SELECT fail, gate FROM test_control WHERE id = 1").first();
					if (control.fail && event.type === "presenceChanged") return new Response(null, { status: 503 });
					if (control.gate && event.type === "userStateChange" && event.data.userStateId === "2") {
						await this.env.DB.prepare("INSERT INTO test_events (target, payload) VALUES (?, ?)").bind("gate", "{}").run();
						while ((await this.env.DB.prepare("SELECT gate FROM test_control WHERE id = 1").first()).gate) {
							await new Promise((resolve) => setTimeout(resolve, 20));
						}
					}
					await this.env.DB.prepare("INSERT INTO test_events (target, payload) VALUES (?, ?)").bind(this.ctx.id.toString(), JSON.stringify(event)).run();
					return new Response(null, { status: 204 });
				}
			}
			export default {
				scheduled(controller, env, ctx) {
					if (controller.cron === "* * * * *") scheduleImMinuteTasks(env, ctx);
				},
				async fetch(request, env) {
					try {
						if (new URL(request.url).pathname === "/retry") await retryPendingUserStates(env);
						else await triggerPendingUserState(env, "u1");
						return new Response(null, { status: 204 });
					} catch { return new Response(null, { status: 503 }); }
				}
			};
		`,
		resolveDir: root,
		sourcefile: "state-outbox-runtime.ts",
	},
	bundle: true,
	write: false,
	platform: "browser",
	format: "esm",
	target: "es2022",
	external: ["cloudflare:workers", "node:*"],
	tsconfig: join(root, "tsconfig.json"),
	plugins: [{
		name: "test-todo-schedule",
		setup(builder) {
			builder.onResolve({ filter: /^\.\/todo-reminders$/ }, (args) =>
				args.importer.endsWith("scheduled.ts") ? { path: "todo", namespace: "test-stub" } : undefined,
			);
			builder.onLoad({ filter: /.*/, namespace: "test-stub" }, () => ({
				contents: 'export async function runTodoReminders(env) { await env.DB.prepare("INSERT INTO test_events (target, payload) VALUES (?, ?)").bind("scheduled-todo", "{}").run(); }',
				loader: "js",
			}));
		},
	}],
	logLevel: "silent",
});

async function fixture(t) {
	const mf = new Miniflare(convertV4MiniflareOptions({
		modules: true,
		script: bundle.outputFiles[0].text,
		compatibilityDate: "2026-05-20",
		compatibilityFlags: ["nodejs_compat"],
		durableObjects: { IM_HUB: { className: "ImUserHub", useSQLite: true } },
		d1Databases: { DB: "state-outbox-runtime" },
	}));
	t.after(() => mf.dispose());
	const db = await mf.getD1Database("DB");
	for (const sql of [
		"CREATE TABLE users (id TEXT PRIMARY KEY, im_state_id TEXT NOT NULL, disabled INTEGER NOT NULL DEFAULT 0, deleted_at INTEGER)",
		"CREATE TABLE im_state_outbox (user_id TEXT PRIMARY KEY, revision INTEGER NOT NULL, updated_at INTEGER NOT NULL)",
		"CREATE TABLE im_presence (user_id TEXT PRIMARY KEY, online INTEGER NOT NULL, visible_online INTEGER NOT NULL, last_opt_time INTEGER NOT NULL)",
		"CREATE TABLE im_rooms (id TEXT PRIMARY KEY, type INTEGER NOT NULL)",
		"CREATE TABLE im_room_members (room_id TEXT NOT NULL, user_id TEXT NOT NULL)",
		"CREATE TABLE test_control (id INTEGER PRIMARY KEY, fail INTEGER NOT NULL, gate INTEGER NOT NULL)",
		"CREATE TABLE test_events (id INTEGER PRIMARY KEY AUTOINCREMENT, target TEXT NOT NULL, payload TEXT NOT NULL)",
		"INSERT INTO users (id, im_state_id) VALUES ('u1', '1'), ('u2', '1')",
		"INSERT INTO im_presence VALUES ('u1', 1, 1, 1), ('u2', 1, 1, 1)",
		"INSERT INTO im_rooms VALUES ('room', 1)",
		"INSERT INTO im_room_members VALUES ('room', 'u1'), ('room', 'u2')",
		"INSERT INTO test_control VALUES (1, 0, 0)",
	]) await db.prepare(sql).run();
	return { mf, db };
}

test("Workers runtime replays an invisible transition after a recipient failure", async (t) => {
	const { mf, db } = await fixture(t);
	await db.prepare("UPDATE users SET im_state_id = '5' WHERE id = 'u1'").run();
	await db.prepare("INSERT INTO im_state_outbox VALUES ('u1', 1, 1)").run();
	await db.prepare("UPDATE test_control SET fail = 1").run();
	assert.equal((await mf.dispatchFetch("http://local/sync")).status, 503);
	assert.ok(await db.prepare("SELECT revision FROM im_state_outbox WHERE user_id = 'u1'").first());
	assert.equal((await db.prepare("SELECT visible_online FROM im_presence WHERE user_id = 'u1'").first()).visible_online, 0);
	await db.prepare("UPDATE test_control SET fail = 0").run();
	await db.prepare("DELETE FROM test_events").run();
	const scheduled = await (await mf.getWorker()).scheduled({ cron: "* * * * *" });
	assert.equal(scheduled.outcome, "ok");
	assert.ok(await db.prepare("SELECT id FROM test_events WHERE target = 'scheduled-todo'").first());
	assert.equal(await db.prepare("SELECT revision FROM im_state_outbox WHERE user_id = 'u1'").first(), null);
	const events = (await db.prepare("SELECT payload FROM test_events").all()).results.map((row) => JSON.parse(row.payload));
	assert.ok(events.some((event) => event.type === "userStateChange" && event.data.userStateId === "5"));
	assert.ok(events.some((event) => event.type === "userStateChange" && event.data.userStateId === "1"));
	assert.ok(events.some((event) => event.type === "presenceChanged" && event.data.activeStatus === 2));
});

test("concurrent state changes are serialized and a newer revision is not lost", async (t) => {
	const { mf, db } = await fixture(t);
	await db.prepare("UPDATE users SET im_state_id = '2' WHERE id = 'u1'").run();
	await db.prepare("INSERT INTO im_state_outbox VALUES ('u1', 1, 1)").run();
	await db.prepare("UPDATE test_control SET gate = 1").run();
	const first = mf.dispatchFetch("http://local/sync");
	const deadline = Date.now() + 10_000;
	while (!(await db.prepare("SELECT id FROM test_events WHERE target = 'gate'").first())) {
		if (Date.now() > deadline) assert.fail("state delivery did not reach the test gate");
		await sleep(20);
	}
	await db.batch([
		db.prepare("UPDATE users SET im_state_id = '5' WHERE id = 'u1'"),
		db.prepare("UPDATE im_state_outbox SET revision = 2 WHERE user_id = 'u1'"),
		db.prepare("UPDATE test_control SET gate = 0"),
	]);
	const second = mf.dispatchFetch("http://local/sync");
	assert.equal((await first).status, 204);
	assert.equal((await second).status, 204);
	assert.equal(await db.prepare("SELECT revision FROM im_state_outbox WHERE user_id = 'u1'").first(), null);
	const events = (await db.prepare("SELECT payload FROM test_events WHERE target != 'gate' ORDER BY id").all()).results.map((row) => JSON.parse(row.payload));
	const states = events.filter((event) => event.type === "userStateChange").map((event) => event.data.userStateId);
	assert.deepEqual(states, ["2", "2", "5", "1"]);
});
