import { dateFromZonedFields, isValidTimeZone, zonedDateFields } from "@/lib/time/utils";
import { MEETING_DEFAULT_DURATION, MEETING_INVITEE_LIMIT, MEETING_MAX_DURATION, MeetingError } from "./meeting-utils";

/**
 * The scheduling assistant: who is busy when, and the earliest times everyone
 * is free. Pure helpers only; `availability.ts` reads the rows.
 */

export const AVAILABILITY_MAX_DAYS = 14;
export const AVAILABILITY_DEFAULT_DAYS = 7;
/** Working hours the suggestions stay within, as minutes after local midnight, Monday to Friday. */
export const WORK_START_MINUTE = 9 * 60;
export const WORK_END_MINUTE = 18 * 60;
export const SUGGESTION_STEP_MINUTES = 30;
export const SUGGESTION_LIMIT = 5;

const DAY_MS = 86_400_000;

export interface BusyInterval {
	start: number;
	end: number;
}

/** meeting: an SMJ video meeting; calendar: the mail calendar; mail: an invitation received by mail (.ics). */
export type BusySource = "meeting" | "calendar" | "mail";

export interface BusyBlock extends BusyInterval {
	source: BusySource;
	/** Only present when the person asking may see it. */
	title?: string;
}

export interface AvailabilityInput {
	userIds: string[];
	roomId: string | null;
	from: number;
	days: number;
	durationMinutes: number;
	timeZone: string | null;
}

export function parseAvailabilityInput(body: Record<string, unknown>, now = Date.now()): AvailabilityInput {
	const rawIds = Array.isArray(body.userIds) ? body.userIds : Array.isArray(body.uidList) ? body.uidList : [];
	const userIds = [...new Set(rawIds.filter((id): id is string => typeof id === "string" && id.length > 0 && id.length <= 64))];
	if (userIds.length > MEETING_INVITEE_LIMIT + 1) throw new MeetingError(400, `一次最多查询 ${MEETING_INVITEE_LIMIT} 人`);
	const roomId = typeof body.roomId === "string" && body.roomId.trim() ? body.roomId.trim().slice(0, 64) : null;

	let from = now;
	if (body.from !== undefined && body.from !== null && body.from !== "") {
		const parsed = typeof body.from === "number" ? body.from : Date.parse(String(body.from));
		if (!Number.isFinite(parsed)) throw new MeetingError(400, "查询时间无效");
		from = parsed;
	}
	if (from < now - 2 * DAY_MS || from > now + 366 * DAY_MS) throw new MeetingError(400, "只能查询今天起一年内的日程");

	const days = Math.round(Number(body.days ?? AVAILABILITY_DEFAULT_DAYS));
	if (!Number.isFinite(days) || days < 1 || days > AVAILABILITY_MAX_DAYS) throw new MeetingError(400, `一次最多查询 ${AVAILABILITY_MAX_DAYS} 天`);

	const duration = Number(body.durationMinutes ?? MEETING_DEFAULT_DURATION);
	if (!Number.isFinite(duration) || duration < 5 || duration > MEETING_MAX_DURATION) throw new MeetingError(400, "会议时长应在 5 分钟到 12 小时之间");

	const timeZone = typeof body.timeZone === "string" && body.timeZone && isValidTimeZone(body.timeZone) ? body.timeZone : null;
	return { userIds, roomId, from, days, durationMinutes: Math.round(duration), timeZone };
}

/** Sorted, with overlapping and touching intervals joined. */
export function mergeIntervals(intervals: BusyInterval[]): BusyInterval[] {
	const sorted = intervals.filter((item) => item.end > item.start).sort((a, b) => a.start - b.start);
	const merged: BusyInterval[] = [];
	for (const item of sorted) {
		const last = merged[merged.length - 1];
		if (last && item.start <= last.end) last.end = Math.max(last.end, item.end);
		else merged.push({ start: item.start, end: item.end });
	}
	return merged;
}

export function overlaps(a: BusyInterval, b: BusyInterval): boolean {
	return a.start < b.end && b.start < a.end;
}

/** Local midnight of the day `at` falls on, as a UTC date carrying the wall-clock fields. */
function wallDay(at: number, timeZone: string): Date {
	const day = zonedDateFields(new Date(at), timeZone);
	day.setUTCHours(0, 0, 0, 0);
	return day;
}

