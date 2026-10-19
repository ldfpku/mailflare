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
const { ImUserHub, formatImWsTicket, parseImWsTicket, staleImWsTickets, IM_WS_TICKET_STORAGE_PREFIX, IM_WS_TICKET_TTL_MS } = await import(
	pathToFileURL(join(directory, "entry.mjs")).href
);

globalThis.WebSocketRequestResponsePair ??= class {};

function hub() {
	const data = new Map();
	const storage = {
		get: async (key) => data.get(key),
		put: async (key, value) => void data.set(key, value),
		delete: async (keys) => {
			for (const key of [keys].flat()) data.delete(key);
		},
		list: async ({ prefix }) => new Map([...data].filter(([key]) => key.startsWith(prefix))),
	};
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
