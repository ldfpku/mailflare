import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import test, { after } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const directory = mkdtempSync(join(root, "node_modules", "mailflare-im-purge-test-"));
after(() => rmSync(directory, { recursive: true, force: true }));
await build({
	stdin: {
		contents: `
			export { SqliteDatabase } from "./server/runtime/sqlite-database.ts";
			export { applyMigrations } from "./server/runtime/migrate.ts";
			export { hashPassword } from "./src/lib/auth/password.ts";
			export { handleImRequest } from "./src/lib/im/handler.ts";
			export { previewImPurge, runImPurge } from "./src/lib/im/purge.ts";
			export * from "./src/lib/im/purge-utils.ts";
		`,
		resolveDir: root,
		sourcefile: "im-purge-test-entry.ts",
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
const mod = await import(pathToFileURL(join(directory, "entry.mjs")).href);
const { SqliteDatabase, applyMigrations, hashPassword, handleImRequest, previewImPurge, runImPurge } = mod;

const NOW = Date.UTC(2026, 9, 20, 2, 0);
const HOUR = 3600 * 1000;
const REAL = ["real@one.test"];
const fileId = (n) => String(n).padStart(32, "f");
const fileUrl = (n) => `https://mail.one.test/api/im/files/${fileId(n)}/x.png`;

/**
 * admin (the person running the tool), t1/t2 test accounts, real a real colleague. Rooms: t1-t2 private chat
 * (test), admin-t1 private chat (admin), real-t1 private chat (colleague), a t1/t2 group (test), and the all-staff
 * group with one message from each of admin, real and t2.
 */
async function fixture(t) {
	const database = new SqliteDatabase(":memory:");
	t.after(() => database.db.close());
	await applyMigrations(database, join(root, "drizzle/migrations"));
	const db = database.db;
	const addUser = (id, email, name) =>
		db.prepare("INSERT INTO users (id, email, password_hash, name, role, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(id, email, hashPassword("right-password"), name, "user", 1);
	addUser("admin", "boss@one.test", "管理员");
	addUser("t1", "t1@one.test", "测试一");
	addUser("t2", "t2@one.test", "测试二");
	addUser("real", "real@one.test", "真同事");
	const room = (id, type, members, avatar = "") => {
		if (id !== "1") db.prepare("INSERT INTO im_rooms (id, type, name, avatar, active_time, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(id, type, type === 1 ? `群${id}` : "", avatar, 1, 1);
		for (const user of members) db.prepare("INSERT INTO im_room_members (room_id, user_id, created_at) VALUES (?, ?, ?)").run(id, user, 1);
	};
	room("1", 1, ["admin", "t1", "t2", "real"]);
	room("tt", 2, ["t1", "t2"]);
	room("at", 2, ["admin", "t1"]);
	room("rt", 2, ["real", "t1"]);
	room("g", 1, ["t1", "t2"], fileUrl(9));
	let next = 0;
	const message = (roomId, from, content, type = 1) => {
		const body = type === 1 ? { content } : { url: content, fileName: "x.png" };
		const info = db.prepare("INSERT INTO im_messages (room_id, from_uid, type, body, created_at) VALUES (?, ?, ?, ?, ?)").run(roomId, from, type, JSON.stringify(body), NOW - 10 * HOUR + ++next);
		return Number(info.lastInsertRowid);
	};
	message("1", "admin", "大家好测试一下");
	const realInAll = message("1", "real", "收到真同事回复");
	message("1", "t2", "全员测试消息");
	message("tt", "t1", "测试账号聊天内容");
	message("tt", "t1", fileUrl(1), 4);
	message("tt", "t2", fileUrl(2), 4);
	message("rt", "t1", fileUrl(2), 4); // forwarded copy of file 2 into a chat that stays
	message("at", "admin", "管理员测试");
	message("rt", "real", "真同事的工作消息");
	const groupMsg = message("g", "t1", fileUrl(3), 4);
	db.prepare("INSERT INTO im_room_files (room_id, file_id, msg_id, uploader_id, file_name, content_type, size, msg_type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
		.run("g", fileId(3), groupMsg, "t1", "x.png", "image/png", 30, 4, 1);
	const objects = new Map();
	const file = (n, uploader, createdAt) => {
		db.prepare("INSERT INTO im_files (id, uploader_id, object_key, file_name, content_type, size, uploaded_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
			.run(fileId(n), uploader, `im-files/${fileId(n)}`, "x.png", "image/png", n * 10, createdAt, createdAt);
		objects.set(`im-files/${fileId(n)}`, true);
	};
	file(1, "t1", NOW - 10 * HOUR);
	file(2, "t2", NOW - 10 * HOUR);
	file(3, "t1", NOW - 10 * HOUR);
	file(4, "t1", NOW - 10 * HOUR); // never sent, old
	file(5, "t1", NOW - 60 * 1000); // never sent, still uploading
	file(6, "real", NOW - 10 * HOUR); // never sent by a real colleague
	file(9, "t1", NOW - 10 * HOUR); // the group's avatar
	const meeting = (id, host, invitees) =>
		db.prepare("INSERT INTO im_meetings (id, rtk_meeting_id, title, host_id, invitee_ids, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(id, `rtk-${id}`, "会", host, JSON.stringify(invitees), 1);
	meeting("m1", "t1", ["t2"]);
	meeting("m2", "admin", ["t1"]);
	meeting("m3", "t1", ["real"]);
	db.prepare("INSERT INTO im_meeting_participants (meeting_id, user_id, rtk_participant_id, auth_token, created_at) VALUES (?, ?, ?, ?, ?)").run("m1", "t1", "p", "tok", 1);
	const todo = (id, user) => db.prepare("INSERT INTO im_todos (id, user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").run(id, user, "待办", 1, 1);
	todo("d1", "t1");
	todo("d2", "real");

	const pushes = [];
	const IM_HUB = {
		getByName: (userId) => ({
			fetch: async (url, init) => {
				if (url.endsWith("/notify")) pushes.push({ userId, ...JSON.parse(init.body) });
				return new Response(null, { status: 204 });
			},
		}),
	};
	const BUCKET = { delete: async (key) => void objects.delete(key) };
	const env = { DB: database, MAILFLARE_RUNTIME: "node", APP_URL: "https://mail.one.test", IM_HUB, BUCKET };
	globalThis.__mailflareNodeEnv = env;
	t.after(() => { delete globalThis.__mailflareNodeEnv; });
	const count = (sql, ...params) => db.prepare(sql).get(...params).n;
	return { db, env, objects, pushes, count, realInAll };
}

test("chat data is filed by the people it involves, the all-staff group by sender", () => {
	const real = new Set(["real"]);
	assert.equal(mod.categorizePeople(["t1", "t2"], "admin", real), "test");
	assert.equal(mod.categorizePeople(["admin", "t1"], "admin", real), "admin");
	assert.equal(mod.categorizePeople(["admin", "real"], "admin", real), "colleague");
	assert.deepEqual(mod.imFileIdsInBody('{"url":"https://x/api/im/files/abc/a.png","b":"/api/im/files/def/b"}'), ["abc", "def"]);
	assert.deepEqual(mod.parseImPurgeEmails(" A@x.cn，b@x.cn;a@x.cn  nope"), ["a@x.cn", "b@x.cn"]);
	assert.deepEqual(mod.parseImPurgeCategories(["test", "colleague", "all"]), ["test", "colleague"]);
});

test("changes of several runs merge into what one client must drop", () => {
	const merged = mod.mergeImPurgeRoomChanges(
		[
			{ at: 30, rooms: [{ roomId: "1", all: false, msgIds: ["7"] }] },
			{ at: 20, rooms: [{ roomId: "1", all: false, msgIds: ["5"] }, { roomId: "a", all: true, msgIds: [] }] },
			{ at: 10, rooms: [{ roomId: "b", all: true, msgIds: [] }] },
		],
		10,
	);
	assert.equal(merged.epoch, 30);
	assert.deepEqual(merged.rooms.find((room) => room.roomId === "1").msgIds.sort(), ["5", "7"]);
	assert.ok(merged.rooms.some((room) => room.roomId === "a" && room.all));
	assert.ok(!merged.rooms.some((room) => room.roomId === "b"), "runs already applied are left out");
});

test("the preview counts each category without removing anything", async (t) => {
	const { env, count } = await fixture(t);
	const preview = await previewImPurge(env, "admin", REAL, NOW);
	const byKey = Object.fromEntries(preview.categories.map((category) => [category.key, category]));
	assert.deepEqual(preview.realAccounts, ["real@one.test"]);
	assert.equal(byKey.test.rooms, 2, "the private test chat and the test group");
	assert.equal(byKey.test.messages, 5, "3 + 1 in the group + t2's all-staff message");
	assert.deepEqual([byKey.test.files, byKey.test.meetings, byKey.test.todos], [4, 1, 1], "files 1, 3, the old unsent 4 and the test group's avatar 9; file 2 lives on in a kept chat");
	assert.equal(byKey.admin.messages, 2);
	assert.equal(byKey.colleague.rooms, 1);
	assert.equal(byKey.colleague.defaultChecked, false);
	assert.ok(byKey.test.conversations.some((item) => item.kind === "allStaff"), "the all-staff share is listed on its own");
	assert.equal(count("SELECT count(*) n FROM im_messages"), 10);
});

test("a run removes test and admin chat history, keeps colleagues, accounts and the all-staff group, and runs twice safely", async (t) => {
	const { db, env, objects, pushes, count, realInAll } = await fixture(t);
	const result = await runImPurge(env, "admin", REAL, ["test", "admin"], NOW);
	assert.deepEqual(
		[result.rooms, result.messages, result.files, result.roomFiles, result.meetings, result.todos],
		[3, 7, 4, 1, 2, 1],
	);
	assert.deepEqual(db.prepare("SELECT id FROM im_rooms ORDER BY id").all().map((row) => row.id), ["1", "rt"]);
	assert.deepEqual(db.prepare("SELECT id FROM im_messages WHERE room_id = '1'").all().map((row) => row.id), [realInAll]);
	assert.equal(db.prepare("SELECT last_msg_id FROM im_rooms WHERE id = '1'").get().last_msg_id, realInAll);
	assert.equal(count("SELECT count(*) n FROM im_room_members WHERE room_id = '1'"), 4, "everyone stays in the all-staff group");
	assert.equal(count("SELECT count(*) n FROM users"), 4);
	assert.equal(count("SELECT count(*) n FROM im_messages_fts WHERE rowid NOT IN (SELECT id FROM im_messages)"), 0);
	assert.equal(count("SELECT count(*) n FROM im_messages_fts WHERE im_messages_fts MATCH '测试账号'"), 0, "search no longer finds removed chat");
	assert.deepEqual([...objects.keys()].sort(), [2, 5, 6].map((n) => `im-files/${fileId(n)}`), "kept: forwarded, still uploading, a colleague's; the removed group's avatar goes too");
	assert.deepEqual(db.prepare("SELECT id FROM im_meetings").all().map((row) => row.id), ["m3"]);
	assert.equal(count("SELECT count(*) n FROM im_meeting_participants"), 0);
	assert.deepEqual(db.prepare("SELECT id FROM im_todos").all().map((row) => row.id), ["d2"]);
	assert.equal(count("SELECT count(*) n FROM audit_logs WHERE action = 'im.chat_purge' AND actor_user_id = 'admin'"), 1);
	assert.deepEqual(new Set(pushes.filter((push) => push.type === "chatPurged").map((push) => push.userId)), new Set(["admin", "t1", "t2", "real"]));

	const again = await runImPurge(env, "admin", REAL, ["test", "admin"], NOW + 1);
	assert.deepEqual([again.rooms, again.messages, again.files, again.meetings, again.todos], [0, 0, 0, 0, 0]);
});

test("HuLa reads what to drop locally since the epoch it last applied", async (t) => {
	const { env } = await fixture(t);
	await runImPurge(env, "admin", REAL, ["test"], NOW);
	const call = async (method, path, { body, token, query } = {}) => {
		const url = new URL(`https://mail.one.test/api/im/${path}`);
		for (const [key, value] of Object.entries(query ?? {})) url.searchParams.set(key, value);
		const response = await handleImRequest(new Request(url, { method, headers: { "Content-Type": "application/json", ...(token ? { token } : {}) }, body: body && JSON.stringify(body) }), env);
		return response.json();
	};
	const token = (await call("POST", "oauth/anyTenant/login", { body: { account: "t1@one.test", password: "right-password" } })).data.token;
	const fresh = (await call("GET", "im/chat/purges", { token, query: { since: "0" } })).data;
	assert.equal(fresh.epoch, NOW);
	assert.ok(fresh.rooms.some((room) => room.roomId === "tt" && room.all));
	const allStaff = fresh.rooms.find((room) => room.roomId === "1");
	assert.equal(allStaff.all, false);
	assert.equal(allStaff.msgIds.length, 1, "only t2's all-staff message");
	const applied = (await call("GET", "im/chat/purges", { token, query: { since: String(NOW) } })).data;
	assert.deepEqual(applied, { epoch: NOW, rooms: [] });
});
