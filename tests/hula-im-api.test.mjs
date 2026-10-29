import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
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
			export { listShareTargets, shareMailToChats, postRoomMailCard } from "./src/lib/im/mail-share.ts";
			export { countUnreadMail } from "./src/lib/im/mail.ts";
			export { listDriveGroupFolders, listDriveGroupFiles, serveRoomFileForDrive } from "./src/lib/im/room-files.ts";
			export { exportDatabaseRecords, restoreDatabaseRecords } from "./src/lib/backups/export.ts";
			export { defaultImAvatarForUser } from "./src/lib/im/users-utils.ts";
			export { setPresence } from "./src/lib/im/chat.ts";
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
	resolveImSocketToken, findImRoute, imApiPath, parseImPairId, imPairSessionIds, listShareTargets, shareMailToChats,
	postRoomMailCard, countUnreadMail, listDriveGroupFolders, listDriveGroupFiles, serveRoomFileForDrive,
	exportDatabaseRecords, restoreDatabaseRecords,
	defaultImAvatarForUser, setPresence,
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
				if (url.endsWith("/ticket")) return Response.json({ secret: "d".repeat(48) });
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
			const bytes = stored.bytes.slice(offset, offset + length);
			return {
				body: new Response(bytes).body,
				arrayBuffer: async () => bytes.buffer,
				size: stored.bytes.byteLength,
				httpMetadata: { contentType: stored.contentType },
				httpEtag: `"${key}"`,
			};
		},
		delete: async (key) => void objects.delete(key),
		createMultipartUpload: async (key, options) => {
			const uploadId = `mp-${multipart.size + 1}`;
			multipart.set(uploadId, { key, parts: new Map(), contentType: options?.httpMetadata?.contentType });
			return { uploadId };
		},
		resumeMultipartUpload: (key, uploadId) => ({
			uploadPart: async (partNumber, value) => {
				const upload = multipart.get(uploadId);
				if (!upload || upload.key !== key) throw new Error("NoSuchUpload");
				upload.parts.set(partNumber, new Uint8Array(await new Response(value).arrayBuffer()));
				return { partNumber, etag: `etag-${partNumber}` };
			},
			complete: async (parts) => {
				const upload = multipart.get(uploadId);
				if (!upload || parts.some((part) => part.etag !== `etag-${part.partNumber}` || !upload.parts.has(part.partNumber))) throw new Error("InvalidPart");
				const bytes = new Uint8Array(await new Blob(parts.map((part) => upload.parts.get(part.partNumber))).arrayBuffer());
				objects.set(key, { bytes, contentType: upload.contentType });
				multipart.delete(uploadId);
				return { key, size: bytes.byteLength };
			},
			abort: async () => void multipart.delete(uploadId),
		}),
	};
	const multipart = new Map();
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
	return { database, env, call, raw, login, expireAccess, addUser, pushes, objects, multipart };
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
		{ uid: "u1", account: "sam@one.test", name: "Sam", avatar: "006", userStateId: "1" },
	);
});

test("chat nickname can be changed repeatedly without changing the mailbox profile", async (t) => {
	const { database, call, login, addUser, pushes } = await fixture(t);
	addUser("u2", "kim@one.test", "Kim");
	const { token } = (await login()).data;
	const other = (await login("kim@one.test")).data.token;
	await call("GET", "im/chat/contact/list", { token });
	pushes.length = 0;
	assert.equal((await call("GET", "im/user/userInfo", { token })).data.modifyNameChance, null);
	assert.equal((await call("PUT", "im/user/info", { token, body: { name: "刘老师" } })).code, 200);
	assert.equal((await call("PUT", "im/user/info", { token, body: { name: "张老师" } })).code, 200);
	assert.deepEqual(
		pushes.filter((push) => push.type === "userProfileChange" && push.data.name === "张老师").map((push) => push.userId).sort(),
		["u1", "u2"],
	);
	assert.equal((await call("GET", "im/user/userInfo", { token })).data.name, "张老师");
	assert.deepEqual(database.db.prepare("SELECT name, im_display_name FROM users WHERE id = 'u1'").get(), {
		name: "Sam", im_display_name: "张老师",
	});
	assert.equal((await call("POST", "im/user/getUserByIds", { token: other, body: { uidList: ["u1"] } })).data[0].name, "张老师");
	assert.equal((await call("GET", "im/user/friend/search", { token: other, query: { key: "张老师" } })).data[0].uid, "u1");
	const room = (await call("GET", "im/chat/contact/detail/friend", { token: other, query: { id: "u1", roomType: "2" } })).data;
	assert.equal(room.name, "张老师");
	const sent = await call("POST", "im/chat/msg", { token, body: { id: "name-check", roomId: room.roomId, msgType: 1, body: { content: "你好" } } });
	assert.equal(sent.data.fromUser.username, "张老师");
	const sync = (await call("POST", "im/chat/msg/list", { token: other })).data;
	assert.equal(sync[0].fromUser.username, "张老师");
	assert.equal((await call("PUT", "im/user/info", { token, body: { name: " " } })).code, 400);
	assert.equal((await call("PUT", "im/user/info", { token, body: { name: "123456789" } })).code, 400);
	assert.equal((await call("PUT", "im/user/info", { token, body: { name: "Changed", uid: "u2" } })).code, 400);
	assert.equal((await call("PUT", "im/user/info", { body: { name: "Changed" } })).code, 401);
	assert.equal((await call("GET", "im/user/userInfo", { token: other })).data.name, "Kim");
});

test("backups from before and after the chat nickname migration remain restorable", async (t) => {
	const { database, env } = await fixture(t);
	database.db.exec("ALTER TABLE users DROP COLUMN im_display_name");
	database.db.exec("ALTER TABLE users DROP COLUMN im_avatar");
	const oldBackup = await exportDatabaseRecords(env.DB);
	database.db.exec("ALTER TABLE users ADD COLUMN im_display_name TEXT");
	database.db.exec("ALTER TABLE users ADD COLUMN im_avatar TEXT");
	await restoreDatabaseRecords(env.DB, oldBackup.buffer);
	assert.deepEqual(database.db.prepare("SELECT name, im_display_name FROM users WHERE id = 'u1'").get(), {
		name: "Sam", im_display_name: null,
	});
	database.db.prepare("UPDATE users SET im_display_name = '小山', im_avatar = 'preset:022' WHERE id = 'u1'").run();
	const newBackup = await exportDatabaseRecords(env.DB);
	database.db.prepare("UPDATE users SET im_display_name = 'changed', im_avatar = NULL WHERE id = 'u1'").run();
	await restoreDatabaseRecords(env.DB, newBackup.buffer);
	assert.deepEqual(database.db.prepare("SELECT im_display_name, im_avatar FROM users WHERE id = 'u1'").get(), {
		im_display_name: "小山", im_avatar: "preset:022",
	});
});

test("the AI consent migration and backup restore pause automatic drafts without deleting data", async (t) => {
	const { database, env } = await fixture(t);
	database.db.prepare("INSERT INTO domains (id, user_id, hostname, zone_id, created_at) VALUES ('d1', 'u1', 'one.test', 'z', 1)").run();
	database.db.prepare("INSERT INTO mailboxes (id, user_id, domain_id, local_part, created_at) VALUES ('m1', 'u1', 'd1', 'sam', 1)").run();
	database.db.prepare("INSERT INTO mailbox_agent_settings (mailbox_id, auto_draft_enabled, daily_limit, updated_at) VALUES ('m1', 1, 7, 1)").run();
	database.db.prepare("INSERT INTO messages (id, user_id, mailbox_id, direction, from_addr, to_addr, status, created_at) VALUES ('x1', 'u1', 'm1', 'inbound', 'a@b.test', 'sam@one.test', 'received', 1)").run();
	const backup = await exportDatabaseRecords(env.DB);
	database.db.exec(readFileSync(join(root, "drizzle", "migrations", "0085_pause_unconfirmed_ai_drafts.sql"), "utf8"));
	assert.deepEqual(database.db.prepare("SELECT auto_draft_enabled, daily_limit FROM mailbox_agent_settings WHERE mailbox_id = 'm1'").get(), { auto_draft_enabled: 0, daily_limit: 7 });
	await restoreDatabaseRecords(env.DB, backup.buffer);
	assert.deepEqual(database.db.prepare("SELECT auto_draft_enabled, daily_limit FROM mailbox_agent_settings WHERE mailbox_id = 'm1'").get(), { auto_draft_enabled: 0, daily_limit: 7 });
	assert.equal(database.db.prepare("SELECT count(*) AS count FROM users").get().count, 1);
	assert.equal(database.db.prepare("SELECT count(*) AS count FROM messages").get().count, 1);
});

