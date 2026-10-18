import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import test, { after } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const directory = mkdtempSync(join(root, "node_modules", "mailflare-im-test-"));
after(() => rmSync(directory, { recursive: true, force: true }));
await build({
	stdin: {
		contents: `
			export { SqliteDatabase } from "./server/runtime/sqlite-database.ts";
			export { applyMigrations } from "./server/runtime/migrate.ts";
			export { hashPassword } from "./src/lib/auth/password.ts";
			export { createSession, deleteUserSessions } from "./src/lib/auth/session.ts";
			export { handleImRequest } from "./src/lib/im/handler.ts";
			export { resolveImSocketToken } from "./src/lib/im/tokens.ts";
			export { findImRoute, imApiPath } from "./src/lib/im/handler-utils.ts";
			export { parseImPairId, imPairSessionIds } from "./src/lib/im/tokens-utils.ts";
		`,
		resolveDir: root,
		sourcefile: "hula-im-test-entry.ts",
	},
	outfile: join(directory, "entry.mjs"),
	bundle: true,
	platform: "node",
	format: "esm",
	target: "node22",
	tsconfig: join(root, "tsconfig.json"),
	packages: "external",
	alias: { "next/headers": "next/headers.js", "next/server": "next/server.js", "cloudflare:workers": "./server/runtime/cloudflare-workers.ts" },
	logLevel: "silent",
});
const {
	SqliteDatabase, applyMigrations, hashPassword, createSession, deleteUserSessions, handleImRequest,
	resolveImSocketToken, findImRoute, imApiPath, parseImPairId, imPairSessionIds,
} = await import(pathToFileURL(join(directory, "entry.mjs")).href);

async function fixture(t) {
	const database = new SqliteDatabase(":memory:");
	t.after(() => database.db.close());
	await applyMigrations(database, join(root, "drizzle/migrations"));
	database.db.prepare("INSERT INTO users (id, email, password_hash, name, role, created_at) VALUES (?, ?, ?, ?, ?, ?)")
		.run("u1", "sam@one.test", hashPassword("right-password"), "Sam", "user", 1);
	const env = { DB: database, MAILFLARE_RUNTIME: "node", APP_URL: "https://mail.one.test" };
	globalThis.__mailflareNodeEnv = env;
	t.after(() => { delete globalThis.__mailflareNodeEnv; });
	const call = async (method, path, { body, token, query } = {}) => {
		const url = new URL(`https://mail.one.test/api/im/${path}`);
		for (const [key, value] of Object.entries(query ?? {})) url.searchParams.set(key, value);
		const response = await handleImRequest(new Request(url, {
			method,
			headers: { "Content-Type": "application/json", ...(token ? { token } : {}) },
			body: body === undefined ? undefined : JSON.stringify(body),
		}), env);
		return response.json();
	};
	const login = (account = "sam@one.test", password = "right-password", extra = {}) =>
		call("POST", "oauth/anyTenant/login", { body: { account, password, deviceType: "PC", systemType: 2, ...extra } });
	const expireAccess = (token) => {
		const row = database.db.prepare("SELECT id FROM sessions WHERE id LIKE 'imp_%_a' ORDER BY created_at DESC").all();
		for (const { id } of row) database.db.prepare("UPDATE sessions SET expires_at = 1 WHERE id = ?").run(id);
		return token;
	};
	return { database, env, call, login, expireAccess };
}

test("signs in with the mailflare email and password and answers in HuLa's envelope", async (t) => {
	const { call, login } = await fixture(t);
	const result = await login(" SAM@one.test ");
	assert.equal(result.success, true);
	assert.equal(result.code, 200);
	assert.equal(result.data.uid, "u1");
	assert.match(result.data.token, /^imat_/);
	assert.match(result.data.refreshToken, /^imrt_/);
	assert.ok(Number(result.data.expire) > Date.now());

	const me = await call("GET", "im/user/userInfo", { token: result.data.token });
	assert.equal(me.code, 200);
	assert.deepEqual(
		{ uid: me.data.uid, account: me.data.account, name: me.data.name, avatar: me.data.avatar, userStateId: me.data.userStateId },
		{ uid: "u1", account: "sam@one.test", name: "Sam", avatar: "", userStateId: "1" },
	);
});

