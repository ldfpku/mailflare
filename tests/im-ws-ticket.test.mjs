import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import test, { after } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const directory = mkdtempSync(join(root, "node_modules", "mailflare-ws-ticket-test-"));
after(() => rmSync(directory, { recursive: true, force: true }));
await build({
	stdin: {
		contents: `
			export { ImUserHub } from "./src/lib/im/hub.ts";
			export * from "./src/lib/im/ws-ticket-utils.ts";
			export { IM_FOREGROUND_TIMEOUT_MS, IM_BACKGROUND_TIMEOUT_MS } from "./src/lib/im/hub-utils.ts";
		`,
		resolveDir: root,
		sourcefile: "ws-ticket-test-entry.ts",
	},
	outfile: join(directory, "entry.mjs"),
	bundle: true,
	platform: "node",
	format: "esm",
	target: "node22",
	tsconfig: join(root, "tsconfig.json"),
	packages: "external",
	alias: { "cloudflare:workers": "./tests/stubs/cloudflare-workers.mjs" },
	logLevel: "silent",
});
const { ImUserHub, formatImWsTicket, parseImWsTicket, staleImWsTickets, IM_WS_TICKET_STORAGE_PREFIX, IM_WS_TICKET_TTL_MS, IM_FOREGROUND_TIMEOUT_MS, IM_BACKGROUND_TIMEOUT_MS } = await import(
	pathToFileURL(join(directory, "entry.mjs")).href
);

globalThis.WebSocketRequestResponsePair ??= class {};

function fakeStorage(data = new Map()) {
	let alarm = null;
	const storage = {
		get: async (key) => data.get(key),
		put: async (key, value) => void data.set(key, value),
		delete: async (keys) => {
			for (const key of [keys].flat()) data.delete(key);
		},
		list: async ({ prefix }) => new Map([...data].filter(([key]) => key.startsWith(prefix))),
		setAlarm: async (time) => { alarm = time; },
		getAlarm: async () => alarm,
		transaction: async (callback) => callback(storage),
	};
	return storage;
}

function hub() {
	const data = new Map();
	const storage = fakeStorage(data);
	const ctx = { storage, setWebSocketAutoResponse() {}, getWebSockets: () => [] };
	return { hub: new ImUserHub(ctx, {}), data };
}

const issue = async (object) => (await (await object.fetch(new Request("https://mailflare-im/ticket", { method: "POST" }))).json()).secret;

test("a ticket names its user and carries a 48-hex secret; anything else is refused", () => {
	const secret = "a".repeat(48);
	assert.deepEqual(parseImWsTicket(formatImWsTicket("V1StGXR8_Z5jdHi6B-myT", secret)), { userId: "V1StGXR8_Z5jdHi6B-myT", secret });
	for (const bad of [null, "", secret, `.${secret}`, `u1.${secret.slice(1)}`, `u1.${"g".repeat(48)}`, `u/1.${secret}`, `imat_x`]) {
		assert.equal(parseImWsTicket(bad), null, String(bad));
	}
});

test("the hub redeems a ticket once and stores only its hash", async () => {
	const { hub: object, data } = hub();
	const secret = await issue(object);
	assert.match(secret, /^[a-f0-9]{48}$/);
	assert.equal(data.size, 1);
	assert.ok(![...data.keys()].some((key) => key.includes(secret)));
	assert.equal(await object.redeemTicket(secret), true);
	assert.equal(await object.redeemTicket(secret), false);
	assert.equal(await object.redeemTicket("b".repeat(48)), false);
	assert.equal(await object.redeemTicket(null), false);
});

test("an expired ticket is refused and cleared, and issuing sweeps stale ones", async (t) => {
	const { hub: object, data } = hub();
	const secret = await issue(object);
	const realNow = Date.now;
	t.after(() => { Date.now = realNow; });
	Date.now = () => realNow() + IM_WS_TICKET_TTL_MS + 1;
	assert.equal(await object.redeemTicket(secret), false);
	assert.equal(data.size, 0);

	await issue(object);
	data.set(`${IM_WS_TICKET_STORAGE_PREFIX}old`, 1);
	await issue(object);
	assert.equal(data.has(`${IM_WS_TICKET_STORAGE_PREFIX}old`), false);
	assert.equal(data.size, 2);
});

test("a hub keeps at most the newest unused tickets", () => {
	const entries = Array.from({ length: 5 }, (_, index) => [`k${index}`, 1000 + index]);
	assert.deepEqual(staleImWsTickets([...entries, ["gone", 10]], 500, 3).sort(), ["gone", "k0", "k1"]);
});

test("a socket upgrade without a legacy-token mark needs a ticket", async () => {
	const { hub: object } = hub();
	const upgrade = (headers) =>
		object.fetch(new Request("https://mailflare-im/connect", { headers: { Upgrade: "websocket", "X-Mailflare-Im-User": "u1", ...headers } }));
	assert.equal((await upgrade({})).status, 401);
	assert.equal((await upgrade({ "X-Mailflare-Im-Auth": "ticket", "X-Mailflare-Im-Ticket": "c".repeat(48) })).status, 401);
});

