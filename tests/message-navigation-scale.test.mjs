import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import test, { after } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = mkdtempSync(join(root, "tests", ".tmp-message-navigation-"));
after(() => {
	rmSync(outDir, { recursive: true, force: true });
	delete globalThis.messageNavigationFixture;
});

const mocks = {
	"@/db": "export function getDb() { return globalThis.messageNavigationFixture.db; }",
	"@/lib/auth/cookies": "export async function getCurrentUser() { return globalThis.messageNavigationFixture.user; }",
	"@/lib/cloudflare": "export function getEnv() { return {}; }",
	"@/lib/mailboxes/access": `
		export async function getMailboxAccessLevel() { return { canRead: true }; }
		export async function listAccessibleMailboxIds() { return []; }
	`,
};

await build({
	entryPoints: [join(root, "src/app/api/messages/navigation/route.ts")],
	outfile: join(outDir, "route.mjs"),
	bundle: true,
	platform: "node",
	format: "esm",
	packages: "external",
	tsconfig: join(root, "tsconfig.json"),
	logLevel: "silent",
	plugins: [{
		name: "navigation-fixtures",
		setup(builder) {
			builder.onResolve({ filter: /^next\/server$/ }, () => ({ path: "next/server.js", external: true }));
			builder.onResolve({ filter: /^@\// }, (args) => args.path in mocks ? { path: args.path, namespace: "mock" } : undefined);
			builder.onLoad({ filter: /.*/, namespace: "mock" }, (args) => ({ contents: mocks[args.path], loader: "js" }));
		},
	}],
});

const { GET } = await import(pathToFileURL(join(outDir, "route.mjs")).href);

function fixture(rows, user = { id: "owner" }) {
	globalThis.messageNavigationFixture = {
		user,
		db: {
			select: () => ({
				from: () => ({
					where: () => ({
						orderBy: async () => rows,
					}),
				}),
			}),
		},
	};
}

function request(grouped = false) {
	return new Request(`https://mail.example/api/messages/navigation?folder=inbox${grouped ? "&group=thread" : ""}`);
}

test("navigation preserves message order and thread unread aggregation", async () => {
	fixture([
		{ id: "newest", threadId: "thread", direction: "outbound", read: false },
		{ id: "older", threadId: "thread", direction: "inbound", read: false },
		{ id: "standalone", threadId: null, direction: "inbound", read: true },
	]);
	const ungrouped = await GET(request());
	assert.equal(ungrouped.status, 200);
	assert.deepEqual((await ungrouped.json()).messages, [
		{ id: "newest", unread: false },
		{ id: "older", unread: true },
		{ id: "standalone", unread: false },
	]);
	const grouped = await GET(request(true));
	assert.equal(grouped.status, 200);
	assert.deepEqual((await grouped.json()).messages, [
		{ id: "newest", unread: true },
		{ id: "standalone", unread: false },
	]);
});

for (const grouped of [false, true]) {
	test(`navigation handles 200,000 ${grouped ? "grouped" : "ungrouped"} messages`, async () => {
		const count = 200_000;
		fixture(Array.from({ length: count }, (_, index) => ({
			id: `message-${index}`,
			threadId: `thread-${index}`,
			direction: index % 2 === 0 ? "inbound" : "outbound",
			read: false,
		})));
		const response = await GET(request(grouped));
		assert.equal(response.status, 200);
		const { messages } = await response.json();
		assert.equal(messages.length, count);
		assert.deepEqual(messages[0], { id: "message-0", unread: true });
		assert.deepEqual(messages[1], { id: "message-1", unread: false });
		assert.deepEqual(messages[count - 1], { id: `message-${count - 1}`, unread: false });
	});
}

test("navigation still rejects unauthenticated and invalid requests", async () => {
	fixture([], null);
	assert.equal((await GET(request())).status, 401);
	fixture([]);
	assert.equal((await GET(new Request("https://mail.example/api/messages/navigation?folder=invalid"))).status, 400);
});
