import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { domains, mailboxes } from "@/db/schema";
import { formatEmailAddress } from "@/lib/email/address";
import { sendEmail } from "@/lib/email/send";
import { openSingleRoom, sendMessage, type ImDelivery } from "@/lib/im/chat";
import { IM_ALL_STAFF_ROOM_ID, IM_MSG_TYPE, IM_ROOM_TYPE } from "@/lib/im/chat-utils";
import { imAvatarUrl } from "@/lib/im/users-utils";
import { buildMeetingIcs, ICS_CONTENT_TYPE } from "./ics-utils";
import {
	MEETING_ID_PATTERN,
	MeetingError,
	formatMeetingTime,
	invitationHtml,
	invitationSubject,
	invitationText,
	meetingChatText,
	meetingInviteText,
	meetingUrl,
	newMeetingId,
	type MeetingCreateInput,
} from "./meeting-utils";
import { addRealtimeKitParticipant, createRealtimeKitMeeting, requireRealtimeKitConfig } from "./realtimekit";

/**
 * Video meetings: a RealtimeKit meeting plus our own row for the schedule and
 * invitees. Anyone with an active SMJ account may join a meeting by its link;
 * invitations go out as mail from the host's own mailbox with an iCalendar
 * attachment, so they land in the host's Sent folder and in every invitee's
 * calendar.
 */
type Env = CloudflareEnv;

export interface MeetingUser {
	id: string;
	name: string;
	email: string;
	avatarKey: string | null;
	timeZone: string | null;
}

interface MeetingRow {
	id: string;
	rtk_meeting_id: string;
	title: string;
	host_id: string;
	room_id: string | null;
	invitee_ids: string;
	starts_at: number | null;
	duration_minutes: number;
	sequence: number;
	created_at: number;
	ended_at: number | null;
}

export interface MeetingView {
	id: string;
	title: string;
	url: string;
	hostId: string;
	hostName: string;
	roomId: string | null;
	startsAt: number | null;
	durationMinutes: number;
	createdAt: number;
	inviteeIds: string[];
}

export interface MeetingCreated {
	meeting: MeetingView;
	/** The chat line for the room the meeting was started from, to push to its members. */
	delivery: ImDelivery | null;
	/** Addresses the invitation was sent to; empty when none was sent. */
	invited: string[];
	mailError: string | null;
}

const ACTIVE_USER = "disabled = 0 AND deleted_at IS NULL";

export async function activeUsers(env: Env, ids: string[]): Promise<MeetingUser[]> {
	if (!ids.length) return [];
	const result = await env.DB
		.prepare(`SELECT id, name, email, avatar_key, time_zone FROM users WHERE ${ACTIVE_USER} AND id IN (${ids.map(() => "?").join(", ")})`)
		.bind(...ids)
		.all<{ id: string; name: string; email: string; avatar_key: string | null; time_zone: string | null }>();
	return result.results.map((row) => ({ id: row.id, name: row.name || row.email, email: row.email, avatarKey: row.avatar_key, timeZone: row.time_zone }));
}

export async function getMeetingUser(env: Env, userId: string): Promise<MeetingUser | null> {
	return (await activeUsers(env, [userId]))[0] ?? null;
}

async function findMeeting(env: Env, id: string): Promise<MeetingRow> {
	if (!MEETING_ID_PATTERN.test(id)) throw new MeetingError(404, "会议不存在");
	const row = await env.DB.prepare("SELECT * FROM im_meetings WHERE id = ?").bind(id).first<MeetingRow>();
	if (!row) throw new MeetingError(404, "会议不存在");
	return row;
}

function toView(row: MeetingRow, hostName: string, origin: string): MeetingView {
	let inviteeIds: string[] = [];
	try {
		const parsed = JSON.parse(row.invitee_ids);
		if (Array.isArray(parsed)) inviteeIds = parsed.filter((id): id is string => typeof id === "string");
	} catch {
		// A malformed list reads as no invitees.
	}
	return {
		id: row.id,
		title: row.title,
		url: meetingUrl(origin, row.id),
		hostId: row.host_id,
		hostName,
		roomId: row.room_id,
		startsAt: row.starts_at,
		durationMinutes: row.duration_minutes,
		createdAt: row.created_at,
		inviteeIds,
	};
}

export async function getMeeting(env: Env, id: string, origin: string): Promise<MeetingView> {
	const row = await findMeeting(env, id);
	const host = await getMeetingUser(env, row.host_id);
	return toView(row, host?.name ?? "", origin);
}