test("presence writes stay ordered when a user reconnects during the last disconnect", async () => {
	let sockets = [];
	let releaseFirst;
	const firstWrite = new Promise((resolve) => { releaseFirst = resolve; });
	const writes = [];
	const DB = {
		prepare: () => ({
			bind: (uid, online) => ({
				run: async () => {
					if (!writes.length) {
						writes.push({ uid, online, finished: false });
						await firstWrite;
						writes[0].finished = true;
					} else writes.push({ uid, online, finished: true });
				},
				first: async () => null,
			}),
		}),
	};
	const ctx = { storage: fakeStorage(), setWebSocketAutoResponse() {}, getWebSockets: () => sockets };
	const object = new ImUserHub(ctx, { DB });
	const socket = () => ({ readyState: WebSocket.OPEN, deserializeAttachment: () => ({ userId: "u1" }) });
	const oldSocket = socket();
	sockets = [oldSocket];
	const online = object.updatePresence("u1");
	await Promise.resolve();
	sockets = [];
	const disconnect = object.markOfflineIfLast(oldSocket);
	const newSocket = socket();
	sockets = [newSocket];
	const reconnect = object.updatePresence("u1");
	releaseFirst();
	await Promise.all([online, disconnect, reconnect]);
	assert.deepEqual(writes.map((entry) => entry.online), [1, 1, 1]);
	assert.ok(writes.every((entry) => entry.finished));
	sockets = [];
	await object.markOfflineIfLast(newSocket);
	assert.equal(writes.at(-1).online, 0);
});

test("closing one of multiple devices does not mark the user offline", async () => {
	const writes = [];
	const DB = { prepare: () => ({ bind: (_uid, online) => ({ run: async () => void writes.push(online), first: async () => null }) }) };
	const socket = () => ({ readyState: WebSocket.OPEN, deserializeAttachment: () => ({ userId: "u1" }) });
	const first = socket();
	const second = socket();
	const ctx = { storage: fakeStorage(), setWebSocketAutoResponse() {}, getWebSockets: () => [first, second] };
	const object = new ImUserHub(ctx, { DB });
	await object.markOfflineIfLast(first);
	assert.deepEqual(writes, [1]);
});

test("foreground heartbeat expiry keeps other live devices online and preserves an earlier retry", async (t) => {
	const now = 1_000_000;
	const realNow = Date.now;
	Date.now = () => now;
	t.after(() => { Date.now = realNow; });
	const writes = [];
	const storage = fakeStorage();
	await storage.setAlarm(now + 5_000);
	const socket = (attachment, autoResponse) => ({
		readyState: WebSocket.OPEN,
		attachment,
		autoResponse,
		deserializeAttachment() { return this.attachment; },
		serializeAttachment(value) { this.attachment = value; },
		close() { this.readyState = WebSocket.CLOSED; },
	});
	const stale = socket({ userId: "u1", connectedAt: now - IM_FOREGROUND_TIMEOUT_MS, background: false }, null);
	const live = socket({ userId: "u1", connectedAt: now - 100_000, background: false }, now - 1_000);
	const sockets = [stale, live];
	const DB = { prepare: () => ({ bind: (_uid, online) => ({ run: async () => void writes.push(online), first: async () => null }) }) };
	const ctx = {
		storage, setWebSocketAutoResponse() {}, getWebSockets: () => sockets,
		getWebSocketAutoResponseTimestamp: (item) => item.autoResponse ? new Date(item.autoResponse) : null,
	};
	const object = new ImUserHub(ctx, { DB });
	await object.webSocketMessage(live, JSON.stringify({ type: "clientVisibility", background: false }));
	assert.equal(await storage.getAlarm(), now + 5_000, "a presence retry must not be postponed");
	await object.alarm();
	assert.equal(stale.readyState, WebSocket.CLOSED);
	assert.equal(live.readyState, WebSocket.OPEN);
	assert.deepEqual(writes, [1]);
});

test("background connections use a longer expiry and foreground expires at the exact threshold", async (t) => {
	let now = 2_000_000;
	const realNow = Date.now;
	Date.now = () => now;
	t.after(() => { Date.now = realNow; });
	const writes = [];
	const storage = fakeStorage();
	const socket = {
		readyState: WebSocket.OPEN,
		attachment: { userId: "u1", connectedAt: now - IM_FOREGROUND_TIMEOUT_MS, background: true },
		deserializeAttachment() { return this.attachment; },
		serializeAttachment(value) { this.attachment = value; },
		close() { this.readyState = WebSocket.CLOSED; },
	};
	const DB = { prepare: () => ({ bind: (_uid, online) => ({ run: async () => void writes.push(online), first: async () => null }) }) };
	const ctx = { storage, setWebSocketAutoResponse() {}, getWebSockets: () => [socket], getWebSocketAutoResponseTimestamp: () => null };
	const object = new ImUserHub(ctx, { DB });
	await object.alarm();
	assert.equal(socket.readyState, WebSocket.OPEN);
	assert.equal(await storage.getAlarm(), socket.attachment.connectedAt + IM_BACKGROUND_TIMEOUT_MS);
	await object.webSocketMessage(socket, JSON.stringify({ type: "clientVisibility", background: false }));
	assert.equal(await storage.getAlarm(), now + IM_FOREGROUND_TIMEOUT_MS);
	now += IM_FOREGROUND_TIMEOUT_MS - 1;
	await object.alarm();
	assert.equal(socket.readyState, WebSocket.OPEN);
	now += 1;
	await object.alarm();
	assert.equal(socket.readyState, WebSocket.CLOSED);
	assert.deepEqual(writes, [0]);
});

