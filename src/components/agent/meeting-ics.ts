import { escapeIcsText, foldIcsLine } from "@/lib/meetings/ics-utils";
import type { AgentActionProposal } from "./types";

function icsStamp(ms: number): string {
	return new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** A PUBLISH calendar file for a suggested meeting, for calendars outside SMJ; nothing is sent to anyone. */
export function buildAgentMeetingIcs(proposal: Pick<AgentActionProposal, "title" | "startsAt" | "durationMinutes" | "location" | "description" | "invitees" | "external">, uid: string, now = Date.now()): string | null {
	const start = Date.parse(proposal.startsAt ?? "");
	if (!Number.isFinite(start)) return null;
	const end = start + Math.max(proposal.durationMinutes ?? 60, 5) * 60_000;
	const attendees = [...(proposal.invitees ?? []).map((person) => ({ name: person.name, email: person.email })), ...(proposal.external ?? []).map((email) => ({ name: email, email }))];
	const lines = [
		"BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//SMJ//Mail Assistant//ZH", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
		"BEGIN:VEVENT", `UID:${uid}@smj-assistant`, `DTSTAMP:${icsStamp(now)}`, `DTSTART:${icsStamp(start)}`, `DTEND:${icsStamp(end)}`,
		`SUMMARY:${escapeIcsText(proposal.title || "会议")}`,
		...(proposal.description ? [`DESCRIPTION:${escapeIcsText(proposal.description)}`] : []),
		...(proposal.location ? [`LOCATION:${escapeIcsText(proposal.location)}`] : []),
		...attendees.map((person) => `ATTENDEE;CN="${person.name.replace(/["\r\n]/g, "")}";ROLE=REQ-PARTICIPANT:mailto:${person.email}`),
		"BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${escapeIcsText(proposal.title || "会议")}`, "TRIGGER:-PT10M", "END:VALARM",
		"END:VEVENT", "END:VCALENDAR",
	];
	return lines.map(foldIcsLine).join("\r\n") + "\r\n";
}
