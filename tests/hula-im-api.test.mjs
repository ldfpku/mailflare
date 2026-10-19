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
	const pushes = [];
	const IM_HUB = {
		getByName: (userId) => ({
			fetch: async (url, init) => {
				if (url.endsWith("/notify")) pushes.push({ userId, ...JSON.parse(init.body) });
				return new Response(null, { status: 204 });
			},
		}),
	};
	const objects = new Map();
	const BUCKET = {
		put: async (key, value, options) => {
			const bytes = new Uint8Array(await new Response(value).arrayBuffer());
			objects.set(key, { bytes, contentType: options?.httpMetadata?.contentType });
			return { key, size: bytes.byteLength };
		},
		get: async (key, options) => {
			const stored = objects.get(key);
			if (!stored) return null;
			const { offset = 0, length = stored.bytes.byteLength - offset } = options?.range ?? {};
			return { body: new Response(stored.bytes.slice(offset, offset + length)).body, size: stored.bytes.byteLength };
		},
	};
	const env = { DB: database, MAILFLARE_RUNTIME: "node", APP_URL: "https://mail.one.test", IM_HUB, BUCKET };
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
	const addUser = (id, email, name) =>
		database.db.prepare("INSERT INTO users (id, email, password_hash, name, role, created_at) VALUES (?, ?, ?, ?, ?, ?)")
			.run(id, email, hashPassword("right-password"), name, "user", 1);
	const raw = (method, url, init = {}) => handleImRequest(new Request(url, { method, ...init }), env);
	return { database, env, call, raw, login, expireAccess, addUser, pushes, objects };
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

test("startup endpoints: the all-staff room is the only session and unknown endpoints answer 501", async (t) => {
	const { call, login } = await fixture(t);
	const { token } = (await login()).data;
	const sessions = (await call("GET", "im/chat/contact/list", { token })).data;
	assert.equal(sessions.length, 1);
	assert.deepEqual(
		{ roomId: sessions[0].roomId, type: sessions[0].type, hotFlag: sessions[0].hotFlag, memberNum: sessions[0].memberNum, unreadCount: sessions[0].unreadCount, text: sessions[0].text },
		{ roomId: "1", type: 1, hotFlag: 1, memberNum: 1, unreadCount: 0, text: "" },
	);
	assert.deepEqual((await call("POST", "im/chat/msg/list", { token, body: { async: true } })).data, []);
	assert.deepEqual((await call("GET", "im/room/group/list", { token })).data.map((group) => group.roomId), ["1"]);
	assert.deepEqual((await call("GET", "im/room/group/list", { token, query: { current: "1", size: "50" } })).data.total, "1");
	assert.deepEqual((await call("GET", "im/user/friend/page", { token, query: { pageSize: "100", cursor: "" } })).data, { list: [], cursor: "", isLast: true });
	assert.deepEqual((await call("GET", "im/room/notice/page", { token, query: { pageNo: "1", pageSize: "30" } })).data, { list: [], cursor: "", isLast: true });
	assert.equal((await call("GET", "im/user/state/list", { token })).data[0].id, "1");
	assert.equal((await call("GET", "system/anyTenant/config/init")).data.roomGroupId, "1", "config is public like HuLa-Server's anyTenant routes");
	assert.equal((await call("GET", "im/feed/list", { token })).code, 501);
});

test("the directory lists every other active account and the all-staff room follows it", async (t) => {
	const { database, call, login, addUser } = await fixture(t);
	addUser("u2", "kim@one.test", "Kim");
	addUser("u3", "lee@one.test", "Lee");
	const { token } = (await login()).data;
	const friends = (await call("GET", "im/user/friend/page", { token })).data;
	assert.deepEqual(friends.list.map((friend) => friend.uid), ["u2", "u3"]);
	assert.equal(friends.list[0].activeStatus, 2);
	const members = (await call("GET", "im/room/group/listMember", { token, query: { roomId: "1" } })).data;
	assert.deepEqual(members.map((member) => member.uid).sort(), ["u1", "u2", "u3"]);
	assert.equal(typeof members[0].id, "string");
	assert.equal(typeof members[0].lastOptTime, "number");

	database.db.prepare("UPDATE users SET disabled = 1 WHERE id = 'u3'").run();
	assert.deepEqual((await call("GET", "im/user/friend/page", { token })).data.list.map((friend) => friend.uid), ["u2"]);
	assert.deepEqual((await call("GET", "im/room/group/listMember", { token, query: { roomId: "1" } })).data.map((member) => member.uid).sort(), ["u1", "u2"]);
	assert.equal((await call("POST", "im/room/group/member/exit", { token, body: { roomId: "1" } })).code, 501, "exit uses DELETE");
	assert.equal((await call("DELETE", "im/room/group/member/exit", { token, body: { roomId: "1" } })).code, 400);
	const people = (await call("POST", "im/user/getUserByIds", { token, body: { uidList: ["u2", "u3", "nobody"] } })).data;
	assert.deepEqual(people.map((person) => person.uid), ["u2"]);
});

