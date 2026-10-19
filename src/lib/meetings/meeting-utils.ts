/** Meeting links are `/meet/<id>`; the id is the only secret in them, so it is long and random. */
export const MEETING_ID_PATTERN = /^[a-z2-7]{16}$/;
export const MEETING_TITLE_LIMIT = 100;
export const MEETING_INVITEE_LIMIT = 50;
export const MEETING_DEFAULT_DURATION = 60;
export const MEETING_MAX_DURATION = 12 * 60;
export const MEETING_DEFAULT_TIME_ZONE = "Asia/Shanghai";

const BASE32 = "abcdefghijklmnopqrstuvwxyz234567";

export function newMeetingId(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	return Array.from(bytes, (byte) => BASE32[byte & 31]).join("");
}

export function meetingUrl(origin: string, id: string): string {
	return `${origin}/meet/${id}`;
}

export class MeetingError extends Error {
	constructor(
		readonly status: 400 | 403 | 404 | 503,
		message: string,
	) {
		super(message);
	}
}

export interface MeetingCreateInput {
	title: string;
	roomId: string | null;
	/** Epoch ms; null starts now. */
	startsAt: number | null;
	durationMinutes: number;
	inviteeIds: string[];
	sendMail: boolean;
}

/** Validates what HuLa (or the web) sends to create a meeting. */
export function parseMeetingCreateInput(body: Record<string, unknown>, now = Date.now()): MeetingCreateInput {
	const title = typeof body.title === "string" ? body.title.trim().slice(0, MEETING_TITLE_LIMIT) : "";
	const roomId = typeof body.roomId === "string" && body.roomId.trim() ? body.roomId.trim().slice(0, 64) : null;

	let startsAt: number | null = null;
	if (body.startAt !== undefined && body.startAt !== null && body.startAt !== "") {
		const parsed = typeof body.startAt === "number" ? body.startAt : Date.parse(String(body.startAt));
		if (!Number.isFinite(parsed)) throw new MeetingError(400, "会议时间无效");
		// A time a few minutes in the past is "now" from a slow form; much earlier is a mistake.
		if (parsed < now - 10 * 60_000) throw new MeetingError(400, "会议时间不能早于现在");
		startsAt = parsed;
	}

	const duration = Number(body.durationMinutes ?? MEETING_DEFAULT_DURATION);
	if (!Number.isFinite(duration) || duration < 5 || duration > MEETING_MAX_DURATION) throw new MeetingError(400, "会议时长应在 5 分钟到 12 小时之间");

	const rawInvitees = Array.isArray(body.inviteUids) ? body.inviteUids : [];
	const inviteeIds = [...new Set(rawInvitees.filter((id): id is string => typeof id === "string" && id.length > 0 && id.length <= 64))];
	if (inviteeIds.length > MEETING_INVITEE_LIMIT) throw new MeetingError(400, `一次最多邀请 ${MEETING_INVITEE_LIMIT} 人`);

	return { title, roomId, startsAt, durationMinutes: Math.round(duration), inviteeIds, sendMail: body.sendMail !== false };
}

export function formatMeetingTime(startsAt: number, durationMinutes: number, timeZone: string | null | undefined): string {
	const zone = timeZone || MEETING_DEFAULT_TIME_ZONE;
	const options: Intl.DateTimeFormatOptions = { timeZone: zone, year: "numeric", month: "long", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false };
	let start: string;
	let end: string;
	try {
		start = new Intl.DateTimeFormat("zh-CN", options).format(startsAt);
		end = new Intl.DateTimeFormat("zh-CN", { timeZone: zone, hour: "2-digit", minute: "2-digit", hour12: false }).format(startsAt + durationMinutes * 60_000);
	} catch {
		return formatMeetingTime(startsAt, durationMinutes, MEETING_DEFAULT_TIME_ZONE);
	}
	return `${start} - ${end}`;
}

function escapeHtml(value: string): string {
	return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export interface InvitationContent {
	title: string;
	hostName: string;
	time: string;
	joinUrl: string;
}

export function invitationSubject(content: InvitationContent): string {
	return `会议邀请：${content.title}（${content.time}）`;
}

export function invitationText(content: InvitationContent): string {
	return [
		`${content.hostName} 邀请你参加视频会议。`,
		"",
		`主题：${content.title}`,
		`时间：${content.time}`,
		`加入会议：${content.joinUrl}`,
		"",
		"附件中的日历邀请可直接加入你的日历；在 SMJ 客户端或浏览器中打开链接即可入会。",
	].join("\n");
}

/** Inline styles only: mail clients drop style sheets. SMJ Blue for the button, Well Navy for text. */
export function invitationHtml(content: InvitationContent): string {
	const title = escapeHtml(content.title);
	const url = escapeHtml(content.joinUrl);
	return `<div style="font-family:'Noto Sans SC',Arial,sans-serif;color:#1a2b4a;font-size:14px;line-height:1.6">
<p>${escapeHtml(content.hostName)} 邀请你参加视频会议。</p>
<table style="border-collapse:collapse;margin:12px 0">
<tr><td style="padding:4px 16px 4px 0;color:#5b6b85">主题</td><td style="padding:4px 0;font-weight:600">${title}</td></tr>
<tr><td style="padding:4px 16px 4px 0;color:#5b6b85">时间</td><td style="padding:4px 0">${escapeHtml(content.time)}</td></tr>
</table>
<p style="margin:20px 0"><a href="${url}" style="display:inline-block;background:#034fbc;color:#ffffff;text-decoration:none;padding:10px 24px;border-radius:6px;font-weight:600">加入会议</a></p>
<p style="color:#5b6b85;font-size:12px">会议链接：<a href="${url}" style="color:#034fbc">${url}</a><br>附件中的日历邀请可直接加入你的日历。</p>
</div>`;
}

/** The chat line posted to the group a meeting was started from. */
export function meetingChatText(content: InvitationContent & { scheduled: boolean }): string {
	return content.scheduled
		? `预约了视频会议「${content.title}」\n时间：${content.time}\n加入会议：${content.joinUrl}`
		: `发起了视频会议「${content.title}」\n加入会议：${content.joinUrl}`;
}

/** The chat line someone in a meeting sends to a person they add; HuLa turns the link into a card. */
export function meetingInviteText(content: InvitationContent): string {
	return `邀请你加入视频会议「${content.title}」\n加入会议：${content.joinUrl}`;
}