/** The room a meeting is started from must be one the host is in; a group's members become the default invitees. */
export async function roomForHost(env: Env, roomId: string, hostId: string) {
	const room = await env.DB
		.prepare("SELECT r.id, r.type, r.name FROM im_rooms r JOIN im_room_members m ON m.room_id = r.id WHERE r.id = ? AND m.user_id = ?")
		.bind(roomId, hostId)
		.first<{ id: string; type: number; name: string }>();
	if (!room) throw new MeetingError(403, "你不在该会话中");
	const members = await env.DB.prepare("SELECT user_id FROM im_room_members WHERE room_id = ? AND user_id <> ?").bind(roomId, hostId).all<{ user_id: string }>();
	return { ...room, memberIds: members.results.map((row) => row.user_id) };
}

export async function createMeeting(env: Env, host: MeetingUser, input: MeetingCreateInput, origin: string): Promise<MeetingCreated> {
	const config = requireRealtimeKitConfig(env);
	const room = input.roomId ? await roomForHost(env, input.roomId, host.id) : null;

	// Without a list of its own, a meeting from a chat invites that chat; the all-staff group is too big to mail by default.
	let inviteeIds = input.inviteeIds;
	if (!input.inviteesChosen && !inviteeIds.length && room && room.id !== IM_ALL_STAFF_ROOM_ID) inviteeIds = room.memberIds.slice(0, 50);
	const invitees = (await activeUsers(env, inviteeIds.filter((id) => id !== host.id))).filter((user) => user.email);

	const defaultTitle = room?.type === IM_ROOM_TYPE.GROUP && room.name ? `${room.name} 的会议` : `${host.name} 的会议`;
	const title = input.title || defaultTitle;
	const rtkMeetingId = await createRealtimeKitMeeting(config, title);
	const now = Date.now();
	const row: MeetingRow = {
		id: newMeetingId(),
		rtk_meeting_id: rtkMeetingId,
		title,
		host_id: host.id,
		room_id: room?.id ?? null,
		invitee_ids: JSON.stringify(invitees.map((user) => user.id)),
		starts_at: input.startsAt,
		duration_minutes: input.durationMinutes,
		sequence: 0,
		created_at: now,
		ended_at: null,
	};
	await env.DB
		.prepare(
			`INSERT INTO im_meetings (id, rtk_meeting_id, title, host_id, room_id, invitee_ids, starts_at, duration_minutes, sequence, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
		)
		.bind(row.id, row.rtk_meeting_id, row.title, row.host_id, row.room_id, row.invitee_ids, row.starts_at, row.duration_minutes, row.created_at)
		.run();
	const meeting = toView(row, host.name, origin);
	const content = {
		title,
		hostName: host.name,
		time: formatMeetingTime(input.startsAt ?? now, input.durationMinutes, host.timeZone),
		joinUrl: meeting.url,
	};

	let delivery: ImDelivery | null = null;
	if (room) {
		const text = meetingChatText({ ...content, scheduled: input.startsAt !== null });
		delivery = await sendMessage(env, host.id, { roomId: room.id, msgType: IM_MSG_TYPE.TEXT, body: { content: text } }, origin);
	}

	let invited: string[] = [];
	let mailError: string | null = null;
	if (input.sendMail && invitees.length) {
		try {
			invited = await sendInvitation(env, row, host, invitees, content);
		} catch (error) {
			mailError = error instanceof Error ? error.message : String(error);
			console.warn(`Meeting ${row.id}: invitation not sent: ${mailError}`);
		}
	}
	return { meeting, delivery, invited, mailError };
}

/** The host's own mailbox: the one whose address is the account email, else their first personal mailbox. */
async function hostMailbox(env: Env, host: MeetingUser): Promise<{ id: string; address: string } | null> {
	const rows = await getDb(env)
		.select({ id: mailboxes.id, localPart: mailboxes.localPart, hostname: domains.hostname })
		.from(mailboxes)
		.innerJoin(domains, eq(mailboxes.domainId, domains.id))
		.where(and(eq(mailboxes.userId, host.id), eq(mailboxes.type, "personal"), eq(mailboxes.disabled, false)))
		.limit(20);
	const addresses = rows.map((row) => ({ id: row.id, address: `${row.localPart}@${row.hostname}`.toLowerCase() }));
	return addresses.find((row) => row.address === host.email.toLowerCase()) ?? addresses[0] ?? null;
}

function icsFor(row: MeetingRow, host: MeetingUser, organizerEmail: string, attendees: MeetingUser[], content: { joinUrl: string }, method: "REQUEST" | "PUBLISH" | "CANCEL") {
	return buildMeetingIcs({
		uid: `${row.id}@smj-meeting`,
		sequence: row.sequence,
		title: row.title,
		description: `${host.name} 邀请你参加视频会议。\n加入会议：${content.joinUrl}`,
		joinUrl: content.joinUrl,
		startsAt: row.starts_at ?? row.created_at,
		durationMinutes: row.duration_minutes,
		organizer: { name: host.name, email: organizerEmail },
		attendees: attendees.map((user) => ({ name: user.name, email: user.email })),
		method,
		createdAt: row.created_at,
	});
}

async function sendInvitation(
	env: Env,
	row: MeetingRow,
	host: MeetingUser,
	invitees: MeetingUser[],
	content: { title: string; hostName: string; time: string; joinUrl: string },
	/** Someone added mid-meeting is mailed from the inviter's own mailbox; the host stays the calendar organizer. */
	sender: MeetingUser = host,
): Promise<string[]> {
	const mailbox = await hostMailbox(env, sender);
	if (!mailbox) throw new Error(sender.id === host.id ? "发起人没有可用的邮箱" : "你没有可用的邮箱");
	const organizer = sender.id === host.id ? mailbox.address : ((await hostMailbox(env, host).catch(() => null))?.address ?? host.email);
	const ics = icsFor(row, host, organizer, invitees, content, "REQUEST");
	const to = invitees.map((user) => formatEmailAddress(user.email, user.name));
	await sendEmail(env, {
		userId: sender.id,
		mailboxId: mailbox.id,
		from: mailbox.address,
		to,
		subject: invitationSubject(content),
		text: invitationText(content),
		html: invitationHtml(content),
		attachments: [
			{
				filename: "invite.ics",
				// METHOD on the part is what makes Outlook show Accept / Decline instead of a plain attachment.
				type: `${ICS_CONTENT_TYPE}; method=REQUEST`,
				content: new TextEncoder().encode(ics).buffer as ArrayBuffer,
				disposition: "attachment",
			},
		],
	});
	return invitees.map((user) => user.email);
}

/** A calendar file to add the meeting to the viewer's own calendar (HuLa's “加入日历”, the meeting page's button). */
export async function getMeetingIcs(env: Env, id: string, origin: string): Promise<{ filename: string; body: string }> {
	const row = await findMeeting(env, id);
	const host = await getMeetingUser(env, row.host_id);
	if (!host) throw new MeetingError(404, "会议不存在");
	const mailbox = await hostMailbox(env, host).catch(() => null);
	const body = icsFor(row, host, mailbox?.address ?? host.email, [], { joinUrl: meetingUrl(origin, row.id) }, "PUBLISH");
	return { filename: "meeting.ics", body };
}

export interface MeetingJoin {
	authToken: string;
	meeting: MeetingView;
	host: boolean;
}

/** Adds the user to the RealtimeKit meeting once and reuses that participant's token for every later join. */
export async function joinMeeting(env: Env, id: string, user: MeetingUser, origin: string): Promise<MeetingJoin> {
	const row = await findMeeting(env, id);
	if (row.ended_at) throw new MeetingError(404, "会议已结束");
	const hostRecord = await getMeetingUser(env, row.host_id);
	const meeting = toView(row, hostRecord?.name ?? "", origin);
	const host = row.host_id === user.id;

	const existing = await env.DB
		.prepare("SELECT auth_token FROM im_meeting_participants WHERE meeting_id = ? AND user_id = ?")
		.bind(row.id, user.id)
		.first<{ auth_token: string }>();
	if (existing) return { authToken: existing.auth_token, meeting, host };

	const config = requireRealtimeKitConfig(env);
	const avatar = imAvatarUrl(user, origin);
	const participant = await addRealtimeKitParticipant(config, row.rtk_meeting_id, { userId: user.id, name: user.name, picture: avatar || null, host });
	// Two tabs joining at once both add a participant; the first stored token wins and the other is simply unused.
	await env.DB
		.prepare(
			"INSERT INTO im_meeting_participants (meeting_id, user_id, rtk_participant_id, auth_token, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT (meeting_id, user_id) DO NOTHING",
		)
		.bind(row.id, user.id, participant.id, participant.token, Date.now())
		.run();
	const stored = await env.DB
		.prepare("SELECT auth_token FROM im_meeting_participants WHERE meeting_id = ? AND user_id = ?")
		.bind(row.id, user.id)
		.first<{ auth_token: string }>();
	return { authToken: stored?.auth_token ?? participant.token, meeting, host };
}

/**
 * The host cancels a meeting: it leaves everyone's list, can no longer be joined,
 * and invitees of a meeting still ahead get a METHOD:CANCEL mail that removes it from their calendar.
 */
export async function cancelMeeting(env: Env, id: string, user: MeetingUser, origin: string): Promise<{ id: string; mailError: string | null }> {
	const row = await findMeeting(env, id);
	if (row.host_id !== user.id) throw new MeetingError(403, "只有发起人可以取消会议");
	if (row.ended_at) return { id: row.id, mailError: null };
	const now = Date.now();
	await env.DB.prepare("UPDATE im_meetings SET ended_at = ?, sequence = sequence + 1 WHERE id = ?").bind(now, row.id).run();
	const cancelled = { ...row, ended_at: now, sequence: row.sequence + 1 };

	const invitees = toView(row, user.name, origin).inviteeIds;
	if (!invitees.length || !row.starts_at || row.starts_at + row.duration_minutes * 60_000 < now) return { id: row.id, mailError: null };
	try {
		const host = (await getMeetingUser(env, row.host_id)) ?? user;
		const mailbox = await hostMailbox(env, host);
		if (!mailbox) throw new Error("发起人没有可用的邮箱");
		const attendees = await activeUsers(env, invitees);
		const content = { title: row.title, hostName: host.name, time: formatMeetingTime(row.starts_at, row.duration_minutes, host.timeZone), joinUrl: meetingUrl(origin, row.id) };
		const ics = icsFor(cancelled, host, mailbox.address, attendees, content, "CANCEL");
		await sendEmail(env, {
			userId: host.id,
			mailboxId: mailbox.id,
			from: mailbox.address,
			to: attendees.map((attendee) => formatEmailAddress(attendee.email, attendee.name)),
			subject: `已取消：${row.title}`,
			text: `${host.name} 取消了视频会议“${row.title}”（${content.time}）。`,
			attachments: [
				{
					filename: "cancel.ics",
					type: `${ICS_CONTENT_TYPE}; method=CANCEL`,
					content: new TextEncoder().encode(ics).buffer as ArrayBuffer,
					disposition: "attachment",
				},
			],
		});
		return { id: row.id, mailError: null };
	} catch (error) {
		const mailError = error instanceof Error ? error.message : String(error);
		console.warn(`Meeting ${row.id}: cancellation not sent: ${mailError}`);
		return { id: row.id, mailError };
	}
}

/** Meetings the user hosts or was invited to, newest first, for HuLa's meeting list. */
export async function listMeetings(env: Env, userId: string, origin: string, limit = 30): Promise<MeetingView[]> {
	const result = await env.DB
		.prepare(
			`SELECT m.*, u.name AS host_name FROM im_meetings m LEFT JOIN users u ON u.id = m.host_id
			WHERE m.ended_at IS NULL AND (m.host_id = ? OR EXISTS (SELECT 1 FROM json_each(m.invitee_ids) WHERE json_each.value = ?))
			ORDER BY COALESCE(m.starts_at, m.created_at) DESC LIMIT ?`,
		)
		.bind(userId, userId, limit)
		.all<MeetingRow & { host_name: string | null }>();
	return result.results.map((row) => toView(row, row.host_name ?? "", origin));
}

/** Who may add people to a meeting: its host and anyone who has joined it. */
async function canInvite(env: Env, row: MeetingRow, userId: string): Promise<boolean> {
	if (row.host_id === userId) return true;
	const joined = await env.DB.prepare("SELECT 1 FROM im_meeting_participants WHERE meeting_id = ? AND user_id = ?").bind(row.id, userId).first();
	return Boolean(joined);
}

/** The signed-in user behind a meeting page that holds a participant token (the desktop meeting window has no web session). */
export async function getMeetingUserByToken(env: Env, id: string, authToken: string): Promise<MeetingUser | null> {
	if (!MEETING_ID_PATTERN.test(id) || !authToken) return null;
	const row = await env.DB
		.prepare("SELECT user_id FROM im_meeting_participants WHERE meeting_id = ? AND auth_token = ?")
		.bind(id, authToken)
		.first<{ user_id: string }>();
	return row ? getMeetingUser(env, row.user_id) : null;
}

export interface MeetingPerson {
	id: string;
	name: string;
	email: string;
	invited: boolean;
	joined: boolean;
}

/** The organisation directory for the meeting page's “添加参会人”, marking who is already invited or in the meeting. */
export async function listMeetingPeople(env: Env, id: string, user: MeetingUser): Promise<MeetingPerson[]> {
	const row = await findMeeting(env, id);
	if (row.ended_at) throw new MeetingError(404, "会议已结束");
	if (!(await canInvite(env, row, user.id))) throw new MeetingError(403, "加入会议后才能邀请他人");
	const result = await env.DB
		.prepare(
			`SELECT u.id, u.name, u.email,
				EXISTS (SELECT 1 FROM json_each(?) WHERE json_each.value = u.id) AS invited,
				EXISTS (SELECT 1 FROM im_meeting_participants p WHERE p.meeting_id = ? AND p.user_id = u.id) AS joined
			FROM users u WHERE ${ACTIVE_USER} AND u.id <> ? ORDER BY u.name, u.email LIMIT 500`,
		)
		.bind(row.invitee_ids, row.id, user.id)
		.all<{ id: string; name: string | null; email: string; invited: number; joined: number }>();
	return result.results.map((person) => ({
		id: person.id,
		name: person.name || person.email,
		email: person.email,
		invited: Boolean(person.invited) || person.id === row.host_id,
		joined: Boolean(person.joined),
	}));
}

export interface MeetingInvited {
	/** One chat line per invitee, in the inviter's private chat with them; both sides get it, since the inviter sent it from the meeting page. */
	deliveries: ImDelivery[];
	invited: string[];
	mailError: string | null;
}

/**
 * Adds people while a meeting is on: each gets the meeting link in a private chat
 * from whoever invited them (a card they can click to join), joins the invitee
 * list (so the meeting shows in their list), and optionally a mail with the
 * calendar invitation.
 */
export async function inviteToMeeting(
	env: Env,
	id: string,
	inviter: MeetingUser,
	input: { userIds: string[]; sendMail: boolean },
	origin: string,
): Promise<MeetingInvited> {
	const row = await findMeeting(env, id);
	if (row.ended_at) throw new MeetingError(404, "会议已结束");
	if (!(await canInvite(env, row, inviter.id))) throw new MeetingError(403, "加入会议后才能邀请他人");
	const wanted = [...new Set(input.userIds.filter((userId) => typeof userId === "string" && userId && userId !== inviter.id))].slice(0, 50);
	const people = await activeUsers(env, wanted);
	if (!people.length) throw new MeetingError(400, "请选择要邀请的人");

	const existing = toView(row, "", origin).inviteeIds;
	const inviteeIds = [...new Set([...existing, ...people.map((person) => person.id)])].filter((userId) => userId !== row.host_id);
	await env.DB.prepare("UPDATE im_meetings SET invitee_ids = ? WHERE id = ?").bind(JSON.stringify(inviteeIds), row.id).run();

	const host = (await getMeetingUser(env, row.host_id)) ?? inviter;
	const content = {
		title: row.title,
		hostName: host.name,
		time: formatMeetingTime(row.starts_at ?? row.created_at, row.duration_minutes, inviter.timeZone),
		joinUrl: meetingUrl(origin, row.id),
	};
	const deliveries: ImDelivery[] = [];
	for (const person of people) {
		const roomId = await openSingleRoom(env, inviter.id, person.id);
		const delivery = await sendMessage(env, inviter.id, { roomId, msgType: IM_MSG_TYPE.TEXT, body: { content: meetingInviteText(content) } }, origin);
		deliveries.push({ message: delivery.message, recipients: [...new Set([...delivery.recipients, inviter.id])] });
	}

	let invited: string[] = [];
	let mailError: string | null = null;
	const mailTo = people.filter((person) => person.email);
	if (input.sendMail && mailTo.length) {
		try {
			invited = await sendInvitation(env, { ...row, invitee_ids: JSON.stringify(inviteeIds) }, host, mailTo, content, inviter);
		} catch (error) {
			mailError = error instanceof Error ? error.message : String(error);
			console.warn(`Meeting ${row.id}: added invitees not mailed: ${mailError}`);
		}
	}
	return { deliveries, invited, mailError };
}