test("one-to-one chat: open from a contact, send, push, sync, unread and read", async (t) => {
	const { call, login, addUser, pushes } = await fixture(t);
	addUser("u2", "kim@one.test", "Kim");
	const sam = (await login()).data.token;
	const kim = (await login("kim@one.test")).data.token;

	const opened = (await call("GET", "im/chat/contact/detail/friend", { token: sam, query: { id: "u2", roomType: "2" } })).data;
	assert.equal(opened.type, 2);
	assert.equal(opened.detailId, "u2");
	assert.equal(opened.name, "Kim");
	const again = (await call("GET", "im/chat/contact/detail/friend", { token: sam, query: { id: "u2", roomType: "2" } })).data;
	assert.equal(again.roomId, opened.roomId, "the same pair always gets the same room");
	assert.equal((await call("GET", "im/chat/contact/detail/friend", { token: sam, query: { id: "u1", roomType: "2" } })).code, 400);

	const sent = await call("POST", "im/chat/msg", { token: sam, body: { id: "tmp-1", roomId: opened.roomId, msgType: 1, body: { content: "你好 <b>Kim</b>" } } });
	assert.equal(sent.code, 200);
	assert.match(sent.data.message.id, /^\d+$/);
	assert.equal(sent.data.fromUser.uid, "u1");
	assert.equal(sent.data.message.body.content, "你好 <b>Kim</b>");
	assert.deepEqual(pushes.map((push) => [push.userId, push.type, push.data.message.id]), [["u2", "receiveMessage", sent.data.message.id]]);

	const retried = await call("POST", "im/chat/msg", { token: sam, body: { id: "tmp-1", roomId: opened.roomId, msgType: 1, body: { content: "你好 <b>Kim</b>" } } });
	assert.equal(retried.data.message.id, sent.data.message.id, "a retried send is stored once");

	const kimSessions = (await call("GET", "im/chat/contact/list", { token: kim })).data;
	const kimRoom = kimSessions.find((session) => session.roomId === opened.roomId);
	assert.deepEqual({ name: kimRoom.name, unreadCount: kimRoom.unreadCount, text: kimRoom.text }, { name: "Sam", unreadCount: 1, text: "你好 Kim" });
	assert.equal((await call("GET", "im/chat/contact/list", { token: sam })).data.find((session) => session.roomId === opened.roomId).unreadCount, 0);

	const synced = (await call("POST", "im/chat/msg/list", { token: kim })).data;
	assert.deepEqual(synced.map((message) => message.message.id), [sent.data.message.id]);
	assert.equal(typeof synced[0].message.sendTime, "number");

	assert.equal((await call("PUT", "im/chat/msg/read", { token: kim, body: { roomId: opened.roomId } })).code, 200);
	assert.equal((await call("GET", "im/chat/contact/list", { token: kim })).data.find((session) => session.roomId === opened.roomId).unreadCount, 0);

	const reply = await call("POST", "im/chat/msg", { token: kim, body: { id: "k-1", roomId: opened.roomId, msgType: 1, body: { content: "收到", replyMsgId: sent.data.message.id } } });
	assert.deepEqual(
		{ id: reply.data.message.body.reply.id, username: reply.data.message.body.reply.username, body: reply.data.message.body.reply.body },
		{ id: sent.data.message.id, username: "Sam", body: "你好 Kim" },
	);
	const page = (await call("GET", "im/chat/msg/page", { token: sam, query: { roomId: opened.roomId, pageSize: "1" } })).data;
	assert.deepEqual([page.list.map((message) => message.message.id), page.isLast], [[reply.data.message.id], false]);
	const older = (await call("GET", "im/chat/msg/page", { token: sam, query: { roomId: opened.roomId, pageSize: "1", cursor: page.cursor } })).data;
	assert.deepEqual([older.list.map((message) => message.message.id), older.isLast], [[sent.data.message.id], true]);

	assert.equal((await call("POST", "im/chat/msg", { token: sam, body: { roomId: opened.roomId, msgType: 3, body: { url: "x" } } })).code, 400);
	assert.equal((await call("POST", "im/chat/msg", { token: sam, body: { roomId: opened.roomId, msgType: 1, body: { content: "  " } } })).code, 400);
});

