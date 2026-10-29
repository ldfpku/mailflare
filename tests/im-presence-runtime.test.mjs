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
			import { ImUserHub } from "./src/lib/im/hub.ts";
			export { ImUserHub };
			export default {
				async fetch(request, env) {
					const headers = new Headers(request.headers);
					headers.set("X-Mailflare-Im-User", "u1");
					headers.set("X-Mailflare-Im-Auth", "token");
					return env.IM_HUB.getByName("u1").fetch(new Request("https://mailflare-im/connect", { headers }));
				}
			};
		`,
		resolveDir: root,
		sourcefile: "presence-runtime-test.ts",
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

test("Workers runtime keeps a user online until the last websocket closes", async (t) => {
	const mf = new Miniflare(convertV4MiniflareOptions({
		modules: true,
		script: bundle.outputFiles[0].text,
		compatibilityDate: "2026-05-20",
		compatibilityFlags: ["nodejs_compat"],
		durableObjects: { IM_HUB: { className: "ImUserHub", useSQLite: true } },
		d1Databases: { DB: "presence-runtime-test" },
	}));
	t.after(() => mf.dispose());
	const db = await mf.getD1Database("DB");
	for (const sql of [
		"CREATE TABLE users (id TEXT PRIMARY KEY, im_state_id TEXT NOT NULL DEFAULT '1', disabled INTEGER NOT NULL DEFAULT 0, deleted_at INTEGER)",
		"CREATE TABLE im_presence (user_id TEXT PRIMARY KEY, online INTEGER NOT NULL DEFAULT 0, visible_online INTEGER NOT NULL DEFAULT 0, last_opt_time INTEGER NOT NULL)",
		"CREATE TABLE im_rooms (id TEXT PRIMARY KEY, type INTEGER NOT NULL)",
		"CREATE TABLE im_room_members (room_id TEXT NOT NULL, user_id TEXT NOT NULL)",
		"INSERT INTO users (id) VALUES ('u1')",
	]) {
		await db.prepare(sql).run();
	}

	async function connect() {
		const response = await mf.dispatchFetch("http://localhost/connect", { headers: { Upgrade: "websocket" } });
		assert.equal(response.status, 101);
		assert.ok(response.webSocket);
		response.webSocket.accept();
		return response.webSocket;
	}

	async function waitForPresence(expected) {
		for (let attempt = 0; attempt < 100; attempt++) {
			const row = await db.prepare("SELECT online, visible_online FROM im_presence WHERE user_id = 'u1'").first();
			if (row?.online === expected && row.visible_online === expected) return;
			await sleep(50);
		}
		assert.fail(`presence did not become ${expected}`);
	}

	const first = await connect();
	await waitForPresence(1);
	const second = await connect();
	first.close(1000, "one device closed");
	await sleep(300);
	await waitForPresence(1);
	second.close(1000, "last device closed");
	await waitForPresence(0);
});
