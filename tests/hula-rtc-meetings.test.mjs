import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import test, { after } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const directory = mkdtempSync(join(root, "node_modules", "mailflare-rtc-test-"));
after(() => rmSync(directory, { recursive: true, force: true }));
await build({
	stdin: {
		contents: `
			export { SqliteDatabase } from "./server/runtime/sqlite-database.ts";
			export { applyMigrations } from "./server/runtime/migrate.ts";
			export { hashPassword } from "./src/lib/auth/password.ts";
			export { handleImRequest } from "./src/lib/im/handler.ts";
			export { resolveRtcRelay } from "./src/lib/im/rtc.ts";
			export { buildRtcRelay, parseRtcSocketRequest, withoutBlockedTurnPorts } from "./src/lib/im/rtc-utils.ts";
			export { buildMeetingIcs, foldIcsLine } from "./src/lib/meetings/ics-utils.ts";
			export { parseMeetingCreateInput, newMeetingId, MEETING_ID_PATTERN } from "./src/lib/meetings/meeting-utils.ts";
			export { handleMeetingRequest } from "./src/lib/meetings/http.ts";
		`,
		resolveDir: root,
		sourcefile: "hula-rtc-test-entry.ts",
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
	SqliteDatabase, applyMigrations, hashPassword, handleImRequest, resolveRtcRelay, buildRtcRelay, parseRtcSocketRequest,
	withoutBlockedTurnPorts, buildMeetingIcs, foldIcsLine, parseMeetingCreateInput, newMeetingId, MEETING_ID_PATTERN, handleMeetingRequest,
} = await import(pathToFileURL(join(directory, "entry.mjs")).href);

async function fixture(t, extraEnv = {}) {
	const database = new SqliteDatabase(":memory:");
	t.after(() => database.db.close());
	await applyMigrations(database, join(root, "drizzle/migrations"));
	const addUser = (id, email, name) =>
		database.db.prepare("INSERT INTO users (id, email, password_hash, name, role, created_at) VALUES (?, ?, ?, ?, ?, ?)")
			.run(id, email, hashPassword("right-password"), name, "user", 1);
	addUser("u1", "sam@one.test", "Sam");
	addUser("u2", "kim@one.test", "Kim");
	addUser("u3", "lee@one.test", "Lee");
	const pushes = [];
	const IM_HUB = {
		getByName: (userId) => ({
			fetch: async (url, init) => {
				if (url.endsWith("/notify")) pushes.push({ userId, ...JSON.parse(init.body) });
				return new Response(null, { status: 204 });
			},
		}),
	};
	const env = { DB: database, MAILFLARE_RUNTIME: "node", APP_URL: "https://mail.one.test", IM_HUB, ...extraEnv };
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
	const login = async (account) => (await call("POST", "oauth/anyTenant/login", { body: { account, password: "right-password" } })).data.token;
	return { database, env, call, login, pushes };
}

/** Stands in for Cloudflare's TURN and RealtimeKit APIs and records what was asked of them. */
function mockCloudflare(t) {
	const requests = [];
	const original = globalThis.fetch;
	let participants = 0;
	globalThis.fetch = async (input, init = {}) => {
		const url = String(input);
		const body = init.body ? JSON.parse(init.body) : null;
		requests.push({ url, body, auth: init.headers?.Authorization });
		if (url.includes("/credentials/generate-ice-servers")) {
			return Response.json({
				iceServers: [
					{ urls: ["stun:stun.cloudflare.com:3478", "stun:stun.cloudflare.com:53"] },
					{ urls: ["turn:turn.cloudflare.com:3478?transport=udp", "turn:turn.cloudflare.com:53?transport=udp"], username: "user", credential: "secret" },
				],
			}, { status: 201 });
		}
		if (url.endsWith("/meetings")) return Response.json({ success: true, data: { id: "rtk-meeting-1", title: body.title } }, { status: 201 });
		if (url.endsWith("/participants")) {
			participants += 1;
			return Response.json({ success: true, data: { id: `rtk-participant-${participants}`, token: `token-${participants}` } }, { status: 201 });
		}
		return new Response("unexpected", { status: 500 });
	};
	t.after(() => { globalThis.fetch = original; });
	return requests;
}

const RTK_ENV = { REALTIMEKIT_ACCOUNT_ID: "acc", REALTIMEKIT_APP_ID: "app", REALTIMEKIT_API_TOKEN: "rtk-token" };

test("call frames become HuLa's call events for the other party", () => {
	assert.equal(parseRtcSocketRequest({ type: "2" }), null, "heartbeats are not calls");
	assert.equal(parseRtcSocketRequest({ type: 5 }), null);

	const ring = buildRtcRelay("u1", parseRtcSocketRequest({ type: 5, data: { roomId: "r1", targetUid: "u2", isVideo: true } }));
	assert.deepEqual(ring, { roomId: "r1", peerUid: "u2", toPeer: { type: "VideoCallRequest", data: { callerUid: "u1", targetUid: "u2", roomId: "r1", isVideo: true } } });

	const accepted = buildRtcRelay("u2", parseRtcSocketRequest({ type: "6", data: { roomId: "r1", callerUid: "u1", accepted: 1 } }));
	assert.equal(accepted.peerUid, "u1");
	assert.equal(accepted.toPeer.type, "CallAccepted");
	assert.equal(accepted.toOwnOtherDevices.type, "CANCEL", "answering stops the other devices ringing");
	const events = [-1, 0, 2, 3].map((status) => buildRtcRelay("u2", { type: 6, data: { roomId: "r1", callerUid: "u1", accepted: status } }).toPeer.type);
	assert.deepEqual(events, ["TIMEOUT", "CallRejected", "DROPPED", "CANCEL"]);
	assert.equal(buildRtcRelay("u2", { type: 6, data: { roomId: "r1", callerUid: "u1", accepted: 9 } }), null);

	const offer = buildRtcRelay("u1", { type: 14, data: { roomId: "r1", targetUid: "u2", signalType: "offer", signal: "{\"sdp\":\"v=0\"}", video: true } });
	assert.deepEqual(offer.toPeer.data, { callerUid: "u1", targetUid: "u2", roomId: "r1", signal: "{\"sdp\":\"v=0\"}", signalType: "offer", video: true });
	assert.equal(buildRtcRelay("u1", { type: 14, data: { roomId: "r1", targetUid: "u2", signalType: "bogus", signal: "x" } }), null);
	assert.equal(buildRtcRelay("u1", { type: 14, data: { roomId: "r1", targetUid: "u2", signalType: "offer", signal: "x".repeat(40000) } }), null);
	assert.equal(buildRtcRelay("u1", { type: 5, data: { roomId: "r1", targetUid: "u1" } }), null, "nobody calls themselves");
});

test("calls are relayed only between the two members of a private chat", async (t) => {
	const { call, login, env } = await fixture(t);
	const sam = await login("sam@one.test");
	const roomId = (await call("GET", "im/chat/contact/detail/friend", { token: sam, query: { id: "u2", roomType: "2" } })).data.roomId;

	const relay = await resolveRtcRelay(env, "u1", { type: 5, data: { roomId, targetUid: "u2", isVideo: false } });
	assert.equal(relay.peerUid, "u2");
	assert.equal(await resolveRtcRelay(env, "u1", { type: 5, data: { roomId, targetUid: "u3" } }), null, "u3 is not in the room");
	assert.equal(await resolveRtcRelay(env, "u3", { type: 5, data: { roomId, targetUid: "u2" } }), null, "outsiders cannot ring members");
	assert.equal(await resolveRtcRelay(env, "u1", { type: 5, data: { roomId: "1", targetUid: "u2" } }), null, "the all-staff group is not a private chat");
});

test("ICE servers: TURN credentials from the key, port 53 dropped, STUN only without a key", async (t) => {
	const requests = mockCloudflare(t);
	const plain = await fixture(t);
	const sam = await plain.login("sam@one.test");
	assert.deepEqual((await plain.call("GET", "im/rtc/iceServers", { token: sam })).data.iceServers, [{ urls: ["stun:stun.cloudflare.com:3478"] }]);
	assert.equal(requests.length, 0);
	assert.equal((await plain.call("GET", "im/rtc/iceServers")).code, 401, "credentials are for signed-in users only");

	const { call, login } = await fixture(t, { REALTIME_TURN_KEY_ID: "key", REALTIME_TURN_KEY_API_TOKEN: "turn-token" });
	const servers = (await call("GET", "im/rtc/iceServers", { token: await login("sam@one.test") })).data.iceServers;
	assert.deepEqual(servers, [
		{ urls: ["stun:stun.cloudflare.com:3478"] },
		{ urls: ["turn:turn.cloudflare.com:3478?transport=udp"], username: "user", credential: "secret" },
	]);
	assert.equal(requests[0].auth, "Bearer turn-token");
	assert.deepEqual(withoutBlockedTurnPorts([{ urls: "stun:x:53" }]), []);
});

test("meetings: unconfigured answers 501; a group meeting posts its link and reuses each join token", async (t) => {
	const unconfigured = await fixture(t);
	assert.equal((await unconfigured.call("POST", "im/meeting", { token: await unconfigured.login("sam@one.test"), body: {} })).code, 501);

	const requests = mockCloudflare(t);
	const { call, login, pushes } = await fixture(t, RTK_ENV);
	const sam = await login("sam@one.test");
	const kim = await login("kim@one.test");
	const roomId = (await call("POST", "im/room/group", { token: sam, body: { uidList: ["u2", "u3"] } })).data.roomId;
	pushes.length = 0;

	const created = await call("POST", "im/meeting", { token: sam, body: { roomId, title: "周会" } });
	assert.equal(created.code, 200);
	assert.match(created.data.id, MEETING_ID_PATTERN);
	assert.equal(created.data.url, `https://mail.one.test/meet/${created.data.id}`);
	assert.deepEqual(created.data.inviteeIds.sort(), ["u2", "u3"], "the group is invited");
	assert.equal(created.data.mailError, "发起人没有可用的邮箱", "no mailbox: the meeting still starts, without mail");
	assert.match(created.data.message.message.body.content, new RegExp(`发起了视频会议「周会」[\\s\\S]*${created.data.url}`));
	assert.deepEqual(pushes.map((push) => push.userId).sort(), ["u2", "u3"]);
	assert.deepEqual(requests[0].body, { title: "周会" });

	const hostJoin = await call("POST", "im/meeting/join", { token: sam, body: { id: created.data.id } });
	assert.deepEqual({ token: hostJoin.data.authToken, host: hostJoin.data.host }, { token: "token-1", host: true });
	assert.equal(requests[1].body.preset_name, "group_call_host");
	assert.equal(requests[1].body.custom_participant_id, "u1");
	const kimJoin = await call("POST", "im/meeting/join", { token: kim, body: { id: created.data.id } });
	assert.deepEqual({ token: kimJoin.data.authToken, host: kimJoin.data.host }, { token: "token-2", host: false });
	assert.equal(requests[2].body.preset_name, "group_call_participant");
	assert.equal((await call("POST", "im/meeting/join", { token: kim, body: { id: created.data.id } })).data.authToken, "token-2");
	assert.equal(requests.length, 3, "a second join does not add another participant");

	assert.equal((await call("POST", "im/meeting/join", { token: kim, body: { id: "aaaaaaaaaaaaaaaa" } })).code, 404);
	assert.equal((await call("POST", "im/meeting", { token: sam, body: { roomId: "nope" } })).code, 403);
	const listed = (await call("GET", "im/meeting/list", { token: kim })).data;
	assert.deepEqual(listed.map((meeting) => meeting.id), [created.data.id]);
	const ics = (await call("GET", "im/meeting/ics", { token: kim, query: { id: created.data.id } })).data;
	assert.match(ics.body, /METHOD:PUBLISH/);

	assert.equal((await call("POST", "im/meeting/cancel", { token: kim, body: { id: created.data.id } })).code, 403, "only the host cancels");
	assert.equal((await call("POST", "im/meeting/cancel", { token: sam, body: { id: created.data.id } })).code, 200);
	assert.deepEqual((await call("GET", "im/meeting/list", { token: kim })).data, [], "a cancelled meeting leaves the list");
	assert.equal((await call("POST", "im/meeting/join", { token: kim, body: { id: created.data.id } })).code, 404, "and cannot be joined");
});

test("meeting input validation", () => {
	const now = Date.parse("2026-10-19T00:00:00Z");
	assert.deepEqual(parseMeetingCreateInput({}, now), { title: "", roomId: null, startsAt: null, durationMinutes: 60, inviteeIds: [], sendMail: true });
	assert.equal(parseMeetingCreateInput({ startAt: "2026-10-20T02:00:00Z", durationMinutes: 30 }, now).startsAt, Date.parse("2026-10-20T02:00:00Z"));
	assert.throws(() => parseMeetingCreateInput({ startAt: "2026-10-18T00:00:00Z" }, now), /早于现在/);
	assert.throws(() => parseMeetingCreateInput({ durationMinutes: 2 }, now), /时长/);
	assert.throws(() => parseMeetingCreateInput({ startAt: "tomorrow-ish" }, now), /时间无效/);
	assert.match(newMeetingId(), MEETING_ID_PATTERN);
});

test("invitations are RFC 5545 requests the recipient's own calendar can accept", () => {
	const ics = buildMeetingIcs({
		uid: "abc@smj-meeting",
		sequence: 0,
		title: "季度复盘, 第一场; 全员",
		description: "Sam 邀请你参加视频会议。\n加入会议：https://mail.one.test/meet/abc",
		joinUrl: "https://mail.one.test/meet/abc",
		startsAt: Date.parse("2026-10-20T02:00:00Z"),
		durationMinutes: 45,
		organizer: { name: "Sam", email: "sam@one.test" },
		attendees: [{ name: "Kim \"K\"", email: "kim@one.test" }],
		method: "REQUEST",
	});
	assert.ok(ics.endsWith("\r\n"));
	const lines = ics.split("\r\n");
	assert.equal(lines[0], "BEGIN:VCALENDAR");
	assert.ok(lines.includes("METHOD:REQUEST"));
	assert.ok(lines.includes("DTSTART:20261020T020000Z"));
	assert.ok(lines.includes("DTEND:20261020T024500Z"));
	assert.ok(lines.includes("SUMMARY:季度复盘\\, 第一场\\; 全员"));
	assert.ok(lines.includes("ORGANIZER;CN=\"Sam\":mailto:sam@one.test"));
	assert.ok(ics.replace(/\r\n /g, "").includes("ATTENDEE;CN=\"Kim K\";ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:kim@one.test"));
	for (const line of lines) assert.ok(new TextEncoder().encode(line).byteLength <= 75, `folded: ${line}`);

	const long = "DESCRIPTION:" + "会".repeat(60);
	const folded = foldIcsLine(long);
	assert.equal(folded.split("\r\n ").join(""), long, "unfolding restores the line");
});

test("the meeting page allows camera and microphone, and web joins need a session", async (t) => {
	const { env, database } = await fixture(t, RTK_ENV);
	database.db.prepare("INSERT INTO im_meetings (id, rtk_meeting_id, title, host_id, created_at) VALUES ('abcdefghijklmnop', 'rtk', 'T', 'u1', 1)").run();
	const page = await handleMeetingRequest(new Request("https://mail.one.test/meet/abcdefghijklmnop"), env);
	assert.equal(page.status, 200);
	assert.match(page.headers.get("Permissions-Policy"), /camera=\(self\), microphone=\(self\)/);
	// Only this origin and Cloudflare: RealtimeKit is served from public/vendor.
	const hosts = page.headers.get("Content-Security-Policy").match(/(?:https|wss):\/\/[^\s;]+/g);
	assert.deepEqual(hosts.filter((host) => !/^(?:https|wss):\/\/(?:\*\.realtime\.cloudflare\.com|static\.cloudflareinsights\.com|cloudflareinsights\.com)$/.test(host)), []);
	const html = await page.text();
	assert.match(html, /"\/vendor\/realtimekit\/2\.0\.2\/ui"/);
	assert.doesNotMatch(html, /https?:\/\//);
	const vendor = join(root, "public", "vendor", "realtimekit", "2.0.2");
	assert.ok(existsSync(join(vendor, "core", "browser.js")) && existsSync(join(vendor, "ui", "loader", "index.es2017.js")));
	for (const file of readdirSync(join(vendor, "ui", "dist", "esm"))) {
		assert.doesNotMatch(readFileSync(join(vendor, "ui", "dist", "esm", file), "utf8"), /fonts\.(?:googleapis|gstatic)\.com/, file);
	}
	assert.match(page.headers.get("Permissions-Policy"), /display-capture=\(self\)/, "screen sharing stays allowed");
	assert.match(html, /仅主持人可共享屏幕/);
	assert.match(html, /"hostPreset":"group_call_host"/, "the page compares presets with the configured host preset");

	const anonymous = await handleMeetingRequest(new Request("https://mail.one.test/api/meetings/abcdefghijklmnop/join", { method: "POST" }), env);
	assert.equal(anonymous.status, 401);
	const ics = await handleMeetingRequest(new Request("https://mail.one.test/api/meetings/abcdefghijklmnop/meeting.ics"), env);
	assert.equal(ics.headers.get("Content-Type"), "text/calendar; charset=UTF-8");
	assert.equal((await handleMeetingRequest(new Request("https://mail.one.test/api/meetings/zzzzzzzzzzzzzzzz/meeting.ics"), env)).status, 404);
});

test("people already in a meeting can add others, who get the link in a private chat", async (t) => {
	mockCloudflare(t);
	const { call, login, pushes, env } = await fixture(t, RTK_ENV);
	const sam = await login("sam@one.test");
	const kim = await login("kim@one.test");
	const created = (await call("POST", "im/meeting", { token: sam, body: { title: "评审", inviteUids: ["u2"], sendMail: false } })).data;
	const kimToken = (await call("POST", "im/meeting/join", { token: kim, body: { id: created.id } })).data.authToken;
	const page = (path, init = {}) => handleMeetingRequest(new Request(`https://mail.one.test/api/meetings/${created.id}/${path}`, init), env);

	assert.equal((await page("people")).status, 401, "no token, no session");
	assert.equal((await page("people", { headers: { Authorization: "Bearer someone-else" } })).status, 401);
	const people = (await (await page("people", { headers: { Authorization: `Bearer ${kimToken}` } })).json()).people;
	assert.deepEqual(people.map((person) => [person.id, person.invited, person.joined]), [["u3", false, false], ["u1", true, false]], "the directory, without the viewer");

	pushes.length = 0;
	const invite = await page("invite", {
		method: "POST",
		headers: { Authorization: `Bearer ${kimToken}`, "Content-Type": "application/json" },
		body: JSON.stringify({ userIds: ["u3", "u2"], sendMail: false }),
	});
	assert.equal(invite.status, 200);
	assert.deepEqual(await invite.json(), { invited: 1, mailed: [], mailError: null });
	const pushed = pushes.filter((push) => push.type === "receiveMessage");
	assert.deepEqual(pushed.map((push) => push.userId).sort(), ["u2", "u3"], "the invitee and the inviter's own client");
	assert.match(pushed[0].data.message.body.content, new RegExp(`邀请你加入视频会议「评审」[\\s\\S]*/meet/${created.id}`));
	assert.equal(pushed[0].data.fromUser.uid, "u2");
	const lee = await login("lee@one.test");
	assert.deepEqual((await call("GET", "im/meeting/list", { token: lee })).data.map((meeting) => meeting.id), [created.id], "now on the invitee's list");

	const outsider = await page("invite", { method: "POST", headers: { Authorization: "Bearer token-x" }, body: "{}" });
	assert.equal(outsider.status, 401);
});