test("only members can read or write a room", async (t) => {
	const { call, login, addUser } = await fixture(t);
	addUser("u2", "kim@one.test", "Kim");
	addUser("u3", "lee@one.test", "Lee");
	const sam = (await login()).data.token;
	const lee = (await login("lee@one.test")).data.token;
	const room = (await call("GET", "im/chat/contact/detail/friend", { token: sam, query: { id: "u2", roomType: "2" } })).data.roomId;
	await call("POST", "im/chat/msg", { token: sam, body: { roomId: room, msgType: 1, body: { content: "secret" } } });
	assert.equal((await call("POST", "im/chat/msg", { token: lee, body: { roomId: room, msgType: 1, body: { content: "hi" } } })).code, 403);
	assert.equal((await call("GET", "im/chat/msg/page", { token: lee, query: { roomId: room } })).code, 403);
	assert.equal((await call("GET", "im/chat/contact/detail", { token: lee, query: { id: room } })).code, 403);
	assert.equal((await call("POST", "im/chat/msg/list", { token: lee })).data.length, 0);
	assert.equal((await call("POST", "im/chat/setTop", { token: lee, body: { roomId: room, top: true } })).code, 403);
});

test("recall: senders within two minutes, group managers any time, and everyone is told", async (t) => {
	const { database, call, login, addUser, pushes } = await fixture(t);
	addUser("u2", "kim@one.test", "Kim");
	addUser("u3", "lee@one.test", "Lee");
	const sam = (await login()).data.token;
	const kim = (await login("kim@one.test")).data.token;
	const created = await call("POST", "im/room/group", { token: sam, body: { uidList: ["u2", "u3"] } });
	assert.equal(created.code, 200);
	const roomId = created.data.roomId;
	const own = (await call("POST", "im/chat/msg", { token: kim, body: { roomId, msgType: 1, body: { content: "oops" } } })).data;
	pushes.length = 0;
	assert.equal((await call("PUT", "im/chat/msg/recall", { token: kim, body: { roomId, msgId: own.message.id } })).code, 200);
	assert.deepEqual(pushes.map((push) => push.type), ["msgRecall", "msgRecall", "msgRecall"]);
	assert.deepEqual(pushes[0].data, { msgId: own.message.id, roomId, recallUid: "u2" });
	const synced = (await call("POST", "im/chat/msg/list", { token: sam })).data.find((message) => message.message.id === own.message.id);
	assert.deepEqual([synced.message.type, synced.message.body.content], [2, "Kim撤回了一条消息"]);

	const old = (await call("POST", "im/chat/msg", { token: kim, body: { roomId, msgType: 1, body: { content: "old" } } })).data;
	database.db.prepare("UPDATE im_messages SET created_at = created_at - 600000 WHERE id = ?").run(Number(old.message.id));
	assert.equal((await call("PUT", "im/chat/msg/recall", { token: kim, body: { roomId, msgId: old.message.id } })).code, 403);
	assert.equal((await call("PUT", "im/chat/msg/recall", { token: sam, body: { roomId, msgId: old.message.id } })).code, 200, "the owner moderates");
});

