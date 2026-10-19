import { and, gt, inArray, lt, ne, or } from "drizzle-orm";
import { getDb } from "@/db";
import { calendarEvents } from "@/db/schema";
import { expandToolEvents } from "@/lib/calendar/tool-occurrences";
import { IM_ALL_STAFF_ROOM_ID } from "@/lib/im/chat-utils";
import { imAvatarUrl } from "@/lib/im/users-utils";
import {
	WORK_END_MINUTE,
	WORK_START_MINUTE,
	expandIcsOccurrences,
	parseIcs,
	suggestFreeSlots,
	type AvailabilityInput,
	type BusyBlock,
	type BusyInterval,
} from "./availability-utils";
import { MEETING_DEFAULT_TIME_ZONE, MEETING_INVITEE_LIMIT } from "./meeting-utils";
import { activeUsers, roomForHost, type MeetingUser } from "./service";

/**
 * The scheduling assistant behind HuLa's “预约会议”: when each invitee is busy,
 * and the earliest working-hours slots everyone has free.
 *
 * Busy time comes from three places, all inside SMJ: SMJ video meetings the
 * person hosts or was invited to, events in their mail calendar, and meeting
 * invitations (.ics) that reached their own mailbox, including from outside the
 * company. Only start and end leave the server for other people; a title is
 * shown only to someone who may already read it (the person themselves, or an
 * invitee of the same SMJ meeting).
 */
type Env = CloudflareEnv;

const DAY_MS = 86_400_000;
/** Invitations received this long ago or earlier are not read for busy time. */
const INVITE_LOOKBACK_MS = 120 * DAY_MS;
/** Attachments parsed per request; the rest are picked up by the next one. */
const INVITE_SYNC_LIMIT = 60;
const INVITE_MAX_BYTES = 256 * 1024;

export interface AvailabilityParticipant {
	uid: string;
	name: string;
	avatar: string;
	busy: BusyBlock[];
}

export interface AvailabilityResult {
	timeZone: string;
	from: number;
	to: number;
	workHours: { start: number; end: number };
	participants: AvailabilityParticipant[];
	/** Requested ids that are not active company accounts; they are left out. */
	excluded: string[];
	suggestions: BusyInterval[];
}

function placeholders(count: number): string {
	return Array.from({ length: count }, () => "?").join(", ");
}

function parseIds(value: string): string[] {
	try {
		const parsed = JSON.parse(value);
		return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
	} catch {
		return [];
	}
}

/** SMJ meetings that are neither cancelled nor over, by host and invitee. */
async function meetingBusy(env: Env, userIds: string[], viewerId: string, from: number, to: number): Promise<Map<string, BusyBlock[]>> {
	const result = await env.DB
		.prepare(
			`SELECT id, title, host_id, invitee_ids, starts_at, created_at, duration_minutes FROM im_meetings
			WHERE ended_at IS NULL AND COALESCE(starts_at, created_at) < ? AND COALESCE(starts_at, created_at) + duration_minutes * 60000 > ?`,
		)
		.bind(to, from)
		.all<{ id: string; title: string; host_id: string; invitee_ids: string; starts_at: number | null; created_at: number; duration_minutes: number }>();
	const wanted = new Set(userIds);
	const busy = new Map<string, BusyBlock[]>();
	for (const row of result.results) {
		const members = new Set([row.host_id, ...parseIds(row.invitee_ids)]);
		const start = row.starts_at ?? row.created_at;
		const block: BusyBlock = { start, end: start + row.duration_minutes * 60_000, source: "meeting" };
		if (members.has(viewerId)) block.title = row.title;
		for (const id of members) {
			if (!wanted.has(id)) continue;
			busy.set(id, [...(busy.get(id) ?? []), block]);
		}
	}
	return busy;
}

