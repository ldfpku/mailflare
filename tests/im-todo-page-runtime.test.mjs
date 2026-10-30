import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const bundle = await build({
	stdin: {
		contents: `
			import { pageTodos, updateTodo } from "./src/lib/im/todos.ts";
			import { runTodoReminders } from "./src/lib/im/todo-reminders.ts";
			import { scheduleImMinuteTasks } from "./src/lib/im/scheduled.ts";
			export default {
				scheduled(controller, env, ctx) {
					if (controller.cron !== "* * * * *") return;
					const IM_HUB = { getByName: () => ({ fetch: async () => new Response(null, { status: 204 }) }) };
					scheduleImMinuteTasks({ DB: env.DB, IM_HUB }, ctx);
				},
				async fetch(request, env) {
					const url = new URL(request.url);
					if (url.pathname === "/reminders") {
						const IM_HUB = { getByName: () => ({ fetch: async () => new Response(null, { status: 204 }) }) };
						await runTodoReminders({ DB: env.DB, IM_HUB }, Number(url.searchParams.get("now")));
						return Response.json({ ok: true });
					}
					if (url.pathname === "/complete") {
						return Response.json(await updateTodo(env, "u1", { id: "todo_000", expectedVersion: 1, done: true }));
					}
					return Response.json(await pageTodos(env, "u1", url.searchParams));
				}
			};
		`,
		resolveDir: root,
		sourcefile: "todo-page-runtime-test.ts",
	},
	bundle: true,
	write: false,
	platform: "browser",
	format: "esm",
	target: "es2022",
	external: ["cloudflare:workers", "node:*"],
	tsconfig: join(root, "tsconfig.json"),
	logLevel: "silent",
});

test("to-do pages execute with the real Workers D1 binding", async (t) => {
	const mf = new Miniflare(convertV4MiniflareOptions({
		modules: true,
		script: bundle.outputFiles[0].text,
		compatibilityDate: "2026-05-20",
		compatibilityFlags: ["nodejs_compat"],
		d1Databases: { DB: "todo-page-runtime-test" },
	}));
	t.after(() => mf.dispose());
	const db = await mf.getD1Database("DB");
	await db.prepare("CREATE TABLE users (id TEXT PRIMARY KEY, disabled INTEGER NOT NULL DEFAULT 0, deleted_at INTEGER)").run();
	await db.prepare("CREATE TABLE drive_items (id TEXT PRIMARY KEY)").run();
	const migrations = ["0076_add_im_todos.sql", "0087_add_im_todo_paging_indexes.sql", "0088_add_im_todo_workspaces.sql", "0089_add_im_todo_reminders.sql", "0090_add_im_todo_recurrence.sql", "0091_add_im_todo_attachments.sql", "0092_add_im_todo_date_only.sql", "0093_add_im_todo_sort_indexes.sql", "0094_add_im_state_outbox.sql"];
	for (const migration of migrations) {
		const statements = readFileSync(join(root, "drizzle", "migrations", migration), "utf8").split("--> statement-breakpoint");
		for (const statement of statements) await db.prepare(statement).run();
	}
	const allPlan = await db.prepare("EXPLAIN QUERY PLAN SELECT id FROM im_todos WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT ?").bind("u1", 51).all();
	const openPlan = await db.prepare("EXPLAIN QUERY PLAN SELECT id FROM im_todos WHERE user_id = ? AND done = 0 ORDER BY created_at DESC, id DESC LIMIT ?").bind("u1", 51).all();
	assert.match(allPlan.results.map((row) => row.detail).join(" "), /im_todos_user_created_idx/);
	assert.match(openPlan.results.map((row) => row.detail).join(" "), /im_todos_user_done_created_idx/);
	await db.prepare("INSERT INTO users (id) VALUES ('u1'), ('u2')").run();
	const inserts = [];
	for (let i = 0; i < 205; i++) {
		inserts.push(db.prepare("INSERT INTO im_todos (id, user_id, title, created_at, updated_at) VALUES (?, 'u1', ?, ?, ?)")
			.bind(`todo_${String(i).padStart(3, "0")}`, `Task ${i}`, Math.floor(i / 3), 1));
	}
	inserts.push(db.prepare("INSERT INTO im_todos (id, user_id, title, created_at, updated_at) VALUES ('other', 'u2', 'Other', 1000, 1)"));
	await db.batch(inserts);

	const first = await (await mf.dispatchFetch("http://localhost/?status=all&pageSize=200")).json();
	assert.equal(first.items.length, 200);
	assert.equal(first.hasMore, true);
	const next = new URL("http://localhost/");
	next.searchParams.set("status", "all");
	next.searchParams.set("pageSize", "200");
	next.searchParams.set("cursor", first.nextCursor);
	const second = await (await mf.dispatchFetch(next)).json();
	assert.equal(second.items.length, 5);
	assert.equal(second.hasMore, false);
	assert.equal(second.nextCursor, null);
	assert.equal(new Set([...first.items, ...second.items].map((item) => item.id)).size, 205);
	assert.ok([...first.items, ...second.items].every((item) => item.id !== "other"));

	await db.prepare("UPDATE im_todos SET remind_at = ?, assignee_id = 'u2' WHERE id = 'todo_000'").bind(1793347200000).run();
	assert.equal((await mf.dispatchFetch("http://localhost/reminders?now=1793347200000")).status, 200);
	assert.equal((await mf.dispatchFetch("http://localhost/reminders?now=1793347260000")).status, 200);
	const reminders = await db.prepare("SELECT user_id FROM im_todo_reminders ORDER BY user_id").all();
	assert.deepEqual(reminders.results.map((row) => row.user_id), ["u1", "u2"]);
	const due = Date.now() - 1_000;
	await db.prepare("UPDATE im_todos SET remind_at = ? WHERE id = 'todo_001'").bind(due).run();
	const worker = await mf.getWorker();
	assert.equal((await worker.scheduled({ cron: "* * * * *" })).outcome, "ok");
	assert.equal((await worker.scheduled({ cron: "* * * * *" })).outcome, "ok");
	const scheduled = await db.prepare("SELECT user_id, scheduled_at, created_at, notified_at FROM im_todo_reminders WHERE todo_id = 'todo_001'").all();
	assert.deepEqual(scheduled.results.map((row) => row.user_id), ["u1"]);
	assert.equal(scheduled.results[0].scheduled_at, due);
	assert.ok(scheduled.results[0].created_at >= due && scheduled.results[0].created_at - due <= 60_000);
	assert.ok(scheduled.results[0].notified_at >= due && scheduled.results[0].notified_at - due <= 60_000);
	await db.prepare(`UPDATE im_todos SET due_at = ?, repeat_kind = 'monthly', repeat_timezone = 'UTC', repeat_time = '12:00:00.000',
		repeat_anchor_day = 31, repeat_anchor_month = 1 WHERE id = 'todo_000'`).bind(Date.UTC(2027, 0, 31, 12)).run();
	const completed = await mf.dispatchFetch("http://localhost/complete");
	assert.equal(completed.status, 200);
	const occurrences = await db.prepare("SELECT due_at, done FROM im_todos WHERE title = 'Task 0' ORDER BY done DESC").all();
	assert.deepEqual(occurrences.results.map((row) => [row.due_at, row.done]), [[Date.UTC(2027, 0, 31, 12), 1], [Date.UTC(2027, 1, 28, 12), 0]]);
});