test("groups: create, invite, rename, admins, remove and leave", async (t) => {
	const { call, login, addUser, pushes } = await fixture(t);
	addUser("u2", "kim@one.test", "Kim");
	addUser("u3", "lee@one.test", "Lee");
	addUser("u4", "max@one.test", "Max");
	const sam = (await login()).data.token;
	const kim = (await login("kim@one.test")).data.token;
	assert.equal((await call("POST", "im/room/group", { token: sam, body: { uidList: ["u2"] } })).code, 400, "a group needs two others");
	const roomId = (await call("POST", "im/room/group", { token: sam, body: { uidList: ["u2", "u3"] } })).data.roomId;
	assert.deepEqual(pushes.map((push) => push.userId).sort(), ["u1", "u2", "u3"], "everyone gets the system message");
	assert.equal(pushes[0].data.message.type, 8);
	assert.equal(pushes[0].data.message.body, "Sam邀请Kim、Lee加入了群聊");

	const kimView = (await call("GET", "im/chat/contact/detail", { token: kim, query: { id: roomId } })).data;
	assert.deepEqual({ name: kimView.name, memberNum: kimView.memberNum, unreadCount: kimView.unreadCount }, { name: "Sam、Kim、Lee", memberNum: 3, unreadCount: 1 });
	const detail = (await call("GET", "im/room/group/detail", { token: kim, query: { id: roomId } })).data;
	assert.deepEqual({ roleId: detail.roleId, memberNum: detail.memberNum, groupName: detail.groupName }, { roleId: 3, memberNum: 3, groupName: "Sam、Kim、Lee" });

	assert.equal((await call("POST", "im/room/updateRoomInfo", { token: kim, body: { id: roomId, name: "Team" } })).code, 403);
	assert.equal((await call("POST", "im/room/updateRoomInfo", { token: sam, body: { id: roomId, name: "Team" } })).code, 200);
	assert.equal((await call("GET", "im/chat/contact/detail", { token: kim, query: { id: roomId } })).data.name, "Team");

	assert.equal((await call("POST", "im/room/group/member", { token: kim, body: { roomId, uidList: ["u4"] } })).code, 200, "any member can invite");
	assert.equal((await call("DELETE", "im/room/group/member", { token: kim, body: { roomId, uidList: ["u4"] } })).code, 403);
	assert.equal((await call("PUT", "im/room/group/admin", { token: sam, body: { roomId, uidList: ["u2"] } })).code, 200);
	assert.equal((await call("DELETE", "im/room/group/member", { token: kim, body: { roomId, uidList: ["u4", "u1"] } })).code, 200, "admins remove members but never the owner");
	const members = (await call("GET", "im/room/group/listMember", { token: sam, query: { roomId } })).data;
	assert.deepEqual(members.map((member) => [member.uid, member.roleId]), [["u1", 1], ["u2", 2], ["u3", 3]]);

	assert.equal((await call("DELETE", "im/room/group/member/exit", { token: sam, body: { roomId } })).code, 200);
	const after = (await call("GET", "im/room/group/listMember", { token: kim, query: { roomId } })).data;
	assert.deepEqual(after.map((member) => [member.uid, member.roleId]), [["u2", 1], ["u3", 3]], "ownership passes to the admin");
	assert.equal((await call("GET", "im/room/group/listMember", { token: sam, query: { roomId } })).code, 403);
});

test("session settings are per member", async (t) => {
	const { call, login, addUser } = await fixture(t);
	addUser("u2", "kim@one.test", "Kim");
	const sam = (await login()).data.token;
	const kim = (await login("kim@one.test")).data.token;
	await call("POST", "im/chat/setTop", { token: sam, body: { roomId: "1", top: true } });
	await call("POST", "im/chat/notification", { token: sam, body: { roomId: "1", type: 1 } });
	await call("POST", "im/chat/setHide", { token: sam, body: { roomId: "1", hide: true } });
	const mine = (await call("GET", "im/chat/contact/detail", { token: sam, query: { id: "1" } })).data;
	assert.deepEqual([mine.top, mine.muteNotification, mine.hide], [true, 1, true]);
	const theirs = (await call("GET", "im/chat/contact/detail", { token: kim, query: { id: "1" } })).data;
	assert.deepEqual([theirs.top, theirs.muteNotification, theirs.hide], [false, 0, false]);
	await call("POST", "im/chat/msg", { token: kim, body: { roomId: "1", msgType: 1, body: { content: "全员通知" } } });
	assert.equal((await call("GET", "im/chat/contact/detail", { token: sam, query: { id: "1" } })).data.hide, false, "a new message shows a hidden session again");
	assert.equal((await call("GET", "im/chat/contact/detail", { token: sam, query: { id: "1" } })).data.text, "Kim:全员通知");
});