test("hibernating heartbeat auto-responses extend foreground liveness", async (t) => {
	let now = 3_000_000;
	const realNow = Date.now;
	Date.now = () => now;
	t.after(() => { Date.now = realNow; });
	const socket = {
		readyState: WebSocket.OPEN,
		deserializeAttachment: () => ({ userId: "u1", connectedAt: now - 200_000, background: false }),
		close() { this.readyState = WebSocket.CLOSED; },
	};
	const autoResponse = now - IM_FOREGROUND_TIMEOUT_MS + 1;
	const DB = { prepare: () => ({ bind: () => ({ run: async () => {}, first: async () => null }) }) };
	const ctx = {
		storage: fakeStorage(), setWebSocketAutoResponse() {}, getWebSockets: () => [socket],
		getWebSocketAutoResponseTimestamp: () => new Date(autoResponse),
	};
	const object = new ImUserHub(ctx, { DB });
	await object.alarm();
	assert.equal(socket.readyState, WebSocket.OPEN);
	now++;
	await object.alarm();
	assert.equal(socket.readyState, WebSocket.CLOSED);
});

test("a failed presence write is retried using the current socket state", async () => {
	let sockets = [{ readyState: WebSocket.OPEN }];
	let failing = true;
	const writes = [];
	const data = new Map();
	const storage = fakeStorage(data);
	const DB = {
		prepare: (sql) => ({
			bind: (_uid, online) => ({
				run: async () => {
					if (failing) throw new Error("synthetic database failure");
					writes.push(online);
				},
				first: async () => sql.startsWith("SELECT id FROM users") ? { id: "u1" } : null,
			}),
		}),
	};
	const object = new ImUserHub({ storage, setWebSocketAutoResponse() {}, getWebSockets: () => sockets }, { DB });
	await object.updatePresence("u1");
	assert.deepEqual(data.get("pending-presence"), { userId: "u1", attempts: 1 });
	assert.ok(await storage.getAlarm() >= Date.now());
	sockets = [];
	failing = false;
	await object.alarm();
	assert.deepEqual(writes, [0]);
	assert.equal(data.has("pending-presence"), false);
});

test("a failed presence broadcast is replayed after its state was stored", async () => {
	let online = 0;
	let visible = 0;
	let version = 1;
	let attempts = 0;
	const data = new Map();
	const storage = fakeStorage(data);
	const DB = {
		prepare: (sql) => ({
			bind: (...args) => ({
				run: async () => { if (sql.includes("INSERT INTO im_presence")) online = args[1]; },
				first: async () => {
					if (sql.startsWith("SELECT id FROM users")) return { id: "u1" };
					if (sql.includes("UPDATE im_presence")) {
						if (visible === online) return null;
						visible = online;
						return { visible_online: visible, last_opt_time: ++version };
					}
					if (sql.includes("SELECT p.visible_online")) return { visible_online: visible, last_opt_time: version };
					return null;
				},
				all: async () => ({ results: [] }),
			}),
		}),
	};
	const IM_HUB = {
		getByName: () => ({
			fetch: async () => new Response(null, { status: ++attempts === 1 ? 503 : 204 }),
		}),
	};
	const ctx = {
		storage, setWebSocketAutoResponse() {}, getWebSocketAutoResponseTimestamp: () => null,
		getWebSockets: () => [{ readyState: WebSocket.OPEN, deserializeAttachment: () => ({ userId: "u1", connectedAt: Date.now() }) }],
	};
	const object = new ImUserHub(ctx, { DB, IM_HUB });
	await object.updatePresence("u1");
	assert.equal(visible, 1);
	assert.equal(attempts, 1);
	assert.deepEqual(data.get("pending-presence"), { userId: "u1", attempts: 1 });
	await object.alarm();
	assert.equal(attempts, 2);
	assert.equal(data.has("pending-presence"), false);
});

test("does not keep retrying presence for a deleted account", async () => {
	const data = new Map();
	const storage = fakeStorage(data);
	const DB = {
		prepare: () => ({
			bind: () => ({
				run: async () => { throw new Error("synthetic foreign key failure"); },
				first: async () => null,
			}),
		}),
	};
	const object = new ImUserHub({ storage, setWebSocketAutoResponse() {}, getWebSockets: () => [] }, { DB });
	await object.updatePresence("deleted");
	assert.equal(data.has("pending-presence"), false);
	assert.equal(await storage.getAlarm(), null);
});