test("rejects a wrong password and asks for the authenticator code when MFA is on", async (t) => {
	const { database, login } = await fixture(t);
	const wrong = await login("sam@one.test", "nope");
	assert.equal(wrong.success, false);
	assert.equal(wrong.code, 400);

	database.db.prepare("UPDATE users SET totp_enabled = 1, totp_secret = 'JBSWY3DPEHPK3PXP' WHERE id = 'u1'").run();
	const pending = await login();
	assert.equal(pending.code, 428);
	assert.equal(pending.msg, "MFA_REQUIRED");
	const badCode = await login("sam@one.test", "right-password", { code: "000000" });
	assert.equal(badCode.code, 400);
	assert.equal(badCode.data, null);
});

test("an expired access token answers 406 so HuLa refreshes, and refresh rotates the pair", async (t) => {
	const { call, login, expireAccess } = await fixture(t);
	const first = (await login()).data;
	expireAccess(first.token);
	assert.equal((await call("GET", "im/user/userInfo", { token: first.token })).code, 406);

	const refreshed = await call("POST", "oauth/anyTenant/refresh", { body: { refreshToken: first.refreshToken } });
	assert.equal(refreshed.code, 200);
	assert.notEqual(refreshed.data.token, first.token);
	assert.equal((await call("GET", "im/user/userInfo", { token: refreshed.data.token })).code, 200);

	const reused = await call("POST", "oauth/anyTenant/refresh", { body: { refreshToken: first.refreshToken } });
	assert.equal(reused.code, 401, "a refresh token works once");
	assert.equal((await call("GET", "im/user/userInfo", { token: refreshed.data.refreshToken })).code, 401, "refresh tokens are not access tokens");
	assert.equal((await call("GET", "im/user/userInfo", { token: "imat_unknown" })).code, 401);
	assert.equal((await call("GET", "im/user/userInfo")).code, 401);
});

test("sign-out revokes both tokens, and revoking the user's sessions signs HuLa out too", async (t) => {
	const { env, call, login } = await fixture(t);
	const first = (await login()).data;
	assert.equal((await call("POST", "oauth/anyUser/logout", { token: first.token, body: { autoLogin: false } })).code, 200);
	assert.equal((await call("POST", "oauth/check", { token: first.token })).code, 401);
	assert.equal((await call("POST", "oauth/anyTenant/refresh", { body: { refreshToken: first.refreshToken } })).code, 401);

	const second = (await login()).data;
	const web = await createSession(env, "u1");
	await deleteUserSessions(env, "u1", web);
	assert.equal((await call("POST", "oauth/check", { token: second.token })).code, 401);
});

test("the socket accepts an expired access token only while its refresh token is alive", async (t) => {
	const { env, call, login, expireAccess } = await fixture(t);
	const session = (await login()).data;
	assert.equal((await resolveImSocketToken(env, session.token))?.id, "u1");
	expireAccess(session.token);
	assert.equal((await resolveImSocketToken(env, session.token))?.id, "u1");
	await call("POST", "oauth/anyTenant/refresh", { body: { refreshToken: session.refreshToken } });
	assert.equal(await resolveImSocketToken(env, session.token), null);
	assert.equal(await resolveImSocketToken(env, session.refreshToken), null);
	assert.equal(await resolveImSocketToken(env, null), null);
});

test("startup endpoints answer empty data and unknown endpoints answer 501", async (t) => {
	const { call, login } = await fixture(t);
	const { token } = (await login()).data;
	assert.deepEqual((await call("GET", "im/chat/contact/list", { token })).data, []);
	assert.deepEqual((await call("POST", "im/chat/msg/list", { token, body: { async: true } })).data, []);
	assert.deepEqual((await call("GET", "im/room/group/list", { token })).data, []);
	assert.deepEqual((await call("GET", "im/room/group/list", { token, query: { current: "1", size: "50" } })).data, { records: [], total: "0", size: "50" });
	assert.equal((await call("GET", "im/user/state/list", { token })).data[0].id, "1");
	assert.equal((await call("GET", "system/anyTenant/config/init")).code, 200, "config is public like HuLa-Server's anyTenant routes");
	assert.equal((await call("GET", "im/feed/list", { token })).code, 501);
});

test("route helpers", () => {
	assert.equal(imApiPath("/api/im/oauth/check/"), "oauth/check");
	assert.equal(imApiPath("/api/other"), null);
	const table = { "GET avatar/:uid": () => null, "GET a/b": () => null };
	assert.deepEqual(findImRoute(table, "GET", "avatar/u%201")?.params, { uid: "u 1" });
	assert.equal(findImRoute(table, "GET", "avatar/%E0%A4%A"), null);
	assert.equal(findImRoute(table, "POST", "a/b"), null);
	assert.equal(parseImPairId(imPairSessionIds("abc_def").refresh), "abc_def");
	assert.equal(parseImPairId("plain-session"), null);
});
