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
			import { IM_FOREGROUND_TIMEOUT_MS } from "./src/lib/im/hub-utils.ts";
			export class ImUserHub extends BaseHub {
				async fetch(request) {
					if (new URL(request.url).pathname === "/test-expire") {
						const clientId = new URL(request.url).searchParams.get("client");
						const socket = this.ctx.getWebSockets().find((item) => item.readyState === WebSocket.OPEN && item.deserializeAttachment()?.clientId === clientId);
						if (!socket) return new Response("No active socket", { status: 404 });
						const attachment = socket.deserializeAttachment();
						socket.serializeAttachment({ ...attachment, background: false, connectedAt: Date.now() - IM_FOREGROUND_TIMEOUT_MS, lastActivityAt: 0 });
						const heartbeat = this.ctx.getWebSocketAutoResponseTimestamp(socket)?.getTime() ?? null;
						await this.alarm();
						return Response.json({ state: socket.readyState, heartbeat });
					}
					return super.fetch(request);
				}
			}
			export default {
				async fetch(request, env) {
					if (new URL(request.url).pathname === "/test-expire") {
						return env.IM_HUB.getByName("u1").fetch(new Request(\`https://mailflare-im/test-expire?client=\${new URL(request.url).searchParams.get("client")}\`));
					}
					const headers = new Headers(request.headers);
					headers.set("X-Mailflare-Im-User", "u1");
					headers.set("X-Mailflare-Im-Auth", "token");
					headers.set("X-Mailflare-Im-Client", new URL(request.url).searchParams.get("client") ?? "");
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

	async function connect(client = "") {
		const response = await mf.dispatchFetch(`http://localhost/connect?client=${client}`, { headers: { Upgrade: "websocket" } });
		assert.equal(response.status, 101);
		assert.ok(response.webSocket);
		response.webSocket.accept();
		return response.webSocket;
	}

	async function waitForPresence(expected, timeoutMs = 5_000) {
		const deadline = Date.now() + timeoutMs;
		while (Date.now() < deadline) {
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

	const stale = await connect("stale");
	const live = await connect("live");
	await waitForPresence(1);
	const staleResult = await (await mf.dispatchFetch("http://localhost/test-expire?client=stale")).json();
	assert.notEqual(staleResult.state, WebSocket.OPEN, `server socket remained open: ${JSON.stringify(staleResult)}`);
	assert.equal(live.readyState, WebSocket.OPEN);
	await waitForPresence(1);
	const liveResult = await (await mf.dispatchFetch("http://localhost/test-expire?client=live")).json();
	assert.notEqual(liveResult.state, WebSocket.OPEN, `server socket remained open: ${JSON.stringify(liveResult)}`);
	await waitForPresence(0);
	stale.close(1000, "test cleanup");
	live.close(1000, "test cleanup");

	await db.prepare("DROP TABLE im_presence").run();
	const recovering = await connect();
	await sleep(300);
	await db.prepare("CREATE TABLE im_presence (user_id TEXT PRIMARY KEY, online INTEGER NOT NULL DEFAULT 0, visible_online INTEGER NOT NULL DEFAULT 0, last_opt_time INTEGER NOT NULL)").run();
	await waitForPresence(1, 15_000);
	recovering.close(1000, "retry verified");
	await waitForPresence(0);

	await db.prepare("DROP TABLE im_presence").run();
	const disconnected = await connect();
	await sleep(300);
	disconnected.close(1000, "closed while storage was unavailable");
	await sleep(300);
	await db.prepare("CREATE TABLE im_presence (user_id TEXT PRIMARY KEY, online INTEGER NOT NULL DEFAULT 0, visible_online INTEGER NOT NULL DEFAULT 0, last_opt_time INTEGER NOT NULL)").run();
	await waitForPresence(0, 20_000);
});
