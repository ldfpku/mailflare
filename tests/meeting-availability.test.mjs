import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import test, { after } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const directory = mkdtempSync(join(root, "node_modules", "mailflare-availability-test-"));
after(() => rmSync(directory, { recursive: true, force: true }));
await build({
	stdin: {
		contents: `
			export { SqliteDatabase } from "./server/runtime/sqlite-database.ts";
			export { applyMigrations } from "./server/runtime/migrate.ts";
			export { hashPassword } from "./src/lib/auth/password.ts";
			export { handleImRequest } from "./src/lib/im/handler.ts";
			export * from "./src/lib/meetings/availability-utils.ts";
		`,
		resolveDir: root,
		sourcefile: "availability-test-entry.ts",
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
	SqliteDatabase, applyMigrations, hashPassword, handleImRequest,
	parseIcs, parseIcsDuration, resolveIcsTimeZone, expandIcsOccurrences, suggestFreeSlots, mergeIntervals, parseAvailabilityInput,
} = await import(pathToFileURL(join(directory, "entry.mjs")).href);

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** A wall-clock time in China (UTC+8, no daylight saving). */
const cst = (y, m, d, h = 0, min = 0) => Date.UTC(y, m - 1, d, h - 8, min);
/** The Monday at least a week ahead, as [y, m, d] in China. */
function nextMonday(now = Date.now()) {
	const date = new Date(now + 7 * DAY + 8 * HOUR);
	while (date.getUTCDay() !== 1) date.setUTCDate(date.getUTCDate() + 1);
	return [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()];
}
const ics = (...lines) => lines.join("\r\n");

test("iCalendar: Outlook zones, durations, alarms, replies and cancellations", () => {
	assert.equal(resolveIcsTimeZone("China Standard Time"), "Asia/Shanghai");
	assert.equal(resolveIcsTimeZone("Europe/Berlin"), "Europe/Berlin");
	assert.equal(resolveIcsTimeZone("(UTC+08:00) Beijing, Chongqing, Hong Kong, Urumqi"), "Asia/Shanghai");
	assert.equal(resolveIcsTimeZone("(UTC+09:00) Somewhere"), "Etc/GMT-9");
	assert.equal(resolveIcsTimeZone("Nowhere Standard Time"), null);
	assert.equal(parseIcsDuration("PT1H30M"), 90 * 60_000);
	assert.equal(parseIcsDuration("P1D"), DAY);
	assert.equal(parseIcsDuration("PT"), null);

	const outlook = parseIcs(ics(
		"BEGIN:VCALENDAR", "METHOD:REQUEST", "BEGIN:VTIMEZONE", "TZID:China Standard Time", "BEGIN:STANDARD", "DTSTART:16010101T000000", "TZOFFSETFROM:+0800", "TZOFFSETTO:+0800", "END:STANDARD", "END:VTIMEZONE",
		"BEGIN:VEVENT", "UID:040000008200E00074C5B7101A82E008", "SEQUENCE:2", "SUMMARY;LANGUAGE=zh-CN:供应商\\, 季度评审",
		"DTSTART;TZID=China Standard Time:20261020T093000", "DTEND;TZID=China Standard Time:20261020T110000",
		"BEGIN:VALARM", "TRIGGER:-PT15M", "DESCRIPTION:提醒", "END:VALARM", "END:VEVENT", "END:VCALENDAR",
	), "UTC");
	assert.equal(outlook.method, "REQUEST");
	assert.deepEqual(outlook.events.map((event) => ({ ...event })), [{
		uid: "040000008200E00074C5B7101A82E008", sequence: 2, start: cst(2026, 10, 20, 9, 30), end: cst(2026, 10, 20, 11), summary: "供应商, 季度评审", cancelled: false, rrule: null, timeZone: "Asia/Shanghai",
	}]);

	const folded = parseIcs(ics("BEGIN:VCALENDAR", "BEGIN:VEVENT", "UID:x", "DTSTART:20261020T020000Z", "DURATION:PT45M", "SUMMARY:A very long", "  title", "END:VEVENT", "END:VCALENDAR"), "UTC");
	assert.equal(folded.events[0].end - folded.events[0].start, 45 * 60_000);
	assert.equal(folded.events[0].summary, "A very long title");

	const floating = parseIcs(ics("BEGIN:VCALENDAR", "BEGIN:VEVENT", "UID:f", "DTSTART:20261020T100000", "END:VEVENT", "END:VCALENDAR"), "Asia/Shanghai");
	assert.equal(floating.events[0].start, cst(2026, 10, 20, 10), "a floating time is read in the default zone");
	assert.equal(floating.events[0].end - floating.events[0].start, 30 * 60_000, "no end: half an hour");

	const skipped = parseIcs(ics(
		"BEGIN:VCALENDAR",
		"BEGIN:VEVENT", "UID:allday", "DTSTART;VALUE=DATE:20261020", "DTEND;VALUE=DATE:20261021", "END:VEVENT",
		"BEGIN:VEVENT", "UID:free", "TRANSP:TRANSPARENT", "DTSTART:20261020T020000Z", "DTEND:20261020T030000Z", "END:VEVENT",
		"BEGIN:VEVENT", "UID:series", "RECURRENCE-ID:20261021T020000Z", "DTSTART:20261021T050000Z", "DTEND:20261021T060000Z", "END:VEVENT",
		"END:VCALENDAR",
	), "UTC");
	assert.deepEqual(skipped.events, [], "all-day, free and single-occurrence overrides do not count");

	const cancel = parseIcs(ics("BEGIN:VCALENDAR", "METHOD:CANCEL", "BEGIN:VEVENT", "UID:c", "STATUS:CANCELLED", "DTSTART:20261020T020000Z", "DTEND:20261020T030000Z", "END:VEVENT", "END:VCALENDAR"), "UTC");
	assert.equal(cancel.method, "CANCEL");
	assert.equal(cancel.events[0].cancelled, true);
});

test("repeating invitations expand within the window", () => {
	// Every Tuesday and Thursday 10:00-11:00 China time, four times from Tue 2026-10-20.
	const weekly = { start: cst(2026, 10, 20, 10), end: cst(2026, 10, 20, 11), rrule: "FREQ=WEEKLY;BYDAY=TU,TH;COUNT=4", timeZone: "Asia/Shanghai" };
	assert.deepEqual(expandIcsOccurrences(weekly, cst(2026, 10, 19), cst(2026, 11, 30)).map((item) => item.start), [
		cst(2026, 10, 20, 10), cst(2026, 10, 22, 10), cst(2026, 10, 27, 10), cst(2026, 10, 29, 10),
	]);
	assert.deepEqual(expandIcsOccurrences(weekly, cst(2026, 10, 27), cst(2026, 10, 28)).map((item) => item.start), [cst(2026, 10, 27, 10)]);
	const biweekly = { ...weekly, rrule: "FREQ=WEEKLY;INTERVAL=2;UNTIL=20261130T000000Z" };
	assert.deepEqual(expandIcsOccurrences(biweekly, cst(2026, 10, 19), cst(2026, 12, 31)).map((item) => item.start), [
		cst(2026, 10, 20, 10), cst(2026, 11, 3, 10), cst(2026, 11, 17, 10),
	]);
	const daily = { ...weekly, rrule: "FREQ=DAILY;COUNT=3" };
	assert.equal(expandIcsOccurrences(daily, cst(2026, 10, 19), cst(2026, 12, 31)).length, 3);
	const yearly = { ...weekly, rrule: "FREQ=YEARLY" };
	assert.equal(expandIcsOccurrences(yearly, cst(2026, 10, 19), cst(2027, 12, 31)).length, 1, "unsupported rules count once");
});

test("free slots: working hours on weekdays, earliest first, never on top of busy time", () => {
	assert.deepEqual(mergeIntervals([{ start: 5, end: 10 }, { start: 0, end: 5 }, { start: 20, end: 30 }, { start: 25, end: 26 }]), [{ start: 0, end: 10 }, { start: 20, end: 30 }]);
	// Fri 2026-10-23 and the weekend after it.
	const friday = cst(2026, 10, 23);
	const busy = [
		{ start: cst(2026, 10, 23, 9), end: cst(2026, 10, 23, 10, 15) },
		{ start: cst(2026, 10, 23, 11), end: cst(2026, 10, 23, 17, 30) },
	];
	const slots = suggestFreeSlots({ busy, from: friday, to: friday + 4 * DAY, now: friday - DAY, durationMinutes: 30, timeZone: "Asia/Shanghai" });
	assert.deepEqual(slots.map((slot) => slot.start), [
		cst(2026, 10, 23, 10, 30), // 10:15 is not on the half hour
		cst(2026, 10, 23, 17, 30),
		cst(2026, 10, 26, 9), // the weekend is skipped
		cst(2026, 10, 26, 9, 30),
		cst(2026, 10, 26, 10),
	]);
	const fromNow = suggestFreeSlots({ busy: [], from: friday, to: friday + DAY, now: cst(2026, 10, 23, 16, 10), durationMinutes: 60, timeZone: "Asia/Shanghai" });
	assert.deepEqual(fromNow.map((slot) => [slot.start, slot.end]), [[cst(2026, 10, 23, 16, 30), cst(2026, 10, 23, 17, 30)]], "nothing in the past, nothing past 18:00");
	assert.deepEqual(suggestFreeSlots({ busy: [], from: friday, to: friday + DAY, now: 0, durationMinutes: 600, timeZone: "Asia/Shanghai" }), [], "longer than a working day");

	const now = Date.UTC(2026, 9, 19);
	assert.throws(() => parseAvailabilityInput({ days: 30 }, now), /最多查询 14 天/);
	assert.throws(() => parseAvailabilityInput({ from: now - 10 * DAY }, now), /一年内/);
	assert.deepEqual(parseAvailabilityInput({ userIds: ["a", "a", 3, "b"], timeZone: "Mars/Base", durationMinutes: 30 }, now), {
		userIds: ["a", "b"], roomId: null, from: now, days: 7, durationMinutes: 30, timeZone: null,
	});
});

async function fixture(t) {
	const database = new SqliteDatabase(":memory:");
	t.after(() => database.db.close());
	await applyMigrations(database, join(root, "drizzle/migrations"));
	const addUser = (id, email, name, disabled = 0) =>
		database.db.prepare("INSERT INTO users (id, email, password_hash, name, role, time_zone, disabled, created_at) VALUES (?, ?, ?, ?, 'user', 'Asia/Shanghai', ?, 1)")
			.run(id, email, hashPassword("right-password"), name, disabled);
	addUser("u1", "sam@one.test", "Sam");
	addUser("u2", "kim@one.test", "Kim");
	addUser("u3", "lee@one.test", "Lee");
	addUser("u4", "gone@one.test", "Gone", 1);
	const objects = new Map();
	let reads = 0;
	const BUCKET = { get: async (key) => (objects.has(key) ? (reads++, { text: async () => objects.get(key) }) : null) };
	const IM_HUB = { getByName: () => ({ fetch: async () => new Response(null, { status: 204 }) }) };
	const env = { DB: database, MAILFLARE_RUNTIME: "node", APP_URL: "https://mail.one.test", IM_HUB, BUCKET };
	globalThis.__mailflareNodeEnv = env;
	t.after(() => { delete globalThis.__mailflareNodeEnv; });
	const call = async (method, path, { body, token } = {}) => {
		const response = await handleImRequest(new Request(`https://mail.one.test/api/im/${path}`, {
			method,
			headers: { "Content-Type": "application/json", ...(token ? { token } : {}) },
			body: body === undefined ? undefined : JSON.stringify(body),
		}), env);
		return response.json();
	};
	const login = async (account) => (await call("POST", "oauth/anyTenant/login", { body: { account, password: "right-password" } })).data.token;
	return { database, call, login, objects, reads: () => reads };
}

test("availability: busy times without titles for others, mail invitations, and free slots", async (t) => {
	const { database, call, login, objects, reads } = await fixture(t);
	const [y, m, d] = nextMonday();
	const monday = cst(y, m, d);
	const sam = await login("sam@one.test");
	const kim = await login("kim@one.test");
	const lee = await login("lee@one.test");

	// Sam hosts a meeting Monday 10:00-11:00 with Kim; a cancelled one at 16:00 must not count.
	const meeting = database.db.prepare("INSERT INTO im_meetings (id, rtk_meeting_id, title, host_id, invitee_ids, starts_at, duration_minutes, created_at, ended_at) VALUES (?, 'rtk', ?, 'u1', ?, ?, ?, 1, ?)");
	meeting.run("aaaaaaaaaaaaaaaa", "并购谈判（保密）", JSON.stringify(["u2"]), cst(y, m, d, 10), 60, null);
	meeting.run("bbbbbbbbbbbbbbbb", "已取消的会", JSON.stringify(["u2"]), cst(y, m, d, 16), 60, 5);
	// Kim's own mail calendar: a weekly 14:00-15:00 that started a week earlier.
	database.db.prepare("INSERT INTO calendar_events (id, user_id, title, repeat, time_zone, starts_at, ends_at, created_at, updated_at) VALUES ('evt1', 'u2', '体检', 'weekly', 'Asia/Shanghai', ?, ?, 1, 1)")
		.run(Math.floor((cst(y, m, d, 14) - 7 * DAY) / 1000), Math.floor((cst(y, m, d, 15) - 7 * DAY) / 1000));

	// Kim's mailbox received an outside invitation for Monday 15:30-17:00, a later update moving another one, and a cancellation.
	database.db.prepare("INSERT INTO domains (id, user_id, hostname, zone_id, created_at) VALUES ('d1', 'u1', 'one.test', 'z', 1)").run();
	database.db.prepare("INSERT INTO mailboxes (id, user_id, domain_id, local_part, created_at) VALUES ('mb2', 'u2', 'd1', 'kim', 1)").run();
	const received = Math.floor(Date.now() / 1000);
	const message = database.db.prepare("INSERT INTO messages (id, user_id, mailbox_id, direction, from_addr, to_addr, subject, status, read, created_at) VALUES (?, 'u2', 'mb2', 'inbound', 'boss@partner.test', 'kim@one.test', ?, ?, 0, ?)");
	const attach = database.db.prepare("INSERT INTO message_attachments (id, message_id, filename, content_type, size, r2_key, created_at) VALUES (?, ?, ?, ?, 100, ?, 1)");
	const stamp = (h, min = 0) => `${y}${String(m).padStart(2, "0")}${String(d).padStart(2, "0")}T${String(h).padStart(2, "0")}${String(min).padStart(2, "0")}00`;
	const invite = (uid, sequence, start, end, extra = [], method = "REQUEST") => ics("BEGIN:VCALENDAR", `METHOD:${method}`, "BEGIN:VEVENT", `UID:${uid}`, `SEQUENCE:${sequence}`, "SUMMARY:外部评审", `DTSTART;TZID=China Standard Time:${start}`, `DTEND;TZID=China Standard Time:${end}`, ...extra, "END:VEVENT", "END:VCALENDAR");
	const deliver = (id, body, { status = "received", at = received, filename = "invite.ics", type = "text/calendar; method=REQUEST" } = {}) => {
		message.run(id, "邀请", status, at);
		attach.run(`a-${id}`, id, filename, type, `att/${id}`);
		objects.set(`att/${id}`, body);
	};
	deliver("x1", invite("ext-1", 0, stamp(15, 30), stamp(17)));
	deliver("x2", invite("ext-2", 0, stamp(11), stamp(12)));
	deliver("x3", invite("ext-2", 1, stamp(12), stamp(13)), { at: received + 1, filename: "update.ics", type: "application/octet-stream" });
	deliver("x4", invite("ext-3", 0, stamp(9), stamp(9, 30)));
	deliver("x5", invite("ext-3", 1, stamp(9), stamp(9, 30), ["STATUS:CANCELLED"], "CANCEL"), { at: received + 1 });
	deliver("x6", invite("aaaaaaaaaaaaaaaa@smj-meeting", 0, stamp(10), stamp(11)));
	deliver("x7", invite("ext-4", 0, stamp(9, 30), stamp(10)), { status: "trash" });
	deliver("x8", invite("ext-5", 0, stamp(13), stamp(14), [], "REPLY"));

	const ask = (token, body) => call("POST", "im/meeting/availability", { token, body: { from: monday, days: 1, durationMinutes: 60, timeZone: "Asia/Shanghai", ...body } });
	assert.equal((await ask(undefined, { userIds: ["u2"] })).code, 401, "signed-in accounts only");

	const asLee = await ask(lee, { userIds: ["u1", "u2", "u4", "nobody"] });
	assert.equal(asLee.code, 200);
	assert.deepEqual(asLee.data.participants.map((p) => p.uid), ["u3", "u1", "u2"], "the asker first, then active accounts");
	assert.deepEqual(asLee.data.excluded, ["u4", "nobody"], "disabled and unknown accounts are left out");
	const kimForLee = asLee.data.participants.find((p) => p.uid === "u2");
	const at = (block) => [new Date(block.start + 8 * HOUR).toISOString().slice(11, 16), new Date(block.end + 8 * HOUR).toISOString().slice(11, 16), block.source];
	assert.deepEqual(kimForLee.busy.map(at), [
		["10:00", "11:00", "meeting"],
		["12:00", "13:00", "mail"], // ext-2 moved by its update
		["14:00", "15:00", "calendar"],
		["15:30", "17:00", "mail"],
	]);
	assert.ok(kimForLee.busy.every((block) => !("title" in block)), "no titles of other people's meetings");
	assert.deepEqual(asLee.data.participants.find((p) => p.uid === "u1").busy.map(at), [["10:00", "11:00", "meeting"]]);
	assert.equal(JSON.stringify(asLee.data).includes("并购"), false);
	assert.equal(JSON.stringify(asLee.data).includes("外部评审"), false);
	assert.equal(JSON.stringify(asLee.data).includes("体检"), false);
	assert.deepEqual(asLee.data.suggestions.map((slot) => at(slot).slice(0, 2)), [["09:00", "10:00"], ["11:00", "12:00"], ["13:00", "14:00"], ["17:00", "18:00"]]);

	const readsAfterFirst = reads();
	assert.equal(readsAfterFirst, 8, "each invitation file is read once");
	await ask(lee, { userIds: ["u2"] });
	assert.equal(reads(), readsAfterFirst, "and then served from the parsed rows");

	const asKim = await ask(kim, { userIds: ["u1"] });
	const kimOwn = asKim.data.participants.find((p) => p.uid === "u2");
	assert.deepEqual(kimOwn.busy.map((block) => block.title), ["并购谈判（保密）", "外部评审", "体检", "外部评审"], "people see their own titles");
	assert.equal(asKim.data.participants.find((p) => p.uid === "u1").busy[0].title, "并购谈判（保密）", "an invitee may read the meeting's title on the host's row");

	// A chat's members are the default list; a room the asker is not in is refused.
	const roomId = (await call("GET", "im/chat/contact/detail/friend?id=u2&roomType=2", { token: sam })).data.roomId;
	const byRoom = await ask(sam, { roomId });
	assert.deepEqual(byRoom.data.participants.map((p) => p.uid).sort(), ["u1", "u2"]);
	assert.equal((await ask(lee, { roomId })).code, 403);
	assert.equal((await ask(lee, { days: 30 })).code, 400);

	// Deleting the mail drops its parsed rows with it.
	database.db.prepare("DELETE FROM messages WHERE id = 'x1'").run();
	assert.equal(database.db.prepare("SELECT count(*) AS n FROM im_calendar_invites WHERE attachment_id = 'a-x1'").get().n, 0);
});