function atWallMinute(day: Date, minute: number, timeZone: string): number {
	return dateFromZonedFields(new Date(day.getTime() + minute * 60_000), timeZone).getTime();
}

/**
 * The earliest times within working hours (Monday to Friday, 9:00 to 18:00 in
 * `timeZone`) when nobody is busy, on the half hour, not overlapping each other.
 */
export function suggestFreeSlots(options: {
	busy: BusyInterval[];
	from: number;
	to: number;
	now: number;
	durationMinutes: number;
	timeZone: string;
	limit?: number;
}): BusyInterval[] {
	const { from, to, now, durationMinutes, timeZone } = options;
	const limit = options.limit ?? SUGGESTION_LIMIT;
	const busy = mergeIntervals(options.busy);
	const duration = durationMinutes * 60_000;
	const slots: BusyInterval[] = [];
	const earliest = Math.max(from, now);
	for (let day = wallDay(earliest, timeZone); atWallMinute(day, 0, timeZone) < to && slots.length < limit; day = new Date(day.getTime() + DAY_MS)) {
		const weekday = day.getUTCDay();
		if (weekday === 0 || weekday === 6) continue;
		for (let minute = WORK_START_MINUTE; minute + durationMinutes <= WORK_END_MINUTE && slots.length < limit; minute += SUGGESTION_STEP_MINUTES) {
			const start = atWallMinute(day, minute, timeZone);
			if (start < earliest) continue;
			if (start >= to) break;
			const slot = { start, end: start + duration };
			const last = slots[slots.length - 1];
			if (last && slot.start < last.end) continue;
			if (busy.some((item) => overlaps(item, slot))) continue;
			slots.push(slot);
		}
	}
	return slots;
}

// ---------------------------------------------------------------------------
// iCalendar invitations received by mail
// ---------------------------------------------------------------------------

export interface IcsEvent {
	uid: string;
	sequence: number;
	start: number;
	end: number;
	summary: string;
	cancelled: boolean;
	/** The RRULE value, when the event repeats. */
	rrule: string | null;
	/** The zone a repeating event's wall-clock times are counted in. */
	timeZone: string;
}

export interface ParsedIcs {
	method: string;
	events: IcsEvent[];
}

/** Outlook writes Windows zone names into TZID; these are the ones a Chinese company is likely to receive. */
const WINDOWS_ZONES: Record<string, string> = {
	"China Standard Time": "Asia/Shanghai",
	"Taipei Standard Time": "Asia/Taipei",
	"Tokyo Standard Time": "Asia/Tokyo",
	"Korea Standard Time": "Asia/Seoul",
	"Singapore Standard Time": "Asia/Singapore",
	"India Standard Time": "Asia/Kolkata",
	"AUS Eastern Standard Time": "Australia/Sydney",
	"GMT Standard Time": "Europe/London",
	"W. Europe Standard Time": "Europe/Berlin",
	"Romance Standard Time": "Europe/Paris",
	"Central Europe Standard Time": "Europe/Budapest",
	"Russian Standard Time": "Europe/Moscow",
	"Eastern Standard Time": "America/New_York",
	"Central Standard Time": "America/Chicago",
	"Mountain Standard Time": "America/Denver",
	"Pacific Standard Time": "America/Los_Angeles",
	"UTC": "UTC",
	"Coordinated Universal Time": "UTC",
};