/** Events in each person's mail calendar, repeats expanded. */
async function calendarBusy(env: Env, userIds: string[], viewerId: string, from: number, to: number): Promise<Map<string, BusyBlock[]>> {
	const start = new Date(from);
	const end = new Date(to);
	const rows = await getDb(env)
		.select()
		.from(calendarEvents)
		.where(and(inArray(calendarEvents.userId, userIds), lt(calendarEvents.startsAt, end), or(gt(calendarEvents.endsAt, start), ne(calendarEvents.repeat, "none"))));
	const busy = new Map<string, BusyBlock[]>();
	for (const userId of userIds) {
		const own = rows.filter((row) => row.userId === userId);
		if (!own.length) continue;
		busy.set(
			userId,
			expandToolEvents(own, start, end).map((occurrence) => {
				const block: BusyBlock = { start: Date.parse(occurrence.startsAt), end: Date.parse(occurrence.endsAt), source: "calendar" };
				if (userId === viewerId) block.title = occurrence.title;
				return block;
			}),
		);
	}
	return busy;
}

/**
 * Parses calendar attachments of recent inbound mail in each person's own
 * mailboxes into `im_calendar_invites`, once per attachment. A file with
 * nothing usable gets a row without times so it is not read again.
 */
export async function syncMailInvites(env: Env, userIds: string[], now = Date.now()): Promise<number> {
	if (!userIds.length) return 0;
	const pending = await env.DB
		.prepare(
			`SELECT a.id AS attachment_id, a.r2_key, a.size, m.id AS message_id, mb.user_id
			FROM message_attachments a
			JOIN messages m ON m.id = a.message_id
			JOIN mailboxes mb ON mb.id = m.mailbox_id
			WHERE mb.user_id IN (${placeholders(userIds.length)}) AND mb.type = 'personal' AND m.direction = 'inbound' AND m.created_at >= ?
				AND (lower(a.content_type) LIKE 'text/calendar%' OR lower(a.filename) LIKE '%.ics')
				AND NOT EXISTS (SELECT 1 FROM im_calendar_invites c WHERE c.attachment_id = a.id)
			ORDER BY m.created_at DESC LIMIT ?`,
		)
		.bind(...userIds, Math.floor((now - INVITE_LOOKBACK_MS) / 1000), INVITE_SYNC_LIMIT)
		.all<{ attachment_id: string; r2_key: string; size: number; message_id: string; user_id: string }>();
	if (!pending.results.length) return 0;

	const statements = await Promise.all(
		pending.results.map(async (row) => {
			let parsed: ReturnType<typeof parseIcs> = { method: "", events: [] };
			if (row.size <= INVITE_MAX_BYTES) {
				try {
					const object = await env.BUCKET.get(row.r2_key);
					if (object) parsed = parseIcs(await object.text(), MEETING_DEFAULT_TIME_ZONE);
				} catch (error) {
					console.warn(`Calendar invite ${row.attachment_id} not read: ${error instanceof Error ? error.message : String(error)}`);
					return [];
				}
			}
			const insert = (index: number, values: (string | number | null)[]) =>
				env.DB
					.prepare(
						`INSERT OR IGNORE INTO im_calendar_invites (attachment_id, event_index, message_id, user_id, uid, method, sequence, cancelled, starts_at, ends_at, time_zone, rrule, summary, parsed_at)
						VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
					)
					.bind(row.attachment_id, index, row.message_id, row.user_id, ...values, now);
			// A reply is someone answering the person's own invitation, not time they gave away.
			const events = parsed.method === "REPLY" ? [] : parsed.events.slice(0, 20);
			if (!events.length) return [insert(0, [null, parsed.method || null, 0, 0, null, null, null, null, null])];
			return events.map((event, index) =>
				insert(index, [event.uid || null, parsed.method || null, event.sequence, event.cancelled ? 1 : 0, event.start, event.end, event.timeZone, event.rrule, event.summary]),
			);
		}),
	);
	const flat = statements.flat();
	if (flat.length) await env.DB.batch(flat);
	return pending.results.length;
}

/** Invitations received by mail that are still on: the latest version of each UID, unless it cancels. */
async function mailBusy(env: Env, userIds: string[], viewerId: string, from: number, to: number, now: number): Promise<Map<string, BusyBlock[]>> {
	await syncMailInvites(env, userIds, now);
	const result = await env.DB
		.prepare(
			`SELECT c.attachment_id, c.event_index, c.user_id, c.uid, c.method, c.sequence, c.cancelled, c.starts_at, c.ends_at, c.time_zone, c.rrule, c.summary, m.created_at AS received_at
			FROM im_calendar_invites c
			JOIN messages m ON m.id = c.message_id
			JOIN message_attachments a ON a.id = c.attachment_id
			WHERE c.user_id IN (${placeholders(userIds.length)}) AND c.starts_at IS NOT NULL AND m.status NOT IN ('trash', 'spam') AND a.trashed_at IS NULL`,
		)
		.bind(...userIds)
		.all<{
			attachment_id: string;
			event_index: number;
			user_id: string;
			uid: string | null;
			method: string | null;
			sequence: number;
			cancelled: number;
			starts_at: number;
			ends_at: number;
			time_zone: string | null;
			rrule: string | null;
			summary: string | null;
			received_at: number;
		}>();

	const latest = new Map<string, (typeof result.results)[number]>();
	for (const row of result.results) {
		// SMJ's own meetings are read from im_meetings, which also knows when they were cancelled.
		if (row.uid?.endsWith("@smj-meeting")) continue;
		const key = `${row.user_id}\n${row.uid || `${row.attachment_id}#${row.event_index}`}`;
		const seen = latest.get(key);
		if (!seen || row.sequence > seen.sequence || (row.sequence === seen.sequence && row.received_at > seen.received_at)) latest.set(key, row);
	}

	const busy = new Map<string, BusyBlock[]>();
	for (const row of latest.values()) {
		if (row.method === "CANCEL" || row.cancelled) continue;
		const occurrences = expandIcsOccurrences(
			{ start: row.starts_at, end: row.ends_at, rrule: row.rrule, timeZone: row.time_zone || MEETING_DEFAULT_TIME_ZONE },
			from,
			to,
		);
		for (const occurrence of occurrences) {
			const block: BusyBlock = { ...occurrence, source: "mail" };
			if (row.user_id === viewerId && row.summary) block.title = row.summary;
			busy.set(row.user_id, [...(busy.get(row.user_id) ?? []), block]);
		}
	}
	return busy;
}

export async function getAvailability(env: Env, viewer: MeetingUser, input: AvailabilityInput, origin: string, now = Date.now()): Promise<AvailabilityResult> {
	let requested = input.userIds;
	if (!requested.length && input.roomId && input.roomId !== IM_ALL_STAFF_ROOM_ID) {
		requested = (await roomForHost(env, input.roomId, viewer.id)).memberIds.slice(0, MEETING_INVITEE_LIMIT);
	}
	const ids = [...new Set([viewer.id, ...requested])].slice(0, MEETING_INVITEE_LIMIT + 1);
	// Only active company accounts have a schedule to show.
	const users = await activeUsers(env, ids);
	const byId = new Map(users.map((user) => [user.id, user]));
	const participants = ids.filter((id) => byId.has(id));
	const excluded = requested.filter((id) => !byId.has(id));

	const from = input.from;
	const to = from + input.days * DAY_MS;
	const timeZone = input.timeZone || viewer.timeZone || MEETING_DEFAULT_TIME_ZONE;
	const [meetings, calendar, mail] = await Promise.all([
		meetingBusy(env, participants, viewer.id, from, to),
		calendarBusy(env, participants, viewer.id, from, to),
		mailBusy(env, participants, viewer.id, from, to, now),
	]);

	const result: AvailabilityParticipant[] = participants.map((id) => {
		const user = byId.get(id)!;
		const busy = [...(meetings.get(id) ?? []), ...(calendar.get(id) ?? []), ...(mail.get(id) ?? [])]
			.filter((block) => block.end > from && block.start < to)
			.sort((a, b) => a.start - b.start || a.end - b.end);
		return { uid: id, name: user.name, avatar: imAvatarUrl(user, origin), busy };
	});
	const suggestions = suggestFreeSlots({
		busy: result.flatMap((participant) => participant.busy),
		from,
		to,
		now,
		durationMinutes: input.durationMinutes,
		timeZone,
	});
	return { timeZone, from, to, workHours: { start: WORK_START_MINUTE, end: WORK_END_MINUTE }, participants: result, excluded, suggestions };
}
