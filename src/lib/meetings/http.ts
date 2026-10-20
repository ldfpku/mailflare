import { hasValidSessionMutationOrigin } from "@/lib/auth/origin";
import { getUserFromSession } from "@/lib/auth/session";
import { CALL_ALIVE_TTL_MS, clearUsersBusy, markUsersBusy, meetingBusyRef } from "@/lib/im/call-busy";
import { notifyImUsers } from "@/lib/im/notify";
import { getSessionTokenFromRequest } from "@/lib/realtime/utils";
import { MEETING_ID_PATTERN, MeetingError } from "./meeting-utils";
import { MEETING_PAGE_HEADERS, renderMeetingPage } from "./page";
import { getRealtimeKitConfig, RealtimeKitNotConfiguredError } from "./realtimekit";
import { getMeetingIcs, getMeetingUser, getMeetingUserByToken, inviteToMeeting, joinMeeting, listMeetingPeople, type MeetingUser } from "./service";

/**
 * The browser side of meetings, served from `worker.ts` without Next so the
 * page can carry its own CSP and Permissions-Policy (the app's defaults turn
 * camera and microphone off):
 *
 * - `GET /meet/<id>`: the meeting page, the link in invitations and chats.
 * - `POST /api/meetings/<id>/join`: a participant token for the signed-in web user.
 * - `GET /api/meetings/<id>/meeting.ics`: the calendar file; the id is the only key, as for the link itself.
 * - `GET /api/meetings/<id>/people`, `POST /api/meetings/<id>/invite`: “添加参会人” on the meeting page. The
 *   desktop meeting window has no web session, so these also accept the page's participant token as a bearer.
 * - `POST /api/meetings/<id>/presence`: the page renews this while you are in the meeting (`{ active: false }` on
 *   leaving), so one-to-one calls to you answer "busy" instead of ringing. Same authentication as above.
 */
export function isMeetingPath(pathname: string): boolean {
	return pathname.startsWith("/meet/") || pathname.startsWith("/api/meetings/");
}

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function handleMeetingRequest(request: Request, env: CloudflareEnv): Promise<Response> {
	const url = new URL(request.url);
	const origin = env.APP_URL?.trim().replace(/\/+$/, "") || url.origin;

	const page = /^\/meet\/([a-z2-7]{16})\/?$/.exec(url.pathname);
	if (page) {
		if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405 });
		return new Response(renderMeetingPage(page[1], getRealtimeKitConfig(env)?.hostPreset), { headers: MEETING_PAGE_HEADERS });
	}

	const api = /^\/api\/meetings\/([^/]+)\/(join|meeting\.ics|people|invite|presence)$/.exec(url.pathname);
	if (!api || !MEETING_ID_PATTERN.test(api[1])) return json({ error: "会议不存在" }, 404);
	const [, id, action] = api;

	try {
		if (action === "meeting.ics") {
			if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
			const ics = await getMeetingIcs(env, id, origin);
			return new Response(ics.body, {
				headers: {
					"Content-Type": "text/calendar; charset=UTF-8",
					"Content-Disposition": `attachment; filename="${ics.filename}"`,
					"Cache-Control": "no-store",
				},
			});
		}

		if (action === "presence") {
			if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
			const user = await meetingPageUser(request, env, id);
			if (!user) return json({ error: "请先加入会议" }, 401);
			const body = (await request.json().catch(() => ({}))) as { active?: unknown };
			if (body.active === false) await clearUsersBusy(env, [user.id], meetingBusyRef(id));
			else await markUsersBusy(env, [user.id], meetingBusyRef(id), CALL_ALIVE_TTL_MS);
			return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
		}

		if (action === "people" || action === "invite") {
			if (request.method !== (action === "people" ? "GET" : "POST")) return json({ error: "Method not allowed" }, 405);
			const user = await meetingPageUser(request, env, id);
			if (!user) return json({ error: "请先加入会议" }, 401);
			if (action === "people") return json({ people: await listMeetingPeople(env, id, user) });
			const body = (await request.json().catch(() => ({}))) as { userIds?: unknown; sendMail?: unknown };
			const userIds = Array.isArray(body.userIds) ? body.userIds.filter((value): value is string => typeof value === "string") : [];
			const result = await inviteToMeeting(env, id, user, { userIds, sendMail: body.sendMail === true }, origin);
			for (const delivery of result.deliveries) {
				await notifyImUsers(env, delivery.recipients, { type: "receiveMessage", data: delivery.message });
			}
			return json({ invited: result.deliveries.length, mailed: result.invited, mailError: result.mailError });
		}

		if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
		const user = await getUserFromSession(env, getSessionTokenFromRequest(request));
		if (!user || user.disabled || user.deletedAt) return json({ error: "请先登录" }, 401);
		if (!hasValidSessionMutationOrigin(request)) return json({ error: "Invalid origin" }, 403);
		const joined = await joinMeeting(
			env,
			id,
			{ id: user.id, name: user.name || user.email, email: user.email, avatarKey: user.avatarKey, timeZone: user.timeZone },
			origin,
		);
		return json({ authToken: joined.authToken, host: joined.host, meeting: joined.meeting });
	} catch (error) {
		if (error instanceof MeetingError) return json({ error: error.message }, error.status);
		if (error instanceof RealtimeKitNotConfiguredError) return json({ error: error.message }, 503);
		console.error("Meeting request failed", error);
		return json({ error: "会议服务暂时不可用" }, 502);
	}
}

/** The participant token in `Authorization: Bearer`, else the web session (whose POSTs must come from our own pages). */
async function meetingPageUser(request: Request, env: CloudflareEnv, id: string): Promise<MeetingUser | null> {
	const bearer = /^Bearer\s+(.+)$/i.exec(request.headers.get("Authorization") ?? "")?.[1]?.trim();
	if (bearer) return getMeetingUserByToken(env, id, bearer);
	const user = await getUserFromSession(env, getSessionTokenFromRequest(request));
	if (!user || user.disabled || user.deletedAt) return null;
	if (request.method !== "GET" && !hasValidSessionMutationOrigin(request)) return null;
	return getMeetingUser(env, user.id);
}