export function resolveIcsTimeZone(tzid: string | undefined): string | null {
	if (!tzid) return null;
	const name = tzid.replace(/^"|"$/g, "").replace(/^\//, "").trim();
	if (WINDOWS_ZONES[name]) return WINDOWS_ZONES[name];
	if (/^[A-Za-z_]+\/[A-Za-z_+\-/]+$|^UTC$/.test(name) && isValidTimeZone(name)) return name;
	if (/beijing|chongqing|hong kong|urumqi/i.test(name)) return "Asia/Shanghai";
	// "(UTC+08:00) …" style names: a whole-hour offset maps onto Etc/GMT, whose sign is inverted.
	const offset = /(?:UTC|GMT)\s*([+-])(\d{1,2})(?::?(\d{2}))?/.exec(name);
	if (offset && (!offset[3] || offset[3] === "00")) {
		const hours = Number(offset[2]);
		if (hours === 0) return "UTC";
		if (hours <= 14) return `Etc/GMT${offset[1] === "+" ? "-" : "+"}${hours}`;
	}
	return null;
}

function unescapeIcsText(value: string): string {
	return value.replace(/\\([\\;,nN])/g, (_, char: string) => (char === "n" || char === "N" ? "\n" : char));
}

interface IcsLine {
	name: string;
	params: Record<string, string>;
	value: string;
}

function parseIcsLine(line: string): IcsLine | null {
	let quoted = false;
	let colon = -1;
	for (let index = 0; index < line.length; index++) {
		const char = line[index];
		if (char === '"') quoted = !quoted;
		else if (char === ":" && !quoted) {
			colon = index;
			break;
		}
	}
	if (colon < 1) return null;
	const [name, ...rawParams] = line.slice(0, colon).split(";");
	const params: Record<string, string> = {};
	for (const param of rawParams) {
		const equals = param.indexOf("=");
		if (equals > 0) params[param.slice(0, equals).toUpperCase()] = param.slice(equals + 1).replace(/^"|"$/g, "");
	}
	return { name: name.toUpperCase(), params, value: line.slice(colon + 1) };
}

/** A DATE or DATE-TIME value: UTC with Z, else in its TZID, else floating (read in `defaultZone`). */
export function parseIcsDateTime(value: string, tzid: string | undefined, defaultZone: string): { at: number; allDay: boolean; timeZone: string } | null {
	const trimmed = value.trim();
	const date = /^(\d{4})(\d{2})(\d{2})$/.exec(trimmed);
	const zone = resolveIcsTimeZone(tzid) ?? defaultZone;
	if (date) {
		const fields = new Date(Date.UTC(Number(date[1]), Number(date[2]) - 1, Number(date[3])));
		return { at: dateFromZonedFields(fields, zone).getTime(), allDay: true, timeZone: zone };
	}
	const time = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(trimmed);
	if (!time) return null;
	const fields = new Date(Date.UTC(Number(time[1]), Number(time[2]) - 1, Number(time[3]), Number(time[4]), Number(time[5]), Number(time[6])));
	if (Number.isNaN(fields.getTime())) return null;
	if (time[7]) return { at: fields.getTime(), allDay: false, timeZone: zone };
	return { at: dateFromZonedFields(fields, zone).getTime(), allDay: false, timeZone: zone };
}

/** An RFC 5545 DURATION such as PT1H30M or P1D, in milliseconds. */
export function parseIcsDuration(value: string): number | null {
	const match = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(value.trim());
	if (!match || value.trim() === "P" || value.trim().endsWith("T")) return null;
	const [, sign, weeks, days, hours, minutes, seconds] = match;
	const total = ((Number(weeks ?? 0) * 7 + Number(days ?? 0)) * 24 * 3600 + Number(hours ?? 0) * 3600 + Number(minutes ?? 0) * 60 + Number(seconds ?? 0)) * 1000;
	return sign === "-" ? -total : total;
}

/**
 * The timed events of an iCalendar file. All-day events, free (TRANSP:TRANSPARENT)
 * events and overrides of single occurrences (RECURRENCE-ID) are left out.
 */
export function parseIcs(text: string, defaultZone: string): ParsedIcs {
	const lines = text.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
	let method = "";
	const events: IcsEvent[] = [];
	const stack: string[] = [];
	let current: Record<string, IcsLine> | null = null;
	for (const raw of lines) {
		const line = parseIcsLine(raw);
		if (!line) continue;
		if (line.name === "BEGIN") {
			const component = line.value.trim().toUpperCase();
			stack.push(component);
			if (component === "VEVENT" && stack.length <= 2) current = {};
			continue;
		}
		if (line.name === "END") {
			const component = stack.pop();
			if (component === "VEVENT" && current) {
				const event = toIcsEvent(current, defaultZone);
				if (event) events.push(event);
				current = null;
			}
			continue;
		}
		if (stack.length === 1 && stack[0] === "VCALENDAR" && line.name === "METHOD") method = line.value.trim().toUpperCase();
		// Properties of a VALARM inside the event are not the event's.
		if (current && stack[stack.length - 1] === "VEVENT" && !(line.name in current)) current[line.name] = line;
	}
	return { method, events };
}

function toIcsEvent(props: Record<string, IcsLine>, defaultZone: string): IcsEvent | null {
	if (props["RECURRENCE-ID"]) return null;
	if ((props.TRANSP?.value ?? "").trim().toUpperCase() === "TRANSPARENT") return null;
	const dtstart = props.DTSTART;
	if (!dtstart) return null;
	const start = parseIcsDateTime(dtstart.value, dtstart.params.TZID, defaultZone);
	if (!start || start.allDay || dtstart.params.VALUE === "DATE") return null;
	let end: number | null = null;
	if (props.DTEND) end = parseIcsDateTime(props.DTEND.value, props.DTEND.params.TZID, defaultZone)?.at ?? null;
	else if (props.DURATION) {
		const duration = parseIcsDuration(props.DURATION.value);
		if (duration !== null) end = start.at + duration;
	}
	if (end === null || end <= start.at) end = start.at + 30 * 60_000;
	const sequence = Number.parseInt(props.SEQUENCE?.value ?? "0", 10);
	return {
		uid: (props.UID?.value ?? "").trim().slice(0, 300),
		sequence: Number.isFinite(sequence) ? sequence : 0,
		start: start.at,
		end,
		summary: unescapeIcsText(props.SUMMARY?.value ?? "").trim().slice(0, 200),
		cancelled: (props.STATUS?.value ?? "").trim().toUpperCase() === "CANCELLED",
		rrule: props.RRULE?.value.trim().slice(0, 500) || null,
		timeZone: start.timeZone,
	};
}

const WEEKDAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

/**
 * The occurrences of an event within [from, to). DAILY, WEEKLY (with BYDAY) and
 * MONTHLY (same day of the month) rules with INTERVAL, COUNT and UNTIL are
 * expanded; any other rule counts as its first occurrence only.
 */
export function expandIcsOccurrences(event: { start: number; end: number; rrule: string | null; timeZone: string }, from: number, to: number): BusyInterval[] {
	const duration = event.end - event.start;
	const single = event.start < to && event.end > from ? [{ start: event.start, end: event.end }] : [];
	if (!event.rrule) return single;
	const rule = Object.fromEntries(event.rrule.split(";").map((part) => {
		const [key, value = ""] = part.split("=");
		return [key.trim().toUpperCase(), value.trim().toUpperCase()];
	}));
	const freq = rule.FREQ;
	if (freq !== "DAILY" && freq !== "WEEKLY" && freq !== "MONTHLY") return single;
	const interval = Math.max(1, Number.parseInt(rule.INTERVAL ?? "1", 10) || 1);
	const count = rule.COUNT ? Number.parseInt(rule.COUNT, 10) : Number.POSITIVE_INFINITY;
	const until = rule.UNTIL ? parseIcsDateTime(rule.UNTIL, undefined, event.timeZone)?.at ?? null : null;
	const byDay = rule.BYDAY ? rule.BYDAY.split(",").map((day: string) => WEEKDAYS.indexOf(day.replace(/^[+-]?\d+/, ""))).filter((day: number) => day >= 0) : [];

	const zone = event.timeZone;
	const firstWall = zonedDateFields(new Date(event.start), zone);
	const firstDay = Date.UTC(firstWall.getUTCFullYear(), firstWall.getUTCMonth(), firstWall.getUTCDate());
	const timeOfDay = firstWall.getTime() - firstDay;
	const firstWeek = firstDay - ((firstWall.getUTCDay() + 6) % 7) * DAY_MS;
	const result: BusyInterval[] = [];
	let produced = 0;
	for (let day = firstDay, index = 0; index < 4000 && produced < count; day += DAY_MS, index++) {
		const date = new Date(day);
		const weekday = date.getUTCDay();
		let occurs: boolean;
		if (freq === "DAILY") occurs = index % interval === 0 && (!byDay.length || byDay.includes(weekday));
		else if (freq === "WEEKLY") occurs = Math.floor((day - firstWeek) / (7 * DAY_MS)) % interval === 0 && (byDay.length ? byDay.includes(weekday) : weekday === firstWall.getUTCDay());
		else {
			const months = (date.getUTCFullYear() - firstWall.getUTCFullYear()) * 12 + date.getUTCMonth() - firstWall.getUTCMonth();
			occurs = months % interval === 0 && date.getUTCDate() === firstWall.getUTCDate();
		}
		if (index === 0) occurs = true;
		if (!occurs) continue;
		const start = dateFromZonedFields(new Date(day + timeOfDay), zone).getTime();
		if (until !== null && start > until) break;
		if (start >= to) break;
		produced += 1;
		if (start + duration > from) result.push({ start, end: start + duration });
	}
	return result;
}
