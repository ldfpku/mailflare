/**
 * iCalendar (RFC 5545) invitations for meetings. Invitations are a
 * METHOD:REQUEST calendar sent as an attachment, so the recipient's own
 * calendar (Outlook, Windows Calendar, macOS/iOS Calendar, Gmail, Android)
 * offers to accept it and reminds them; SMJ keeps no calendar of its own for it.
 */
export interface MeetingIcsInput {
	uid: string;
	sequence: number;
	title: string;
	description: string;
	joinUrl: string;
	startsAt: number;
	durationMinutes: number;
	organizer: { name: string; email: string };
	attendees: { name: string; email: string }[];
	method: "REQUEST" | "PUBLISH" | "CANCEL";
	createdAt?: number;
}

export const ICS_CONTENT_TYPE = "text/calendar; charset=UTF-8";

function utcStamp(ms: number): string {
	return new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** TEXT values escape backslash, semicolon, comma and newlines (RFC 5545 §3.3.11). */
export function escapeIcsText(value: string): string {
	return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** A parameter value is quoted, and may not itself contain a double quote. */
function quoteParam(value: string): string {
	return `"${value.replace(/["\r\n]/g, "")}"`;
}

/** Lines longer than 75 octets continue on the next line after CRLF and a space, never splitting a UTF-8 sequence. */
export function foldIcsLine(line: string): string {
	const encoder = new TextEncoder();
	const parts: string[] = [];
	let current = "";
	let currentBytes = 0;
	for (const char of line) {
		const size = encoder.encode(char).byteLength;
		const limit = parts.length === 0 ? 75 : 74;
		if (currentBytes + size > limit) {
			parts.push(current);
			current = "";
			currentBytes = 0;
		}
		current += char;
		currentBytes += size;
	}
	parts.push(current);
	return parts.join("\r\n ");
}

export function buildMeetingIcs(input: MeetingIcsInput): string {
	const end = input.startsAt + Math.max(input.durationMinutes, 1) * 60_000;
	const lines = [
		"BEGIN:VCALENDAR",
		"VERSION:2.0",
		"PRODID:-//SMJ//Meetings//ZH",
		"CALSCALE:GREGORIAN",
		`METHOD:${input.method}`,
		"BEGIN:VEVENT",
		`UID:${input.uid}`,
		`SEQUENCE:${input.sequence}`,
		`DTSTAMP:${utcStamp(Date.now())}`,
		...(input.createdAt ? [`CREATED:${utcStamp(input.createdAt)}`] : []),
		`DTSTART:${utcStamp(input.startsAt)}`,
		`DTEND:${utcStamp(end)}`,
		`SUMMARY:${escapeIcsText(input.title)}`,
		`DESCRIPTION:${escapeIcsText(input.description)}`,
		`LOCATION:${escapeIcsText(input.joinUrl)}`,
		`URL:${input.joinUrl}`,
		`ORGANIZER;CN=${quoteParam(input.organizer.name)}:mailto:${input.organizer.email}`,
		...input.attendees.map(
			(attendee) =>
				`ATTENDEE;CN=${quoteParam(attendee.name)};ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${attendee.email}`,
		),
		`STATUS:${input.method === "CANCEL" ? "CANCELLED" : "CONFIRMED"}`,
		"TRANSP:OPAQUE",
		"BEGIN:VALARM",
		"ACTION:DISPLAY",
		`DESCRIPTION:${escapeIcsText(input.title)}`,
		"TRIGGER:-PT10M",
		"END:VALARM",
		"END:VEVENT",
		"END:VCALENDAR",
	];
	return lines.map(foldIcsLine).join("\r\n") + "\r\n";
}