test("files: upload once with the presigned URL, serve with ranges, and send as image and file messages", async (t) => {
	const { call, raw, login, addUser, pushes, objects } = await fixture(t);
	addUser("u2", "kim@one.test", "Kim");
	const sam = (await login()).data.token;
	assert.deepEqual((await call("GET", "system/anyTenant/storage/provider", { token: sam })).data, { provider: "minio" });
	assert.equal((await call("GET", "system/anyTenant/ossToken", { query: { fileName: "x.png" } })).code, 401);

	const cred = (await call("GET", "system/anyTenant/ossToken", { token: sam, query: { scene: "CHAT", fileName: "../截图 1.png" } })).data;
	assert.match(cred.downloadUrl, /^https:\/\/mail\.one\.test\/api\/im\/files\/[a-f0-9]{32}\/%E6%88%AA%E5%9B%BE%201\.png$/);
	assert.ok(cred.uploadUrl.startsWith(`${cred.downloadUrl}?token=`));

	const png = new Uint8Array([137, 80, 78, 71, 1, 2, 3, 4, 5, 6]);
	assert.equal((await raw("GET", cred.downloadUrl)).status, 404, "nothing to serve before the upload");
	assert.equal((await raw("PUT", `${cred.downloadUrl}?token=wrong`, { body: png, headers: { "Content-Length": "10" } })).status, 403);
	assert.equal((await raw("PUT", cred.uploadUrl, { body: png, headers: { "Content-Length": "10", "Content-Type": "application/octet-stream" } })).status, 200);
	assert.equal((await raw("PUT", cred.uploadUrl, { body: png, headers: { "Content-Length": "10" } })).status, 409, "upload links are single-use");
	assert.equal(objects.size, 1);

	const served = await raw("GET", cred.downloadUrl);
	assert.equal(served.status, 200);
	assert.equal(served.headers.get("Content-Type"), "image/png", "the type comes from the name, not the uploader");
	assert.deepEqual(new Uint8Array(await served.arrayBuffer()), png);
	const ranged = await raw("GET", cred.downloadUrl, { headers: { Range: "bytes=2-4" } });
	assert.equal(ranged.status, 206);
	assert.equal(ranged.headers.get("Content-Range"), "bytes 2-4/10");
	assert.deepEqual(new Uint8Array(await ranged.arrayBuffer()), png.slice(2, 5));
	assert.equal((await raw("HEAD", cred.downloadUrl)).headers.get("Content-Length"), "10");

	const room = (await call("GET", "im/chat/contact/detail/friend", { token: sam, query: { id: "u2", roomType: "2" } })).data.roomId;
	const image = await call("POST", "im/chat/msg", { token: sam, body: { id: "img-1", roomId: room, msgType: 3, body: { url: cred.downloadUrl, size: 10, width: 640, height: 480, path: "C:/secret" } } });
	assert.equal(image.code, 200);
	assert.deepEqual(image.data.message.body, { url: cred.downloadUrl, size: 10, width: 640, height: 480 });
	assert.equal(pushes.at(-1).data.message.type, 3);
	const session = (await call("GET", "im/chat/contact/detail", { token: sam, query: { id: room } })).data;
	assert.equal(session.text, "[图片]");

	const foreign = await call("POST", "im/chat/msg", { token: sam, body: { roomId: room, msgType: 3, body: { url: "https://evil.test/a.png" } } });
	assert.equal(foreign.code, 400, "bodies may only point at our own files");
	const pending = (await call("GET", "system/anyTenant/ossToken", { token: sam, query: { fileName: "report.pdf" } })).data;
	assert.equal((await call("POST", "im/chat/msg", { token: sam, body: { roomId: room, msgType: 4, body: { url: pending.downloadUrl, fileName: "report.pdf" } } })).code, 400, "the file must be uploaded first");
	await raw("PUT", pending.uploadUrl, { body: png, headers: { "Content-Length": "10" } });
	const file = await call("POST", "im/chat/msg", { token: sam, body: { roomId: room, msgType: 4, body: { url: pending.downloadUrl, fileName: "report.pdf", size: 10 } } });
	assert.equal(file.code, 200);
	assert.equal((await call("GET", "im/chat/contact/detail", { token: sam, query: { id: room } })).data.text, "[文件] report.pdf");
	assert.equal((await raw("GET", `${pending.downloadUrl}?download=1`)).headers.get("Content-Type"), "application/octet-stream");
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