test("chat avatars persist presets and owned uploads without replacing the mail avatar", async (t) => {
	const { database, env, call, raw, login, addUser, pushes, objects } = await fixture(t);
	addUser("u2", "kim@one.test", "Kim");
	database.db.prepare("UPDATE users SET avatar_key = 'mail-avatar/existing' WHERE id = 'u1'").run();
	objects.set("mail-avatar/existing", { bytes: new Uint8Array([7, 8, 9]), contentType: "image/png" });
	const sam = (await login()).data.token;
	const kim = (await login("kim@one.test")).data.token;
	await call("GET", "im/chat/contact/list", { token: sam });
	pushes.length = 0;
	for (let index = 1; index <= 22; index++) {
		const code = String(index).padStart(3, "0");
		const preset = await call("POST", "im/user/avatar", { token: sam, body: { avatar: code } });
		assert.equal(preset.code, 200);
		assert.equal(preset.data.avatar, code);
	}
	assert.equal((await call("GET", "im/user/userInfo", { token: sam })).data.avatar, "022");
	assert.equal((await call("POST", "im/user/getUserByIds", { token: kim, body: { uidList: ["u1"] } })).data[0].avatar, "022");
	const groupMembers = (await call("GET", "im/room/group/listMember", { token: kim, query: { roomId: "1" } })).data;
	assert.equal(groupMembers.find((member) => member.uid === "u1").avatar, "022");
	const room = (await call("GET", "im/chat/contact/detail/friend", { token: kim, query: { id: "u1", roomType: "2" } })).data;
	assert.equal(room.avatar, "022");
	const sent = await call("POST", "im/chat/msg", { token: sam, body: { id: "avatar-test", roomId: room.roomId, msgType: 1, body: { content: "头像验证消息" } } });
	assert.equal(sent.data.fromUser.avatar, "022");
	const search = (await call("GET", "im/search", { token: kim, query: { keyword: "头像验证", scope: "chat" } })).data.chat.list[0];
	assert.equal(search.fromAvatar, "022");
	assert.equal(search.roomAvatar, "022");
	assert.equal((await raw("GET", "https://mail.one.test/api/im/avatar/u1")).headers.get("Location"), "https://mail.one.test/im/avatar/022.webp");
	assert.deepEqual(
		pushes.filter((push) => push.type === "userProfileChange" && push.data.avatar === "022").map((push) => push.userId).sort(),
		["u1", "u2"],
	);
	assert.equal(database.db.prepare("SELECT avatar_key FROM users WHERE id = 'u1'").get().avatar_key, "mail-avatar/existing");
	assert.equal((await call("POST", "im/user/avatar", { token: sam, body: { avatar: "023" } })).code, 400);
	assert.equal((await call("POST", "im/user/avatar", { token: sam, body: { avatar: "https://evil.test/image.png" } })).code, 400);
	assert.equal((await call("POST", "im/user/avatar", { body: { avatar: "001" } })).code, 401);

	const png = new Uint8Array(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZsAAAAASUVORK5CYII=", "base64"));
	const upload = (await call("GET", "system/anyTenant/ossToken", { token: sam, query: { fileName: "avatar.png" } })).data;
	assert.equal((await call("POST", "im/user/avatar", { token: sam, body: { avatar: upload.downloadUrl } })).code, 400, "an unfinished upload is refused");
	assert.equal((await raw("PUT", upload.uploadUrl, { body: png, headers: { "Content-Length": String(png.length) } })).status, 200);
	assert.equal((await call("POST", "im/user/avatar", { token: kim, body: { avatar: upload.downloadUrl } })).code, 400, "another user's file is refused");
	const saved = await call("POST", "im/user/avatar", { token: sam, body: { avatar: upload.downloadUrl } });
	assert.equal(saved.code, 200);
	assert.match(saved.data.avatar, /^https:\/\/mail\.one\.test\/api\/im\/avatar\/u1\?v=[a-f0-9]{32}$/);
	assert.equal((await call("GET", "im/user/userInfo", { token: sam })).data.avatar, saved.data.avatar);
	assert.equal((await call("POST", "im/user/getUserByIds", { token: kim, body: { uidList: ["u1"] } })).data[0].avatar, saved.data.avatar);
	const updatedSearch = (await call("GET", "im/search", { token: kim, query: { keyword: "头像验证", scope: "chat" } })).data.chat.list[0];
	assert.equal(updatedSearch.fromAvatar, saved.data.avatar);
	assert.equal(updatedSearch.roomAvatar, saved.data.avatar);
	const image = await raw("GET", saved.data.avatar);
	assert.equal(image.headers.get("Content-Type"), "image/png");
	assert.deepEqual(new Uint8Array(await image.arrayBuffer()), png);
	const stale = await raw("GET", "https://mail.one.test/api/im/avatar/u1?v=stale");
	assert.equal(stale.status, 404);
	assert.equal(stale.headers.get("Cache-Control"), "no-store");

	database.db.prepare("UPDATE im_files SET created_at = 1").run();
	const unsent = (await call("GET", "im/chat/files/unsent", { token: sam })).data;
	assert.equal(unsent.length, 1);
	await call("POST", "im/chat/files/unsent/delete", { token: sam, body: { ids: [unsent[0].id] } });
	assert.equal(objects.size, 2, "cleanup keeps both the mail and independent chat avatar objects");
	assert.ok(objects.has("mail-avatar/existing"));
	assert.deepEqual(new Uint8Array(await (await raw("GET", saved.data.avatar)).arrayBuffer()), png);
	assert.equal((await login()).data.uid, "u1");
	assert.equal((await call("GET", "im/user/userInfo", { token: (await login()).data.token })).data.avatar, saved.data.avatar);
	const backup = await exportDatabaseRecords(env.DB);
	await call("POST", "im/user/avatar", { token: sam, body: { avatar: "001" } });
	await restoreDatabaseRecords(env.DB, backup.buffer);
	assert.deepEqual(new Uint8Array(await (await raw("GET", saved.data.avatar)).arrayBuffer()), png, "restored avatar still references its retained object");
});

test("chat avatars reject invalid content and failed storage without changing the saved avatar", async (t) => {
	const { env, call, raw, login, objects } = await fixture(t);
	const token = (await login()).data.token;
	await call("POST", "im/user/avatar", { token, body: { avatar: "001" } });
	const invalid = (await call("GET", "system/anyTenant/ossToken", { token, query: { fileName: "avatar.png" } })).data;
	await raw("PUT", invalid.uploadUrl, { body: new Uint8Array([1, 2, 3]), headers: { "Content-Length": "3" } });
	assert.equal((await call("POST", "im/user/avatar", { token, body: { avatar: invalid.downloadUrl } })).code, 400);
	assert.equal((await call("GET", "im/user/userInfo", { token })).data.avatar, "001");
	const valid = (await call("GET", "system/anyTenant/ossToken", { token, query: { fileName: "avatar.png" } })).data;
	const png = new Uint8Array(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZsAAAAASUVORK5CYII=", "base64"));
	await raw("PUT", valid.uploadUrl, { body: png, headers: { "Content-Length": String(png.length) } });
	const put = env.BUCKET.put;
	env.BUCKET.put = async (key, ...args) => {
		if (key.startsWith("im-avatars/")) throw new Error("storage unavailable");
		return put(key, ...args);
	};
	await assert.rejects(() => call("POST", "im/user/avatar", { token, body: { avatar: valid.downloadUrl } }), /storage unavailable/);
	assert.equal((await call("GET", "im/user/userInfo", { token })).data.avatar, "001");
	assert.equal([...objects.keys()].filter((key) => key.startsWith("im-avatars/")).length, 0);
	env.BUCKET.put = put;
	const prepare = env.DB.prepare.bind(env.DB);
	env.DB.prepare = (sql) => sql.startsWith("UPDATE users SET im_avatar")
		? { bind: () => ({ run: async () => { throw new Error("database unavailable"); } }) }
		: prepare(sql);
	try {
		await assert.rejects(() => call("POST", "im/user/avatar", { token, body: { avatar: valid.downloadUrl } }), /database unavailable/);
	} finally {
		env.DB.prepare = prepare;
	}
	assert.equal((await call("GET", "im/user/userInfo", { token })).data.avatar, "001");
	assert.equal([...objects.keys()].filter((key) => key.startsWith("im-avatars/")).length, 0, "failed writes clean up the new object");
});

test("chat avatar size limit accepts 1 MB and rejects one byte more", async (t) => {
	const { call, raw, login } = await fixture(t);
	const token = (await login()).data.token;
	const base = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZsAAAAASUVORK5CYII=", "base64");
	const pngOfSize = (size) => {
		const length = size - base.length - 12;
		const chunk = Buffer.alloc(length + 12, 0x78);
		chunk.writeUInt32BE(length, 0);
		chunk.write("tEXt", 4);
		chunk.write("p\0", 8);
		let crc = 0xffffffff;
		for (const byte of chunk.subarray(4, 8 + length)) {
			crc ^= byte;
			for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
		}
		chunk.writeUInt32BE((crc ^ 0xffffffff) >>> 0, 8 + length);
		return Buffer.concat([base.subarray(0, -12), chunk, base.subarray(-12)]);
	};
	const upload = async (size) => {
		const file = (await call("GET", "system/anyTenant/ossToken", { token, query: { fileName: "avatar.png" } })).data;
		const bytes = pngOfSize(size);
		assert.equal(bytes.length, size);
		assert.equal((await raw("PUT", file.uploadUrl, { body: bytes, headers: { "Content-Length": String(size) } })).status, 200);
		return call("POST", "im/user/avatar", { token, body: { avatar: file.downloadUrl } });
	};
	const maximum = await upload(1024 * 1024);
	assert.equal(maximum.code, 200);
	const tooLarge = await upload(1024 * 1024 + 1);
	assert.equal(tooLarge.code, 400);
	assert.equal((await call("GET", "im/user/userInfo", { token })).data.avatar, maximum.data.avatar);
});

test("trades the access token for a one-time socket ticket, like the socket used to accept it", async (t) => {
	const { call, login, expireAccess } = await fixture(t);
	const { data } = await login();
	const issued = await call("POST", "ws/ticket", { token: data.token });
	assert.equal(issued.code, 200);
	assert.equal(issued.data.ticket, `u1.${"d".repeat(48)}`);
	assert.equal(issued.data.expiresIn, 60);

	// An expired access token still gets one while its refresh token lives; the refresh token itself never does.
	assert.equal((await call("POST", "ws/ticket", { token: expireAccess(data.token) })).code, 200);
	assert.equal((await call("POST", "ws/ticket", { token: data.refreshToken })).code, 401);
	assert.equal((await call("POST", "ws/ticket")).code, 401);
});

test("people without a picture get a stable preset and groups keep their generated avatar", async (t) => {
	const { raw, addUser, call, login, database } = await fixture(t);
	addUser("u2", "kim@one.test", "Kim");
	database.db.prepare("UPDATE users SET avatar_key = '' WHERE id = 'u2'").run();
	assert.deepEqual(
		["u1", "u2", "user-123", "用户😀"].map(defaultImAvatarForUser),
		["006", "007", "022", "002"],
	);
	assert.equal(new Set(Array.from({ length: 1000 }, (_, index) => defaultImAvatarForUser(`user-${index}`))).size, 22);
	const token = (await login()).data.token;
	const people = (await call("POST", "im/user/getUserByIds", { token, body: { uidList: ["u1", "u2"] } })).data;
	assert.deepEqual(people.map(({ uid, avatar }) => [uid, avatar]).sort(), [["u1", "006"], ["u2", "007"]]);
	const first = await raw("GET", "https://mail.one.test/api/im/avatar/u1");
	assert.equal(first.status, 302);
	assert.equal(first.headers.get("Location"), "https://mail.one.test/im/avatar/006.webp");
	assert.equal((await raw("GET", "https://mail.one.test/api/im/avatar/u1")).headers.get("Location"), first.headers.get("Location"));
	assert.equal((await raw("GET", "https://mail.one.test/api/im/avatar/u2")).headers.get("Location"), "https://mail.one.test/im/avatar/007.webp");
	const unknown = await raw("GET", "https://mail.one.test/api/im/avatar/unknown");
	assert.equal(unknown.status, 200);
	assert.match(await unknown.text(), /^<svg/);
	const group = await raw("GET", "https://mail.one.test/api/im/room-avatar/1");
	assert.equal(group.status, 200);
	assert.match(await group.text(), /^<svg/);
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
	const { database, call, login } = await fixture(t);
	const { token } = (await login()).data;
	const sessions = (await call("GET", "im/chat/contact/list", { token })).data;
	assert.equal(sessions.length, 1);
	assert.deepEqual(
		{ roomId: sessions[0].roomId, type: sessions[0].type, hotFlag: sessions[0].hotFlag, memberNum: sessions[0].memberNum, unreadCount: sessions[0].unreadCount, text: sessions[0].text },
		{ roomId: "1", type: 1, hotFlag: 1, memberNum: 1, unreadCount: 0, text: "" },
	);
	assert.deepEqual((await call("POST", "im/chat/msg/list", { token, body: { async: true } })).data, []);
	assert.deepEqual((await call("GET", "im/room/group/list", { token })).data.map((group) => group.roomId), ["1"]);
	const group = (await call("GET", "im/room/group/list", { token })).data[0];
	assert.equal(group.memberNum, 1);
	assert.equal(group.onlineNum, 0);
	assert.equal(group.groupName, "全员群");
	const detail = (await call("GET", "im/room/group/detail", { token, query: { id: "1" } })).data;
	assert.equal(group.memberNum, detail.memberNum);
	assert.equal(group.onlineNum, detail.onlineNum);
	database.db.prepare("INSERT INTO im_presence (user_id, online, last_opt_time) VALUES ('u1', 1, 1)").run();
	const onlineGroup = (await call("GET", "im/room/group/list", { token })).data[0];
	assert.equal(onlineGroup.onlineNum, 1);
	assert.equal(onlineGroup.memberNum, 1);
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

test("group counts use the same active users and presence as the member list", async (t) => {
	const { database, call, login, addUser } = await fixture(t);
	addUser("u2", "kim@one.test", "Kim");
	addUser("u3", "lee@one.test", "Lee");
	const { token } = (await login()).data;
	const created = await call("POST", "im/room/group", { token, body: { uidList: ["u2", "u3"] } });
	const roomId = created.data.roomId;
	database.db.prepare("INSERT INTO im_presence (user_id, online, last_opt_time) VALUES ('u1', 1, 1), ('u2', 0, 1), ('u3', 1, 1)").run();
	database.db.prepare("UPDATE users SET disabled = 1 WHERE id = 'u3'").run();
	const members = (await call("GET", "im/room/group/listMember", { token, query: { roomId } })).data;
	const detail = (await call("GET", "im/room/group/detail", { token, query: { id: roomId } })).data;
	const group = (await call("GET", "im/room/group/list", { token })).data.find((item) => item.roomId === roomId);
	assert.equal(detail.memberNum, members.length);
	assert.equal(detail.onlineNum, members.filter((member) => member.activeStatus === 1).length);
	assert.deepEqual({ memberNum: group.memberNum, onlineNum: group.onlineNum }, { memberNum: 2, onlineNum: 1 });
});

test("user-selected availability persists and invisibility is respected by other users", async (t) => {
	const { database, call, login, addUser, pushes } = await fixture(t);
	addUser("u2", "kim@one.test", "Kim");
	const owner = (await login()).data.token;
	const peer = (await login("kim@one.test")).data.token;
	await call("GET", "im/room/group/list", { token: owner });
	database.db.prepare("INSERT INTO im_presence (user_id, online, last_opt_time) VALUES ('u1', 1, 1), ('u2', 1, 1)").run();

	assert.equal((await call("POST", "im/user/state/changeState", { token: owner, body: { id: "2" } })).code, 200);
	assert.equal((await call("GET", "im/user/userInfo", { token: owner })).data.userStateId, "2");
	let person = (await call("POST", "im/user/getUserByIds", { token: peer, body: { uidList: ["u1"] } })).data[0];
	assert.equal(person.activeStatus, 1);
	assert.equal(person.userStateId, "2");
	assert.ok(pushes.some((event) => event.userId === "u2" && event.type === "userStateChange" && event.data.uid === "u1"));

	assert.equal((await call("POST", "im/user/state/changeState", { token: owner, body: { id: "5" } })).code, 200);
	assert.equal((await call("GET", "im/user/userInfo", { token: owner })).data.userStateId, "5");
	person = (await call("POST", "im/user/getUserByIds", { token: peer, body: { uidList: ["u1"] } })).data[0];
	assert.equal(person.activeStatus, 2);
	assert.equal(person.userStateId, "1", "other users cannot distinguish invisible from offline");
	assert.ok(pushes.some((event) => event.userId === "u2" && event.type === "presenceChanged" && event.data.uid === "u1" && event.data.activeStatus === 2));
	assert.ok(!pushes.some((event) => event.userId === "u2" && event.data?.userStateId === "5"));
	const members = (await call("GET", "im/room/group/listMember", { token: peer, query: { roomId: "1" } })).data;
	const group = (await call("GET", "im/room/group/list", { token: peer })).data[0];
	assert.equal(group.onlineNum, members.filter((member) => member.activeStatus === 1).length);
	assert.equal(group.onlineNum, 1);

	assert.equal((await call("POST", "im/user/state/changeState", { token: owner, body: { id: "unknown" } })).code, 400);
	assert.equal((await call("GET", "im/user/userInfo", { token: owner })).data.userStateId, "5");
	assert.equal((await call("POST", "im/user/state/changeState", { token: owner, body: { id: "0" } })).code, 200);
	assert.equal((await call("GET", "im/user/userInfo", { token: owner })).data.userStateId, "1");
	assert.equal((await call("GET", "im/room/group/list", { token: peer })).data[0].onlineNum, 2);
});

test("connection presence changes notify authorized peers without duplicate transitions", async (t) => {
	const { env, call, login, addUser, pushes } = await fixture(t);
	addUser("u2", "kim@one.test", "Kim");
	const owner = (await login()).data.token;
	await call("GET", "im/room/group/list", { token: owner });

	await setPresence(env, "u1", true);
	await setPresence(env, "u1", true);
	await setPresence(env, "u1", false);

	const transitions = pushes.filter((event) => event.userId === "u2" && event.type === "presenceChanged");
	assert.deepEqual(transitions.map((event) => ({ uid: event.data.uid, activeStatus: event.data.activeStatus })), [
		{ uid: "u1", activeStatus: 1 },
		{ uid: "u1", activeStatus: 2 },
	]);
	assert.ok(transitions[1].data.lastOptTime > transitions[0].data.lastOptTime);
});

test("the directory search finds anyone by name, pinyin mailbox, department or title", async (t) => {
	const { database, call, login, addUser } = await fixture(t);
	addUser("u2", "wangxx@one.test", "王小霞");
	addUser("u3", "zhaoxia@one.test", "赵霞");
	addUser("u4", "lisi@one.test", "李四");
	addUser("u5", "xiale@one.test", "夏乐");
	database.db.prepare("INSERT INTO business_cards (user_id, token, title, department, updated_at) VALUES (?, ?, ?, ?, ?)")
		.run("u4", "card-u4", "工程师", "生产制造部", 1);
	const { token } = (await login()).data;
	const search = async (key) => (await call("GET", "im/user/friend/search", { token, query: { key } })).data;

	assert.deepEqual((await search("霞")).map((person) => person.uid), ["u2", "u3"]);
	assert.equal((await search("霞"))[0].name, "王小霞");
	assert.deepEqual((await search("WANGXX")).map((person) => person.uid), ["u2"], "the mailbox name is the pinyin");
	assert.deepEqual((await search("xia")).map((person) => person.uid), ["u5", "u3"], "a leading match ranks first");
	assert.deepEqual((await search("one.test")).map((person) => person.uid), [], "the domain alone matches nobody");
	assert.deepEqual((await search("lisi@one")).map((person) => person.uid), ["u4"]);
	const engineer = await search("制造");
	assert.deepEqual(engineer.map((person) => person.uid), ["u4"]);
	assert.equal(engineer[0].department, "生产制造部");
	assert.equal(engineer[0].title, "工程师");
	assert.deepEqual((await search("sam")).map((person) => person.uid), [], "the caller is left out");
	assert.deepEqual(await search("  "), []);

	database.db.prepare("UPDATE users SET disabled = 1 WHERE id = 'u3'").run();
	assert.deepEqual((await search("霞")).map((person) => person.uid), ["u2"]);
	assert.equal((await call("GET", "im/user/friend/search", { query: { key: "霞" } })).code, 401);
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
	// Both members get it: Kim, and Sam's other devices. The client id lets the sending client skip its own copy.
	assert.deepEqual(
		pushes.map((push) => [push.userId, push.type, push.data.message.id, push.data.message.clientMsgId]).sort(),
		[["u1", "receiveMessage", sent.data.message.id, "tmp-1"], ["u2", "receiveMessage", sent.data.message.id, "tmp-1"]],
	);

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

test("a send is one D1 round trip, and its refusals keep their old order", async (t) => {
	const { call, login, addUser, database, env, expireAccess, objects } = await fixture(t);
	addUser("u2", "kim@one.test", "Kim");
	addUser("u3", "lee@one.test", "Lee");
	const sam = (await login()).data.token;
	const lee = (await login("lee@one.test")).data.token;
	const room = (await call("GET", "im/chat/contact/detail/friend", { token: sam, query: { id: "u2", roomType: "2" } })).data.roomId;
	const first = await call("POST", "im/chat/msg", { token: sam, body: { id: "c-1", roomId: room, msgType: 1, body: { content: "第一条" } } });

	// Count what reaches the database: each prepared statement run on its own, or one batch, is one round trip.
	let trips = 0;
	const db = env.DB;
	env.DB = {
		prepare: (sql) => {
			const wrap = (statement) => ({
				bind: (...values) => wrap(statement.bind(...values)),
				first: (...args) => (trips++, statement.first(...args)),
				all: () => (trips++, statement.all()),
				run: () => (trips++, statement.run()),
				raw: (...args) => (trips++, statement.raw(...args)),
				inner: statement,
			});
			return wrap(db.prepare(sql));
		},
		batch: (statements) => (trips++, db.batch(statements.map((statement) => statement.inner))),
	};
	t.after(() => { env.DB = db; });

	const reply = await call("POST", "im/chat/msg", { token: sam, body: { id: "c-2", roomId: room, msgType: 1, body: { content: "第二条", replyMsgId: first.data.message.id } } });
	assert.equal(reply.code, 200);
	assert.equal(trips, 1, "auth, membership, insert, room updates, render and recipients in one batch");
	assert.equal(reply.data.message.body.reply.username, "Sam");
	assert.equal(reply.data.message.body.reply.body, "第一条");
	const stored = database.db.prepare("SELECT last_msg_id, active_time FROM im_rooms WHERE id = ?").get(room);
	assert.equal(String(stored.last_msg_id), reply.data.message.id);
	assert.equal(database.db.prepare("SELECT last_read_msg_id FROM im_room_members WHERE room_id = ? AND user_id = 'u1'").get(room).last_read_msg_id, Number(reply.data.message.id));

	trips = 0;
	const all = await call("POST", "im/chat/msg", { token: sam, body: { id: "c-3", roomId: "1", msgType: 1, body: { content: "大家好" } } });
	assert.equal(all.code, 200);
	assert.equal(trips, 1, "the all-staff room joins the same batch");
	assert.deepEqual(database.db.prepare("SELECT user_id FROM im_room_members WHERE room_id = '1' ORDER BY user_id").all().map((row) => row.user_id), ["u1", "u2", "u3"]);

	const count = () => database.db.prepare("SELECT COUNT(*) AS n FROM im_messages").get().n;
	const before = count();
	assert.equal((await call("POST", "im/chat/msg", { token: lee, body: { id: "x-1", roomId: room, msgType: 1, body: { content: "hi" } } })).code, 403);
	assert.equal((await call("POST", "im/chat/msg", { token: "imat_nope", body: { roomId: room, msgType: 1, body: { content: "hi" } } })).code, 401);
	assert.equal((await call("POST", "im/chat/msg", { token: "imat_nope", body: { roomId: room, msgType: 99 } })).code, 401, "sign-in is checked before the message");
	assert.equal((await call("POST", "im/chat/msg", { token: lee, body: { roomId: room, msgType: 99 } })).code, 403, "membership is checked before the message");
	assert.equal(count(), before, "refused sends store nothing");

	const upload = (await call("GET", "system/anyTenant/ossToken", { token: sam, query: { fileName: "a.png" } })).data;
	const fileUrl = upload.downloadUrl;
	assert.equal((await call("POST", "im/chat/msg", { token: sam, body: { roomId: room, msgType: 3, body: { url: fileUrl, size: 3 } } })).code, 400, "a file that is not uploaded yet");
	assert.equal(count(), before);
	assert.equal(objects.size, 0);

	expireAccess(sam);
	assert.equal((await call("POST", "im/chat/msg", { token: sam, body: { roomId: room, msgType: 1, body: { content: "late" } } })).code, 406);
	assert.equal(count(), before);
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
	assert.equal(detail.avatar, `https://mail.one.test/api/im/room-avatar/${roomId}`, "a group without a picture gets a generated one");

	assert.equal((await call("POST", "im/room/updateRoomInfo", { token: kim, body: { id: roomId, name: "Team" } })).code, 403);
	assert.equal((await call("POST", "im/room/updateRoomInfo", { token: sam, body: { id: roomId, name: "Team" } })).code, 200);
	assert.equal((await call("GET", "im/chat/contact/detail", { token: kim, query: { id: roomId } })).data.name, "Team");

	assert.equal((await call("POST", "im/room/group/member", { token: kim, body: { roomId, uidList: ["u4"] } })).code, 200, "any member can invite");
	assert.equal((await call("DELETE", "im/room/group/member", { token: kim, body: { roomId, uidList: ["u4"] } })).code, 403);
	assert.equal((await call("PUT", "im/room/group/admin", { token: sam, body: { roomId, uidList: ["u2"] } })).code, 200);
	assert.equal((await call("DELETE", "im/room/group/member", { token: kim, body: { roomId, uidList: ["u4", "u1"] } })).code, 200, "admins remove members but never the owner");
	const members = (await call("GET", "im/room/group/listMember", { token: sam, query: { roomId } })).data;
	assert.deepEqual(members.map((member) => [member.uid, member.roleId]), [["u1", 1], ["u2", 2], ["u3", 3]]);

	assert.equal((await call("DELETE", "im/room/group/member/exit", { token: sam, body: { roomId } })).code, 400, "an owner hands the group over before leaving");
	assert.equal((await call("PUT", "im/room/group/owner", { token: kim, body: { roomId, uid: "u2" } })).code, 403);
	assert.equal((await call("PUT", "im/room/group/owner", { token: sam, body: { roomId, uid: "u4" } })).code, 400, "only to a member");
	pushes.length = 0;
	assert.equal((await call("PUT", "im/room/group/owner", { token: sam, body: { roomId, uid: "u2" } })).code, 200);
	const roleChange = pushes.find((push) => push.type === "groupSetAdmin");
	assert.deepEqual(roleChange.data, { roomId, uids: ["u1"], status: false, roles: { u2: 1, u1: 3 } });
	assert.equal(pushes.find((push) => push.type === "receiveMessage").data.message.body, "Sam将群主转让给了Kim");
	assert.equal((await call("GET", "im/chat/contact/detail", { token: kim, query: { id: roomId } })).data.operate, 1, "the owner's session offers dissolving");
	assert.equal((await call("GET", "im/chat/contact/detail", { token: sam, query: { id: roomId } })).data.operate, 2);

	pushes.length = 0;
	assert.equal((await call("DELETE", "im/room/group/member/exit", { token: sam, body: { roomId } })).code, 200);
	const exitChange = pushes.find((push) => push.type === "memberChange");
	assert.equal(exitChange.data.changeType, 3);
	assert.deepEqual(exitChange.data.userList.map((user) => user.uid), ["u1"]);
	assert.equal(exitChange.data.totalNum, 2);
	assert.ok(pushes.some((push) => push.type === "memberChange" && push.userId === "u1"), "the one who left is told too");
	const after = (await call("GET", "im/room/group/listMember", { token: kim, query: { roomId } })).data;
	assert.deepEqual(after.map((member) => [member.uid, member.roleId]), [["u2", 1], ["u3", 3]]);
	assert.equal((await call("GET", "im/room/group/listMember", { token: sam, query: { roomId } })).code, 403);
});

test("group management pushes: rename, picture, members and admins reach every member at once", async (t) => {
	const { call, login, addUser, pushes } = await fixture(t);
	addUser("u2", "kim@one.test", "Kim");
	addUser("u3", "lee@one.test", "Lee");
	addUser("u4", "max@one.test", "Max");
	const sam = (await login()).data.token;
	const kim = (await login("kim@one.test")).data.token;
	const roomId = (await call("POST", "im/room/group", { token: sam, body: { uidList: ["u2", "u3"] } })).data.roomId;

	pushes.length = 0;
	const generated = `https://mail.one.test/api/im/room-avatar/${roomId}`;
	assert.equal((await call("POST", "im/room/updateRoomInfo", { token: sam, body: { id: roomId, name: " 项目组 ", avatar: generated } })).code, 200);
	const info = pushes.filter((push) => push.type === "roomInfoChange");
	assert.deepEqual(info.map((push) => push.userId).sort(), ["u1", "u2", "u3"]);
	assert.deepEqual(info[0].data, { roomId, name: "项目组", avatar: generated }, "sending back the generated picture keeps it generated");
	assert.equal(pushes.find((push) => push.type === "receiveMessage").data.message.body, "Sam将群名称修改为“项目组”");
	pushes.length = 0;
	assert.equal((await call("POST", "im/room/updateRoomInfo", { token: sam, body: { id: roomId, name: "项目组" } })).code, 200);
	assert.equal(pushes.length, 0, "an unchanged name says nothing");
	assert.equal((await call("POST", "im/room/updateRoomInfo", { token: sam, body: { id: roomId, avatar: "javascript:alert(1)" } })).code, 400);
	assert.equal((await call("POST", "im/room/updateRoomInfo", { token: sam, body: { id: roomId, name: "x".repeat(31) } })).code, 400);

	pushes.length = 0;
	assert.equal((await call("PUT", "im/room/group/admin", { token: sam, body: { roomId, uidList: ["u2"] } })).code, 200);
	assert.deepEqual(pushes.find((push) => push.type === "groupSetAdmin").data, { roomId, uids: ["u2"], status: true });
	assert.equal(pushes.find((push) => push.type === "receiveMessage").data.message.body, "Sam将Kim设为管理员");
	assert.equal((await call("POST", "im/room/updateRoomInfo", { token: kim, body: { id: roomId, name: "Kim 的组" } })).code, 200, "admins rename too");
	pushes.length = 0;
	assert.equal((await call("PUT", "im/room/group/admin", { token: sam, body: { roomId, uidList: ["u2"] } })).code, 200);
	assert.equal(pushes.length, 0, "no change, no news");

	pushes.length = 0;
	assert.equal((await call("POST", "im/room/group/member", { token: kim, body: { roomId, uidList: ["u4"] } })).code, 200);
	const join = pushes.find((push) => push.type === "memberChange");
	assert.deepEqual({ changeType: join.data.changeType, uids: join.data.userList.map((user) => [user.uid, user.roleId]), total: join.data.totalNum }, { changeType: 1, uids: [["u4", 3]], total: 4 });
	assert.ok(pushes.some((push) => push.type === "memberChange" && push.userId === "u4"), "the newcomer's client opens the group");

	pushes.length = 0;
	assert.equal((await call("DELETE", "im/room/group/member", { token: kim, body: { roomId, uidList: ["u4"] } })).code, 200);
	assert.ok(pushes.some((push) => push.type === "memberChange" && push.userId === "u4" && push.data.changeType === 2), "the removed member's client drops the group");

	assert.equal((await call("DELETE", "im/room/group/member/exit", { token: kim, body: { roomId, dissolve: true } })).code, 403, "only the owner dissolves");
	pushes.length = 0;
	assert.equal((await call("DELETE", "im/room/group/member/exit", { token: sam, body: { roomId, dissolve: true } })).code, 200);
	assert.deepEqual(pushes.filter((push) => push.type === "roomDissolution").map((push) => [push.userId, push.data]).sort(), [["u1", roomId], ["u2", roomId], ["u3", roomId]]);
	assert.equal((await call("GET", "im/chat/contact/detail", { token: kim, query: { id: roomId } })).code, 403, "the group is gone");
});

test("group announcements: managers publish, edit, pin and delete; members read and are told", async (t) => {
	const { call, login, addUser, pushes, database } = await fixture(t);
	addUser("u2", "kim@one.test", "Kim");
	addUser("u3", "lee@one.test", "Lee");
	const sam = (await login()).data.token;
	const kim = (await login("kim@one.test")).data.token;
	const roomId = (await call("POST", "im/room/group", { token: sam, body: { uidList: ["u2", "u3"] } })).data.roomId;

	assert.deepEqual((await call("GET", "im/room/announcement/list", { token: kim, query: { roomId, current: 1, size: 10 } })).data.records, []);
	assert.equal((await call("POST", "im/room/announcement/push", { token: kim, body: { roomId, content: "hi", top: false } })).code, 403);
	assert.equal((await call("POST", "im/room/announcement/push", { token: sam, body: { roomId, content: "  ", top: false } })).code, 400);
	pushes.length = 0;
	const first = (await call("POST", "im/room/announcement/push", { token: sam, body: { roomId, content: "周五例会改到三点", top: true } })).data;
	assert.deepEqual({ content: first.content, top: first.top, uid: first.uid, userName: first.userName }, { content: "周五例会改到三点", top: true, uid: "u1", userName: "Sam" });
	const card = pushes.find((push) => push.type === "receiveMessage" && push.userId === "u2").data.message;
	assert.deepEqual({ type: card.type, content: card.body.content, id: card.body.id }, { type: 10, content: "周五例会改到三点", id: first.id });
	assert.deepEqual(pushes.filter((push) => push.type === "roomGroupNoticeMsg").map((push) => push.userId).sort(), ["u1", "u2", "u3"]);
	assert.equal((await call("GET", "im/chat/contact/detail", { token: kim, query: { id: roomId } })).data.text, "Sam:[群公告] 周五例会改到三点");

	const second = (await call("POST", "im/room/announcement/push", { token: sam, body: { roomId, content: "第二条", top: true } })).data;
	let list = (await call("GET", "im/room/announcement/list", { token: kim, query: { roomId, current: 1, size: 10 } })).data;
	assert.deepEqual(list.records.map((record) => [record.id, record.top]), [[second.id, true], [first.id, false]], "one pinned at a time, pinned first");
	assert.equal(list.total, "2");

	await call("PUT", "im/room/group/admin", { token: sam, body: { roomId, uidList: ["u2"] } });
	pushes.length = 0;
	const edited = (await call("POST", "im/room/announcement/edit", { token: kim, body: { id: first.id, roomId, content: "例会取消", top: true } })).data;
	assert.deepEqual({ content: edited.content, top: edited.top }, { content: "例会取消", top: true });
	assert.ok(pushes.some((push) => push.type === "roomEditGroupNoticeMsg"));
	list = (await call("GET", "im/room/announcement/list", { token: sam, query: { roomId, current: 1, size: 10 } })).data;
	assert.deepEqual(list.records.map((record) => [record.id, record.top]), [[first.id, true], [second.id, false]]);
	assert.equal((await call("GET", "im/room/announcement", { token: sam, query: { roomId, announcementId: first.id } })).data.content, "例会取消");

	assert.equal((await call("POST", "im/room/announcement/delete", { token: kim, query: { id: second.id } })).code, 200);
	assert.equal((await call("GET", "im/room/announcement/list", { token: sam, query: { roomId } })).data.total, "1");
	addUser("u9", "out@one.test", "Out");
	const outsider = (await login("out@one.test")).data.token;
	assert.equal((await call("GET", "im/room/announcement/list", { token: outsider, query: { roomId } })).code, 403);
	assert.equal((await call("POST", "im/room/announcement/delete", { token: outsider, query: { id: first.id } })).code, 403);

	assert.equal((await call("POST", "im/room/announcement/push", { token: kim, body: { roomId: "1", content: "全员通知", top: false } })).code, 403);
	database.db.prepare("UPDATE users SET role = 'admin' WHERE id = 'u1'").run();
	assert.equal((await call("POST", "im/room/announcement/push", { token: sam, body: { roomId: "1", content: "全员通知", top: false } })).code, 200, "mailflare admins announce to everyone");
});

test("@全体成员 is for a group's owner and admins", async (t) => {
	const { call, login, addUser } = await fixture(t);
	addUser("u2", "kim@one.test", "Kim");
	addUser("u3", "lee@one.test", "Lee");
	const sam = (await login()).data.token;
	const kim = (await login("kim@one.test")).data.token;
	const roomId = (await call("POST", "im/room/group", { token: sam, body: { uidList: ["u2", "u3"] } })).data.roomId;
	const send = (token, id) => call("POST", "im/chat/msg", { token, body: { id, roomId, msgType: 1, body: { content: "@全体成员 开会", atUidList: ["0"] } } });
	const refused = await send(kim, "k1");
	assert.equal(refused.code, 403);
	assert.equal(refused.msg, "只有群主和管理员可以@全体成员");
	const sent = await send(sam, "s1");
	assert.equal(sent.code, 200);
	assert.deepEqual(sent.data.message.body.atUidList, ["0"]);
	const history = (await call("GET", "im/chat/msg/page", { token: kim, query: { roomId, pageSize: 20 } })).data.list;
	assert.equal(history.filter((message) => message.message.body?.atUidList).length, 1, "the refused send stored nothing");
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
	const desktop = await raw("GET", cred.downloadUrl, { headers: { Origin: "http://tauri.localhost" } });
	assert.equal(desktop.headers.get("Access-Control-Allow-Origin"), "http://tauri.localhost", "the desktop webview fetches voice files itself");
	assert.equal((await raw("GET", cred.downloadUrl, { headers: { Origin: "https://evil.test" } })).headers.get("Access-Control-Allow-Origin"), null);
	const preflight = await raw("OPTIONS", cred.downloadUrl, { headers: { Origin: "tauri://localhost", "Access-Control-Request-Headers": "range" } });
	assert.equal(preflight.status, 204);
	assert.equal(preflight.headers.get("Access-Control-Allow-Origin"), "tauri://localhost");
	assert.match(preflight.headers.get("Access-Control-Allow-Headers"), /Range/);

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

test("files over one part go up in parts and become one file", async (t) => {
	const { call, raw, login, objects, multipart } = await fixture(t);
	const sam = (await login()).data.token;
	const cred = (await call("GET", "system/anyTenant/ossToken", { token: sam, query: { fileName: "video.mp4" } })).data;
	const partSize = 32 * 1024 * 1024;
	const size = partSize + 5;
	const bytes = new Uint8Array(size);
	bytes[0] = 7;
	bytes[size - 1] = 9;

	assert.equal((await raw("POST", `${cred.downloadUrl}?token=wrong&uploads&size=${size}`)).status, 403);
	assert.equal((await raw("POST", `${cred.uploadUrl}&uploads&size=${600 * 1024 * 1024}`)).status, 413, "500 MB at most");
	assert.equal((await raw("PUT", cred.uploadUrl, { body: bytes.slice(0, 1), headers: { "Content-Length": String(101 * 1024 * 1024) } })).status, 413, "one PUT carries 100 MB at most");
	const started = await (await raw("POST", `${cred.uploadUrl}&uploads&size=${size}`)).json();
	assert.deepEqual({ partSize: started.partSize, parts: started.parts }, { partSize, parts: 2 });

	const put = (partNumber, body) =>
		raw("PUT", `${cred.uploadUrl}&uploadId=${started.uploadId}&partNumber=${partNumber}`, { body, headers: { "Content-Length": String(body.byteLength) } });
	assert.equal((await put(3, bytes.slice(0, 5))).status, 400, "only the parts of the declared size");
	assert.equal((await put(1, bytes.slice(0, partSize - 1))).status, 400, "every part but the last is exactly partSize");
	const first = await (await put(1, bytes.slice(0, partSize))).json();
	const second = await (await put(2, bytes.slice(partSize))).json();
	assert.equal((await raw("GET", cred.downloadUrl)).status, 404, "nothing is served before it completes");
	assert.equal((await call("POST", "im/chat/msg", { token: sam, body: { roomId: "1", msgType: 4, body: { url: cred.downloadUrl, fileName: "video.mp4" } } })).code, 400);

	const complete = (parts) => raw("POST", `${cred.uploadUrl}&uploadId=${started.uploadId}`, { body: JSON.stringify({ parts }), headers: { "Content-Type": "application/json" } });
	assert.equal((await complete([first])).status, 400, "every part must be listed");
	assert.equal((await complete([second, first])).status, 200);
	assert.equal((await complete([first, second])).status, 409, "the link is spent once the file is complete");
	assert.equal(multipart.size, 0);
	const served = await raw("GET", cred.downloadUrl, { headers: { Range: `bytes=${size - 2}-${size - 1}` } });
	assert.equal(served.headers.get("Content-Range"), `bytes ${size - 2}-${size - 1}/${size}`);
	assert.deepEqual(new Uint8Array(await served.arrayBuffer()), new Uint8Array([0, 9]));
	assert.equal(objects.size, 1);

	// An abandoned upload can be dropped and started again.
	const other = (await call("GET", "system/anyTenant/ossToken", { token: sam, query: { fileName: "b.bin" } })).data;
	const again = await (await raw("POST", `${other.uploadUrl}&uploads&size=${size}`)).json();
	assert.equal((await raw("DELETE", `${other.uploadUrl}&uploadId=${again.uploadId}`)).status, 204);
	assert.equal(multipart.size, 0);
	assert.equal((await raw("PUT", `${other.uploadUrl}&uploadId=${again.uploadId}&partNumber=2`, { body: bytes.slice(0, 5), headers: { "Content-Length": "5" } })).status, 404);
});

test("mail: one-time web sign-in link, inbox unread count", async (t) => {
	const { database, call, raw, login } = await fixture(t);
	const sam = (await login()).data.token;
	const link = (await call("GET", "im/mail/sso", { token: sam, query: { next: "/inbox" } })).data.url;
	assert.match(link, /^https:\/\/mail\.one\.test\/api\/im\/mail\/sso\/[a-f0-9]{48}\?next=%2Finbox$/);
	const signedIn = await raw("GET", link);
	assert.equal(signedIn.status, 302);
	assert.equal(signedIn.headers.get("Location"), "https://mail.one.test/inbox");
	const cookie = signedIn.headers.get("Set-Cookie");
	assert.match(cookie, /^ep_session=sess_[^;]+; Path=\/; HttpOnly; SameSite=Lax; Max-Age=2592000; Secure$/);
	const again = await raw("GET", link);
	assert.equal(again.headers.get("Location"), "https://mail.one.test/login", "the link works once");
	assert.equal(again.headers.get("Set-Cookie"), null);
	const desktop = (await call("GET", "im/mail/sso", { token: sam, query: { next: "/inbox?folder=sent&smj_desktop=1" } })).data.url;
	assert.equal((await raw("GET", desktop)).headers.get("Location"), "https://mail.one.test/inbox?folder=sent&smj_desktop=1");

	const offsite = (await call("GET", "im/mail/sso", { token: sam, query: { next: "//evil.test/x" } })).data.url;
	assert.ok(!offsite.includes("next="), "only same-origin paths survive");
	database.db.prepare("UPDATE sessions SET expires_at = 1 WHERE id LIKE 'imsso_%'").run();
	assert.equal((await raw("GET", offsite)).headers.get("Location"), "https://mail.one.test/login", "expired links sign nobody in");

	database.db.prepare("INSERT INTO domains (id, user_id, hostname, zone_id, created_at) VALUES ('d1', 'u1', 'one.test', 'z', 1)").run();
	database.db.prepare("INSERT INTO mailboxes (id, user_id, domain_id, local_part, created_at) VALUES ('m1', 'u1', 'd1', 'sam', 1)").run();
	const insert = database.db.prepare("INSERT INTO messages (id, user_id, mailbox_id, direction, from_addr, to_addr, status, read, created_at) VALUES (?, 'u1', 'm1', 'inbound', 'a@b.test', 'sam@one.test', ?, ?, 1)");
	insert.run("x1", "received", 0);
	insert.run("x2", "received", 0);
	insert.run("x3", "received", 1);
	insert.run("x4", "spam", 0);
	assert.deepEqual((await call("GET", "im/mail/unread", { token: sam })).data, { count: 2 });
});

test("mail cards: share a mail into chats, and only room members read it on the share page", async (t) => {
	const { database, env, call, raw, login, addUser, pushes, objects } = await fixture(t);
	addUser("u2", "ana@one.test", "Ana");
	addUser("u3", "bob@one.test", "Bob");
	database.db.prepare("INSERT INTO domains (id, user_id, hostname, zone_id, created_at) VALUES ('d1', 'u1', 'one.test', 'z', 1)").run();
	database.db.prepare("INSERT INTO mailboxes (id, user_id, domain_id, local_part, created_at) VALUES ('m1', 'u1', 'd1', 'sam', 1)").run();
	database.db.prepare(
		"INSERT INTO messages (id, user_id, mailbox_id, direction, from_addr, to_addr, subject, snippet, html_body, status, read, created_at) VALUES ('x1', 'u1', 'm1', 'inbound', '\"Lee\" <lee@b.test>', 'sam@one.test', 'Quarterly plan', 'Numbers attached', ?, 'received', 1, 1700000000)",
	).run('<p onclick="steal()">Hi<script>alert(1)</script><img src="cid:logo@b" onerror="x()"><a href="javascript:alert(1)">go</a></p><meta http-equiv="refresh" content="0;url=https://evil.test">');
	const attach = database.db.prepare("INSERT INTO message_attachments (id, message_id, filename, content_type, size, disposition, content_id, r2_key, created_at) VALUES (?, 'x1', ?, ?, ?, ?, ?, ?, 1)");
	attach.run("a1", "logo.png", "image/png", 3, "inline", "<logo@b>", "att/a1");
	attach.run("a2", "plan.xlsx", "application/vnd.ms-excel", 4, "attachment", null, "att/a2");
	objects.set("att/a2", { bytes: new Uint8Array([1, 2, 3, 4]) });

	const sam = (await login()).data.token;
	const privateRoom = (await call("GET", "im/chat/contact/detail/friend", { token: sam, query: { id: "u2", roomType: "2" } })).data.roomId;
	const samUser = database.db.prepare("SELECT * FROM users WHERE id = 'u1'").get();
	const targets = await listShareTargets(env, "u1", "https://mail.one.test");
	assert.deepEqual(new Set(targets.map((target) => target.roomId)), new Set(["1", privateRoom]));

	pushes.length = 0;
	assert.deepEqual(await shareMailToChats(env, samUser, "x1", ["1", privateRoom], "https://mail.one.test"), { shared: 2 });
	const cards = pushes.filter((push) => push.type === "receiveMessage" && push.data.message.type === 19);
	assert.deepEqual(new Set(cards.filter((push) => push.data.message.roomId === "1").map((push) => push.userId)), new Set(["u1", "u2", "u3"]), "the sharer's own client hears too");
	const card = cards.find((push) => push.userId === "u2" && push.data.message.roomId === privateRoom).data.message.body;
	assert.equal(card.subject, "Quarterly plan");
	assert.equal(card.from, "lee@b.test");
	assert.equal(card.fromName, "Lee");
	assert.equal(card.date, 1700000000000);
	assert.equal(card.snippet, "Numbers attached");
	assert.equal(card.attachmentCount, 1, "inline images are not counted");
	assert.match(card.url, /^https:\/\/mail\.one\.test\/api\/im\/mail\/share\/[a-f0-9]{32}$/);
	const ana = (await login("ana@one.test")).data.token;
	const anaSession = (await call("GET", "im/chat/contact/list", { token: ana })).data.find((session) => session.roomId === privateRoom);
	assert.equal(anaSession.text, "[邮件] Quarterly plan");

	await assert.rejects(() => shareMailToChats(env, database.db.prepare("SELECT * FROM users WHERE id = 'u2'").get(), "x1", ["1"], "https://mail.one.test"), { status: 404 }, "only people who can read the mail share it");
	await assert.rejects(() => shareMailToChats(env, samUser, "x1", [], "https://mail.one.test"), { status: 400 });

	const cookie = async (userId) => `ep_session=${encodeURIComponent(await createSession(env, userId))}`;
	assert.equal((await raw("GET", card.url)).headers.get("Location"), `https://mail.one.test/login?next=${encodeURIComponent(new URL(card.url).pathname)}`);
	const page = await raw("GET", card.url, { headers: { Cookie: await cookie("u2") } });
	assert.equal(page.status, 200, "Ana reads it without access to Sam's mailbox");
	assert.match(page.headers.get("Content-Security-Policy"), /sandbox/);
	const html = await page.text();
	assert.ok(html.includes("Quarterly plan") && html.includes("plan.xlsx"));
	assert.ok(!/<script|onclick|onerror|javascript:|http-equiv/i.test(html.replace(/<style>[\s\S]*?<\/style>/, "")), "scripts, handlers and refresh are removed");
	assert.ok(html.includes(`${card.url}/attachments/a1`), "inline images point at the share");
	const download = await raw("GET", `${card.url}/attachments/a2`, { headers: { Cookie: await cookie("u2") } });
	assert.equal(download.status, 200);
	assert.deepEqual([...new Uint8Array(await download.arrayBuffer())], [1, 2, 3, 4]);
	assert.match(download.headers.get("Content-Disposition"), /^attachment;/);
	assert.equal((await raw("GET", card.url, { headers: { Cookie: await cookie("u3") } })).status, 403, "Bob is not in the private chat");

	// Remote images stay unloaded until the reader asks, and then come through our proxy.
	assert.match(page.headers.get("Content-Security-Policy"), /img-src 'self' data:;/);
	assert.ok(!/https?:\/\/|style-src[^;]*https/.test(page.headers.get("Content-Security-Policy")), "the page itself allows no remote origin");
	assert.ok(!html.includes("显示图片"), "no prompt when there is nothing remote");
	database.db.prepare(
		"INSERT INTO messages (id, user_id, mailbox_id, direction, from_addr, to_addr, subject, html_body, status, read, created_at) VALUES ('x2', 'u1', 'm1', 'inbound', 'lee@b.test', 'sam@one.test', 'Newsletter', ?, 'received', 1, 1700000000)",
	).run(`<img src="https://img.example.test/pixel.gif?u=1&amp;v=2"><img src=//img.example.test/a.png srcset="https://img.example.test/a2.png 2x, cid:logo@b 1x"><td background='http://img.example.test/bg.png' style="background:url(&quot;https://img.example.test/c.png&quot;)"></td><style>.x{background-image:url(https://img.example.test/d.png)}</style><img src="cid:logo@b">`);
	database.db.prepare("INSERT INTO message_attachments (id, message_id, filename, content_type, size, disposition, content_id, r2_key, created_at) VALUES ('a3', 'x2', 'logo.png', 'image/png', 3, 'inline', '<logo@b>', 'att/a3', 1)").run();
	await shareMailToChats(env, samUser, "x2", [privateRoom], "https://mail.one.test");
	const newsletter = pushes.filter((push) => push.data?.message?.body?.subject === "Newsletter").at(-1).data.message.body;
	const blocked = await (await raw("GET", newsletter.url, { headers: { Cookie: await cookie("u2") } })).text();
	assert.ok(!blocked.includes("img.example.test"), "no remote image address reaches the page");
	assert.ok(blocked.includes(`href="${newsletter.url}?images=1"`) && blocked.includes("显示图片"), "the reader is offered to load them");
	assert.ok(blocked.includes(`src="${newsletter.url}/attachments/a3"`) && blocked.includes(`${newsletter.url}/attachments/a3 1x`), "inline images still show");
	const shown = await (await raw("GET", `${newsletter.url}?images=1`, { headers: { Cookie: await cookie("u2") } })).text();
	const proxied = (url) => `https://mail.one.test/api/remote-images?url=${encodeURIComponent(url)}`;
	for (const url of ["https://img.example.test/pixel.gif?u=1&v=2", "https://img.example.test/a.png", "https://img.example.test/a2.png", "http://img.example.test/bg.png", "https://img.example.test/c.png", "https://img.example.test/d.png"]) {
		assert.ok(shown.includes(proxied(url)), `${url} goes through the proxy`);
	}
	assert.ok(!/["'(]\s*(?:https?:)?\/\/img\.example\.test/.test(shown), "never directly");
	assert.ok(!shown.includes("显示图片"));

	database.db.prepare("DELETE FROM messages WHERE id = 'x1'").run();
	assert.equal((await raw("GET", card.url, { headers: { Cookie: await cookie("u2") } })).status, 404);
});

test("group mailbox: managers give a group an address, and its mail arrives as cards", async (t) => {
	const { database, env, call, raw, login, addUser, pushes } = await fixture(t);
	addUser("u2", "ana@one.test", "Ana");
	addUser("u3", "bob@one.test", "Bob");
	addUser("u4", "kim@one.test", "Kim");
	database.db.prepare("INSERT INTO domains (id, user_id, hostname, zone_id, created_at) VALUES ('d1', 'u1', 'one.test', 'manual', 1)").run();
	database.db.prepare("INSERT INTO mailboxes (id, user_id, domain_id, local_part, created_at) VALUES ('m1', 'u1', 'd1', 'sam', 1)").run();
	const sam = (await login()).data.token;
	const ana = (await login("ana@one.test")).data.token;
	const roomId = (await call("POST", "im/room/group", { token: sam, body: { uidList: ["u2", "u3"] } })).data.roomId;

	const initial = (await call("GET", "im/room/mailbox", { token: ana, query: { roomId } })).data;
	assert.deepEqual(initial, { address: null, enabled: false, canManage: false, suggestedLocalPart: `group-${roomId}`, domain: null });
	assert.equal((await call("POST", "im/room/mailbox", { token: ana, body: { roomId, localPart: "team" } })).code, 403, "members cannot turn it on");
	assert.equal((await call("GET", "im/room/mailbox", { token: (await login("kim@one.test")).data.token, query: { roomId } })).code, 403, "outsiders cannot look");
	assert.equal((await call("POST", "im/room/mailbox", { token: sam, body: { roomId, localPart: "-bad" } })).code, 400);
	assert.equal((await call("POST", "im/room/mailbox", { token: sam, body: { roomId, localPart: "sam" } })).code, 400, "an address in use is refused");

	const enabled = await call("POST", "im/room/mailbox", { token: sam, body: { roomId, localPart: "Team.Sales" } });
	assert.equal(enabled.code, 200);
	assert.deepEqual(enabled.data, { address: "team.sales@one.test", enabled: true, canManage: true, suggestedLocalPart: "team.sales", domain: "one.test" });
	const mailbox = database.db.prepare("SELECT * FROM mailboxes WHERE local_part = 'team.sales'").get();
	assert.equal(mailbox.type, "shared");
	assert.equal(mailbox.user_id, "u1");

	database.db.prepare(
		"INSERT INTO messages (id, user_id, mailbox_id, direction, from_addr, to_addr, subject, snippet, text_body, status, read, created_at) VALUES ('x1', 'u1', ?, 'inbound', 'lee@b.test', 'team.sales@one.test', 'Order 42', 'Please ship', 'Please ship', 'received', 0, 1700000000)",
	).run(mailbox.id);
	assert.equal(await countUnreadMail(env, "u1"), 0, "group mail is not in the owner's unread count");
	pushes.length = 0;
	assert.equal(await postRoomMailCard(env, "m1", "x1"), false, "ordinary mailboxes are left alone");
	assert.equal(await postRoomMailCard(env, mailbox.id, "x1"), true);
	const cards = pushes.filter((push) => push.type === "receiveMessage" && push.data.message.type === 19);
	assert.deepEqual(new Set(cards.map((push) => push.userId)), new Set(["u1", "u2", "u3"]));
	const card = cards[0].data.message.body;
	assert.equal(card.via, "mailbox");
	assert.equal(card.mailbox, "team.sales@one.test");
	assert.equal(card.subject, "Order 42");
	const cookie = `ep_session=${encodeURIComponent(await createSession(env, "u2"))}`;
	const page = await (await raw("GET", card.url, { headers: { Cookie: cookie } })).text();
	assert.ok(page.includes("群邮箱收到的邮件"));

	const disabled = await call("POST", "im/room/mailbox/disable", { token: sam, body: { roomId } });
	assert.equal(disabled.data.enabled, false);
	assert.equal(database.db.prepare("SELECT disabled FROM mailboxes WHERE id = ?").get(mailbox.id).disabled, 1);
	const again = await call("POST", "im/room/mailbox", { token: sam, body: { roomId, localPart: "other" } });
	assert.equal(again.data.address, "team.sales@one.test", "turning it back on keeps the address");
	assert.equal(again.data.enabled, true);
});

test("search: chat in the user's rooms and mail in their mailboxes, Chinese words found anywhere in a sentence", async (t) => {
	const { database, call, login, addUser } = await fixture(t);
	addUser("u2", "kim@one.test", "Kim");
	addUser("u3", "lee@one.test", "Lee");
	const sam = (await login()).data.token;
	const lee = (await login("lee@one.test")).data.token;
	const samKim = (await call("GET", "im/chat/contact/detail/friend", { token: sam, query: { id: "u2", roomType: "2" } })).data.roomId;
	const leeKim = (await call("GET", "im/chat/contact/detail/friend", { token: lee, query: { id: "u2", roomType: "2" } })).data.roomId;
	const send = async (token, roomId, content) => (await call("POST", "im/chat/msg", { token, body: { roomId, msgType: 1, body: { content } } })).data.message.id;
	const meeting = await send(sam, samKim, "明天下午三点<b>开会</b>讨论预算");
	const budget = await send(sam, samKim, "预算表已经更新");
	await send(lee, leeKim, "Lee 和 Kim 也要开会");
	const search = async (token, query) => (await call("GET", "im/search", { token, query })).data;

	const two = await search(sam, { keyword: "开会", scope: "chat" });
	assert.equal(two.mail, null, "scope=chat leaves mail out");
	assert.deepEqual(two.chat.list.map((hit) => hit.msgId), [meeting], "a two-character word inside a sentence; Lee's room stays hidden");
	assert.deepEqual(
		{ ...two.chat.list[0], sendTime: 0 },
		{ msgId: meeting, roomId: samKim, roomType: 2, detailId: "u2", roomName: "Kim", roomAvatar: "007", fromUid: "u1", fromName: "Sam", fromAvatar: "006", type: 1, text: "明天下午三点开会讨论预算", sendTime: 0 },
	);
	assert.deepEqual((await search(lee, { keyword: "开会", scope: "chat" })).chat.list.map((hit) => hit.roomId), [leeKim]);
	assert.deepEqual((await search(sam, { keyword: "开会讨论", scope: "chat" })).chat.list.map((hit) => hit.msgId), [meeting], "longer terms go through the trigram index");
	assert.deepEqual((await search(sam, { keyword: "预算", scope: "chat" })).chat.list.map((hit) => hit.msgId), [budget, meeting], "newest first");
	assert.deepEqual((await search(sam, { keyword: "预算 -下午", scope: "chat" })).chat.list.map((hit) => hit.msgId), [budget]);
	assert.deepEqual((await search(sam, { keyword: "预算", scope: "chat", size: "1" })).chat, { ...(await search(sam, { keyword: "预算", scope: "chat", size: "1" })).chat, total: 2, isLast: false });
	assert.equal((await search(sam, { keyword: "开会", scope: "chat", roomId: leeKim })).chat.total, 0, "naming someone else's room finds nothing");
	assert.equal((await search(sam, { keyword: "b", scope: "chat" })).chat.total, 0, "markup is not searchable text");

	assert.equal((await call("PUT", "im/chat/msg/recall", { token: sam, body: { roomId: samKim, msgId: meeting } })).code, 200);
	assert.deepEqual((await search(sam, { keyword: "预算", scope: "chat" })).chat.list.map((hit) => hit.msgId), [budget], "recalled messages leave the index");

	database.db.prepare("INSERT INTO domains (id, user_id, hostname, zone_id, created_at) VALUES ('d1', 'u1', 'one.test', 'z', 1)").run();
	const mailbox = database.db.prepare("INSERT INTO mailboxes (id, user_id, domain_id, local_part, created_at) VALUES (?, ?, 'd1', ?, 1)");
	mailbox.run("m1", "u1", "sam");
	mailbox.run("m2", "u2", "kim");
	mailbox.run("m3", "u3", "lee");
	database.db.prepare("INSERT INTO mailbox_access (id, mailbox_id, user_id, created_at) VALUES ('a1', 'm3', 'u1', 1)").run();
	const mail = database.db.prepare(
		"INSERT INTO messages (id, user_id, mailbox_id, direction, from_addr, to_addr, subject, text_body, status, read, created_at) VALUES (?, 'u1', ?, ?, ?, 'sam@one.test', ?, ?, ?, 0, ?)",
	);
	mail.run("x1", "m1", "inbound", '"张三" <zhang@b.test>', "关于合同审批的通知", "请在周五前完成合同审批。Invoice attached.", "received", 3);
	mail.run("x2", "m2", "inbound", "a@b.test", "合同草稿", "Kim 的邮件", "received", 2);
	mail.run("x3", "m3", "inbound", "a@b.test", "Re: 合同", "共享邮箱里的合同", "received", 1);
	mail.run("x4", "m1", "inbound", "a@b.test", "垃圾合同", "spam", "spam", 4);
	mail.run("x5", "m1", "outbound", "sam@one.test", "invoices for March", "see attached", "sent", 5);

	const both = await search(sam, { keyword: "合同" });
	assert.deepEqual(both.chat, { list: [], total: 0, isLast: true });
	assert.deepEqual(both.mail.list.map((hit) => hit.id), ["x1", "x3"], "own and shared mailboxes; Kim's mailbox and spam stay out");
	assert.deepEqual(
		{ ...both.mail.list[0], date: 0 },
		{
			id: "x1", mailboxId: "m1", mailboxAddress: "sam@one.test", threadId: null, status: "received", outbound: false,
			subject: "关于合同审批的通知", from: "zhang@b.test", fromName: "张三", to: "", text: "请在周五前完成合同审批。Invoice attached.",
			read: false, date: 0, path: "/inbox/x1",
		},
	);
	assert.deepEqual((await search(sam, { keyword: "合同", mailboxId: "m3" })).mail.list.map((hit) => hit.id), ["x3"]);
	assert.equal((await search(sam, { keyword: "合同", mailboxId: "m2" })).mail.total, 0, "naming a mailbox one cannot read finds nothing");
	assert.deepEqual((await search(sam, { keyword: "invoice", scope: "mail" })).mail.list.map((hit) => hit.id), ["x5", "x1"], "latin words keep prefix matching");
	assert.deepEqual((await search(sam, { keyword: "合同 -审批", scope: "mail" })).mail.list.map((hit) => hit.id), ["x3"]);
	assert.deepEqual((await search(sam, { keyword: "from:zhang 合同", scope: "mail" })).mail.list.map((hit) => hit.id), ["x1"], "operators still apply");
	assert.equal((await search(lee, { keyword: "合同", scope: "mail" })).mail.total, 1, "Lee sees only his own mailbox");

	assert.equal((await call("GET", "im/search", { token: sam, query: { keyword: "  " } })).code, 400);
	assert.equal((await call("GET", "im/search", { query: { keyword: "合同" } })).code, 401);
});

test("history: the web client's history and file windows, filtered by kind, words, sender and time", async (t) => {
	const { database, call, login, addUser } = await fixture(t);
	addUser("u2", "kim@one.test", "Kim");
	addUser("u3", "lee@one.test", "Lee");
	const sam = (await login()).data.token;
	const kim = (await login("kim@one.test")).data.token;
	const lee = (await login("lee@one.test")).data.token;
	const samKim = (await call("GET", "im/chat/contact/detail/friend", { token: sam, query: { id: "u2", roomType: "2" } })).data.roomId;
	const leeKim = (await call("GET", "im/chat/contact/detail/friend", { token: lee, query: { id: "u2", roomType: "2" } })).data.roomId;
	const send = async (token, roomId, content) => (await call("POST", "im/chat/msg", { token, body: { roomId, msgType: 1, body: { content } } })).data.message.id;
	const first = await send(sam, samKim, "明天开会");
	const second = await send(kim, samKim, "好的，预算表带上");
	const third = await send(sam, samKim, "预算表已经更新");
	await send(lee, leeKim, "Lee 的预算");
	database.db.prepare("INSERT INTO im_messages (room_id, from_uid, type, body, created_at) VALUES (?, 'u2', 4, ?, ?)")
		.run(samKim, JSON.stringify({ fileName: "季度预算.xlsx", size: 10, url: "https://mail.one.test/api/im/files/x/a.xlsx" }), Date.now());
	const file = String(database.db.prepare("SELECT max(id) AS id FROM im_messages").get().id);
	const history = async (token, query) => (await call("GET", "im/chat/msg/history", { token, query })).data;
	const ids = (page) => page.list.map((item) => item.message.id);

	const all = await history(sam, { roomId: samKim });
	assert.deepEqual(ids(all), [file, third, second, first], "newest first");
	assert.equal(all.isLast, true);
	assert.equal(all.list[1].fromUser.uid, "u1", "HuLa's message shape");
	assert.deepEqual(ids(await history(sam, { roomId: samKim, kind: "file" })), [file]);
	assert.deepEqual(ids(await history(sam, { roomId: samKim, kind: "image" })), []);
	assert.deepEqual(ids(await history(sam, { roomId: samKim, keyword: "预算" })), [file, third, second], "file names are searchable too");
	assert.deepEqual(ids(await history(sam, { roomId: samKim, keyword: "预算 -更新" })), [file, second]);
	assert.deepEqual(ids(await history(sam, { roomId: samKim, keyword: "-预算" })), [], "only excluded words find nothing");
	assert.deepEqual(ids(await history(sam, { roomId: samKim, fromUid: "u2" })), [file, second]);
	const firstAt = database.db.prepare("SELECT created_at FROM im_messages WHERE id = ?").get(Number(first)).created_at;
	assert.deepEqual(ids(await history(sam, { roomId: samKim, endTime: String(firstAt) })), [first]);
	const page = await history(sam, { roomId: samKim, pageSize: "2" });
	assert.deepEqual([ids(page), page.isLast], [[file, third], false]);
	const next = await history(sam, { roomId: samKim, pageSize: "2", cursor: page.cursor });
	assert.deepEqual([ids(next), next.isLast], [[second, first], true]);

	assert.deepEqual(ids(await history(sam, { kind: "files" })), [file], "without a room: every room the user is in");
	assert.deepEqual((await history(kim, { keyword: "预算" })).list.map((item) => item.message.roomId).sort(), [samKim, samKim, samKim, leeKim].sort());
	assert.equal((await call("GET", "im/chat/msg/history", { token: sam, query: { roomId: leeKim } })).code, 403, "someone else's room");

	assert.equal((await call("PUT", "im/chat/msg/recall", { token: sam, body: { roomId: samKim, msgId: third } })).code, 200);
	assert.deepEqual(ids(await history(sam, { roomId: samKim })), [file, second, first], "recalled messages are left out");
});

test("group files: filed from the chat, readable only by current members, and linked with Drive", async (t) => {
	const { database, env, call, raw, login, addUser, pushes, objects } = await fixture(t);
	addUser("u2", "kim@one.test", "Kim");
	addUser("u3", "lee@one.test", "Lee");
	addUser("u4", "max@one.test", "Max");
	const sam = (await login()).data.token;
	const kim = (await login("kim@one.test")).data.token;
	const lee = (await login("lee@one.test")).data.token;
	const max = (await login("max@one.test")).data.token;
	const roomId = (await call("POST", "im/room/group", { token: sam, body: { uidList: ["u2", "u3"] } })).data.roomId;
	const upload = async (token, fileName, bytes) => {
		const cred = (await call("GET", "system/anyTenant/ossToken", { token, query: { fileName } })).data;
		await raw("PUT", cred.uploadUrl, { body: bytes, headers: { "Content-Length": String(bytes.byteLength) } });
		return cred.downloadUrl;
	};
	const pdf = new Uint8Array([37, 80, 68, 70, 1, 2, 3]);
	const reportUrl = await upload(sam, "upload.pdf", pdf);
	assert.equal((await call("POST", "im/chat/msg", { token: sam, body: { roomId, msgType: 4, body: { url: reportUrl, size: 7, fileName: "季度报告.pdf" } } })).code, 200);
	const photoUrl = await upload(kim, "photo.png", new Uint8Array([137, 80, 78, 71]));
	assert.equal((await call("POST", "im/chat/msg", { token: kim, body: { roomId, msgType: 3, body: { url: photoUrl, size: 4, width: 2, height: 2 } } })).code, 200);
	const voiceUrl = await upload(kim, "voice.mp3", new Uint8Array([1, 2]));
	await call("POST", "im/chat/msg", { token: kim, body: { roomId, msgType: 5, body: { url: voiceUrl, size: 2, second: 1 } } });
	const single = (await call("GET", "im/chat/contact/detail/friend", { token: sam, query: { id: "u2", roomType: "2" } })).data.roomId;
	await call("POST", "im/chat/msg", { token: sam, body: { roomId: single, msgType: 4, body: { url: reportUrl, size: 7, fileName: "private.pdf" } } });

	const kimView = await call("GET", "im/room/files", { token: kim, query: { roomId } });
	assert.equal(kimView.code, 200);
	assert.deepEqual(kimView.data.list.map((file) => [file.fileName, file.msgType, file.uploaderName, file.canRemove]), [["photo.png", 3, "Kim", true], ["季度报告.pdf", 4, "Sam", false]], "voice notes and private chats are not filed");
	assert.equal(kimView.data.total, 2);
	assert.equal(kimView.data.totalSize, 11);
	assert.equal(kimView.data.list[1].url, reportUrl);
	assert.equal((await call("GET", "im/room/files", { token: kim, query: { roomId, keyword: "报告" } })).data.list.length, 1);
	assert.equal((await call("GET", "im/room/files", { token: kim, query: { roomId, pageSize: "1" } })).data.isLast, false);
	assert.equal((await call("GET", "im/room/files", { token: sam, query: { roomId: single } })).code, 400, "only groups have a file list");

	// Outsiders get 403 everywhere and cannot post a Drive file into the group.
	assert.equal((await call("GET", "im/room/files", { token: max, query: { roomId } })).code, 403);
	assert.equal((await call("POST", "im/room/files/saveToDrive", { token: max, body: { roomId, id: kimView.data.list[1].id } })).code, 403);
	assert.equal((await call("POST", "im/room/files/remove", { token: max, body: { roomId, id: kimView.data.list[1].id } })).code, 403);
	assert.equal((await call("POST", "im/room/files/fromDrive", { token: max, body: { roomId, driveItemId: "drv_x" } })).code, 403);
	assert.equal((await listDriveGroupFolders(env, "u4")).some((folder) => folder.group.roomId === roomId), false);
	await assert.rejects(listDriveGroupFiles(env, "u4", roomId), { status: 403 });

	// The Drive view lists the group as a folder and serves its files to members only.
	const folders = await listDriveGroupFolders(env, "u2");
	assert.deepEqual(folders.filter((folder) => folder.group.roomId === roomId).map((folder) => [folder.kind, folder.group.fileCount]), [["folder", 2]]);
	const driveFiles = (await listDriveGroupFiles(env, "u2", roomId)).items;
	const reportItem = driveFiles.find((item) => item.name === "季度报告.pdf");
	const served = await serveRoomFileForDrive(env, new Request("https://mail.one.test/x"), "u2", roomId, reportItem.group.fileId);
	assert.equal(served.status, 200);
	assert.equal(served.headers.get("Content-Type"), "application/pdf");
	assert.deepEqual(new Uint8Array(await served.arrayBuffer()), pdf);
	assert.equal((await serveRoomFileForDrive(env, new Request("https://mail.one.test/x"), "u4", roomId, reportItem.group.fileId)).status, 404);

	// Leaving the group takes the folder away at once; joining shows the whole history.
	assert.equal((await call("DELETE", "im/room/group/member/exit", { token: kim, body: { roomId } })).code, 200);
	assert.equal((await call("GET", "im/room/files", { token: kim, query: { roomId } })).code, 403, "a former member cannot list the files");
	assert.equal((await listDriveGroupFolders(env, "u2")).some((folder) => folder.group.roomId === roomId), false);
	assert.equal((await serveRoomFileForDrive(env, new Request("https://mail.one.test/x"), "u2", roomId, reportItem.group.fileId)).status, 404);
	assert.equal((await call("POST", "im/room/group/member", { token: sam, body: { roomId, uidList: ["u4"] } })).code, 200);
	assert.equal((await call("GET", "im/room/files", { token: max, query: { roomId } })).data.total, 2, "a new member sees what was sent before");

	// Lee picks a file from their own Drive and sends it into the group.
	database.db.prepare("INSERT INTO drive_items (id, owner_id, parent_id, kind, name, size, content_type, created_at, updated_at) VALUES ('drv_dir', 'u3', NULL, 'folder', '项目', 0, 'application/x-directory', 1, 1)").run();
	database.db.prepare("INSERT INTO drive_items (id, owner_id, parent_id, kind, name, r2_key, size, content_type, created_at, updated_at) VALUES ('drv_plan', 'u3', 'drv_dir', 'file', '计划.txt', 'drive/u3/drv_plan', 5, 'text/plain', 1, 1)").run();
	objects.set("drive/u3/drv_plan", { bytes: new Uint8Array([104, 101, 108, 108, 111]), contentType: "text/plain" });
	const top = (await call("GET", "im/drive/items", { token: lee })).data;
	assert.deepEqual(top.items.map((item) => [item.name, item.kind]), [["项目", "folder"]]);
	const inside = (await call("GET", "im/drive/items", { token: lee, query: { parentId: "drv_dir" } })).data;
	assert.deepEqual(inside.items.map((item) => [item.name, item.sendable]), [["计划.txt", true]]);
	assert.deepEqual(inside.path, [{ id: "drv_dir", name: "项目" }]);
	assert.equal((await call("GET", "im/drive/items", { token: max, query: { parentId: "drv_dir" } })).code, 404, "nobody else's folders");
	assert.equal((await call("POST", "im/room/files/fromDrive", { token: max, body: { roomId, driveItemId: "drv_plan" } })).code, 404, "members can only send Drive files they can open");
	pushes.length = 0;
	const sent = await call("POST", "im/room/files/fromDrive", { token: lee, body: { roomId, driveItemId: "drv_plan" } });
	assert.equal(sent.code, 200);
	assert.equal(sent.data.message.type, 4);
	assert.equal(sent.data.message.body.fileName, "计划.txt");
	assert.deepEqual(new Set(pushes.map((push) => push.userId)), new Set(["u1", "u3", "u4"]), "the sender's own client gets it too");
	assert.deepEqual(new Uint8Array(await (await raw("GET", sent.data.message.body.url)).arrayBuffer()), new Uint8Array([104, 101, 108, 108, 111]), "the bytes were copied into a chat file");
	const afterSend = (await call("GET", "im/room/files", { token: max, query: { roomId } })).data;
	assert.equal(afterSend.list[0].fileName, "计划.txt");

	// Saving a group file copies it into the top of the member's own Drive.
	const saved = await call("POST", "im/room/files/saveToDrive", { token: max, body: { roomId, id: afterSend.list.at(-1).id } });
	assert.equal(saved.code, 200);
	const row = database.db.prepare("SELECT owner_id, parent_id, name, size, r2_key FROM drive_items WHERE id = ?").get(saved.data.id);
	assert.deepEqual({ ...row, r2_key: undefined }, { owner_id: "u4", parent_id: null, name: "季度报告.pdf", size: 7, r2_key: undefined });
	assert.deepEqual(objects.get(row.r2_key).bytes, pdf);

	// Removing: the sender or a manager; recalling the message removes its file too.
	const reportId = afterSend.list.find((file) => file.fileName === "季度报告.pdf").id;
	assert.equal((await call("POST", "im/room/files/remove", { token: max, body: { roomId, id: reportId } })).code, 403);
	assert.equal((await call("POST", "im/room/files/remove", { token: sam, body: { roomId, id: reportId } })).code, 200);
	assert.equal((await call("PUT", "im/chat/msg/recall", { token: lee, body: { roomId, msgId: sent.data.message.id } })).code, 200);
	assert.deepEqual((await call("GET", "im/room/files", { token: max, query: { roomId } })).data.list.map((file) => file.fileName), ["photo.png"]);
});

test("group files: migration 0073 files what groups already sent", async (t) => {
	const { database, call, raw, login, addUser } = await fixture(t);
	addUser("u2", "kim@one.test", "Kim");
	addUser("u3", "lee@one.test", "Lee");
	const sam = (await login()).data.token;
	const roomId = (await call("POST", "im/room/group", { token: sam, body: { uidList: ["u2", "u3"] } })).data.roomId;
	const cred = (await call("GET", "system/anyTenant/ossToken", { token: sam, query: { fileName: "clip.mp4" } })).data;
	await raw("PUT", cred.uploadUrl, { body: new Uint8Array([1, 2, 3]), headers: { "Content-Length": "3" } });
	await call("POST", "im/chat/msg", { token: sam, body: { roomId, msgType: 6, body: { url: cred.downloadUrl, size: 3, filename: "会议录像.mp4" } } });
	const recalled = await call("POST", "im/chat/msg", { token: sam, body: { roomId, msgType: 4, body: { url: cred.downloadUrl, size: 3, fileName: "old.mp4" } } });
	await call("PUT", "im/chat/msg/recall", { token: sam, body: { roomId, msgId: recalled.data.message.id } });
	database.db.prepare("DELETE FROM im_room_files").run();
	const backfill = readFileSync(join(root, "drizzle/migrations/0073_add_im_room_files.sql"), "utf8").split("--> statement-breakpoint").at(-1);
	database.db.exec(backfill);
	const rows = database.db.prepare("SELECT room_id, file_name, msg_type, size, uploader_id FROM im_room_files").all();
	assert.deepEqual(rows.map((row) => ({ ...row })), [{ room_id: roomId, file_name: "会议录像.mp4", msg_type: 6, size: 3, uploader_id: "u1" }]);
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

test("deleting a sent file: sender or group managers, the object goes unless a forwarded copy still uses it", async (t) => {
	const { call, raw, login, addUser, pushes, objects, database } = await fixture(t);
	addUser("u2", "kim@one.test", "Kim");
	addUser("u3", "lee@one.test", "Lee");
	const sam = (await login()).data.token;
	const kim = (await login("kim@one.test")).data.token;
	const lee = (await login("lee@one.test")).data.token;
	const roomId = (await call("POST", "im/room/group", { token: sam, body: { uidList: ["u2", "u3"] } })).data.roomId;
	const upload = async (token, fileName) => {
		const cred = (await call("GET", "system/anyTenant/ossToken", { token, query: { fileName } })).data;
		assert.equal((await raw("PUT", cred.uploadUrl, { body: new Uint8Array([1, 2, 3]), headers: { "Content-Length": "3" } })).status, 200);
		return cred.downloadUrl;
	};
	const report = await upload(kim, "report.pdf");
	const sent = await call("POST", "im/chat/msg", { token: kim, body: { id: "f-1", roomId, msgType: 4, body: { url: report, size: 3, fileName: "季度报告.pdf" } } });
	assert.equal(sent.code, 200);
	const listed = (await call("GET", "im/room/files", { token: sam, query: { roomId } })).data;
	assert.equal(listed.total, 1, "the send filed it in the group's files");
	const photo = await upload(kim, "photo.png");
	const image = await call("POST", "im/chat/msg", { token: kim, body: { id: "f-2", roomId, msgType: 3, body: { url: photo, size: 3 } } });
	const forwarded = await call("POST", "im/chat/msg", { token: lee, body: { id: "f-3", roomId, msgType: 3, body: { url: photo, size: 3 } } });
	assert.equal(forwarded.code, 200);
	assert.equal(objects.size, 2);

	const remove = (token, msgId) => call("POST", "im/chat/msg/file/delete", { token, body: { roomId, msgId } });
	assert.equal((await remove(lee, sent.data.message.id)).code, 403, "a plain member cannot delete someone else's file");
	assert.equal((await call("POST", "im/chat/msg/file/delete", { token: lee, body: { roomId: "1", msgId: sent.data.message.id } })).code, 404);
	pushes.length = 0;
	const deleted = await remove(sam, sent.data.message.id);
	assert.equal(deleted.code, 200, "the group owner can");
	assert.deepEqual({ type: deleted.data.message.type, body: deleted.data.message.body }, { type: 8, body: "Sam删除了文件「季度报告.pdf」" });
	assert.deepEqual(pushes.map((push) => [push.userId, push.type, push.data.msgId]).sort(), [
		["u1", "msgFileDeleted", sent.data.message.id],
		["u2", "msgFileDeleted", sent.data.message.id],
		["u3", "msgFileDeleted", sent.data.message.id],
	]);
	assert.equal((await raw("GET", report)).status, 404);
	assert.equal(objects.size, 1);
	const left = (await call("GET", "im/room/files", { token: sam, query: { roomId } })).data.list;
	assert.equal(left.length, 2, "only the two pictures are left in the group's files");
	assert.equal(left.some((file) => file.fileName === "季度报告.pdf"), false);
	assert.equal((await remove(sam, sent.data.message.id)).code, 400, "nothing left to delete");
	const page = (await call("GET", "im/chat/msg/page", { token: kim, query: { roomId } })).data.list;
	assert.equal(page.find((message) => message.message.id === sent.data.message.id).message.body, "Sam删除了文件「季度报告.pdf」");

	assert.equal((await remove(kim, image.data.message.id)).code, 200, "senders delete their own");
	assert.equal((await raw("GET", photo)).status, 200, "Lee's copy still points at the picture");
	assert.equal((await remove(lee, forwarded.data.message.id)).code, 200);
	assert.equal((await raw("GET", photo)).status, 404, "the last message using it takes it along");
	assert.equal(objects.size, 0);
	assert.equal(database.db.prepare("SELECT COUNT(*) AS n FROM im_files").get().n, 0);
});

test("unsent uploads: only the uploader's, only old ones, and only files no message uses", async (t) => {
	const { call, raw, login, addUser, objects, database } = await fixture(t);
	addUser("u2", "kim@one.test", "Kim");
	const sam = (await login()).data.token;
	const kim = (await login("kim@one.test")).data.token;
	const room = (await call("GET", "im/chat/contact/detail/friend", { token: sam, query: { id: "u2", roomType: "2" } })).data.roomId;
	const upload = async (token, fileName) => {
		const cred = (await call("GET", "system/anyTenant/ossToken", { token, query: { fileName } })).data;
		assert.equal((await raw("PUT", cred.uploadUrl, { body: new Uint8Array([1, 2, 3]), headers: { "Content-Length": "3" } })).status, 200);
		return cred.downloadUrl;
	};
	const left = await upload(sam, "selftest-limit-104857600.bin");
	const sentUrl = await upload(sam, "sent.png");
	await call("POST", "im/chat/msg", { token: sam, body: { roomId: room, msgType: 3, body: { url: sentUrl, size: 3 } } });
	await upload(kim, "kim.bin");
	const started = (await call("GET", "system/anyTenant/ossToken", { token: sam, query: { fileName: "never.bin" } })).data;

	assert.deepEqual((await call("GET", "im/chat/files/unsent", { token: sam })).data, [], "nothing recent counts");
	database.db.prepare("UPDATE im_files SET created_at = 1").run();
	const unsent = (await call("GET", "im/chat/files/unsent", { token: sam })).data;
	assert.deepEqual(unsent.map((file) => [file.fileName, file.uploaded]).sort(), [["never.bin", false], ["selftest-limit-104857600.bin", true]]);

	const kimFile = (await call("GET", "im/chat/files/unsent", { token: kim })).data[0];
	const result = await call("POST", "im/chat/files/unsent/delete", { token: sam, body: { ids: [...unsent.map((file) => file.id), kimFile.id] } });
	assert.equal(result.data.deleted.length, 2, "Kim's file is not Sam's to delete");
	assert.equal((await raw("GET", left)).status, 404);
	assert.equal((await raw("GET", sentUrl)).status, 200);
	assert.equal(objects.size, 2);
	assert.equal((await raw("PUT", started.uploadUrl, { body: new Uint8Array([1]), headers: { "Content-Length": "1" } })).status, 404, "its upload link is gone too");
});
