import { RequestBodyTooLargeError } from "@/lib/http/errors";
import { readJsonBody } from "@/lib/http/request";
import { getAvailability } from "@/lib/meetings/availability";
import { parseAvailabilityInput } from "@/lib/meetings/availability-utils";
import { MeetingError, parseMeetingCreateInput } from "@/lib/meetings/meeting-utils";
import { RealtimeKitNotConfiguredError } from "@/lib/meetings/realtimekit";
import {
	cancelMeeting,
	createMeeting,
	getMeeting,
	getMeetingIcs,
	getMeetingStatuses,
	joinMeeting,
	listMeetings,
	meetingAudience,
	type MeetingUser,
} from "@/lib/meetings/service";
import type { ImContext } from "./handler";
import type { ImRouteHandler, ImRouteTable } from "./handler-utils";
import { notifyImUsers } from "./notify";
import { IM_CODE, imFail, imOk } from "./response";
import { generateIceServers } from "./rtc";

/**
 * Calls and meetings for HuLa: ICE servers for one-to-one calls (the call
 * signalling itself rides the socket, see `hub.ts`), and RealtimeKit meetings.
 */
function meetingUser(context: ImContext): MeetingUser {
	const { user } = context;
	return { id: user.id, name: user.name || user.email, email: user.email, avatarKey: user.avatarKey, timeZone: user.timeZone };
}

function guarded(handler: ImRouteHandler<ImContext>): ImRouteHandler<ImContext> {
	return async (context, params) => {
		try {
			return await handler(context, params);
		} catch (error) {
			if (error instanceof RealtimeKitNotConfiguredError) return imFail(IM_CODE.NOT_IMPLEMENTED, error.message);
			if (error instanceof RequestBodyTooLargeError) return imFail(IM_CODE.BAD_REQUEST, "请求过大");
			if (error instanceof MeetingError) {
				const code = error.status === 403 ? IM_CODE.FORBIDDEN : error.status === 404 || error.status === 410 ? IM_CODE.NOT_FOUND : IM_CODE.BAD_REQUEST;
				return imFail(code, error.message);
			}
			throw error;
		}
	};
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
	const body = await readJsonBody<unknown>(request, 16 * 1024).catch((error) => {
		if (error instanceof RequestBodyTooLargeError) throw error;
		throw new MeetingError(400, "请求格式错误");
	});
	return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
}

/** HuLa's Rust client maps each API to one fixed path, so meeting ids travel in the query or the body. */
export const rtcRoutes: ImRouteTable<ImContext> = {
	"GET im/rtc/iceServers": async ({ env }) => imOk({ iceServers: await generateIceServers(env) }),

	"GET im/meeting/list": guarded(async ({ env, user, origin }) => imOk(await listMeetings(env, user.id, origin))),
	"POST im/meeting": guarded(async (context) => {
		const { request, env, origin } = context;
		const created = await createMeeting(env, meetingUser(context), parseMeetingCreateInput(await readBody(request)), origin);
		if (created.delivery) await notifyImUsers(env, created.delivery.recipients, { type: "receiveMessage", data: created.delivery.message });
		return imOk({ ...created.meeting, invited: created.invited, mailError: created.mailError, message: created.delivery?.message ?? null });
	}),
	"GET im/meeting/detail": guarded(async ({ env, origin, url }) => imOk(await getMeeting(env, url.searchParams.get("id") ?? "", origin))),
	"POST im/meeting/join": guarded(async (context) => {
		const id = (await readBody(context.request)).id;
		const joined = await joinMeeting(context.env, typeof id === "string" ? id : "", meetingUser(context), context.origin);
		return imOk({ authToken: joined.authToken, host: joined.host, ...joined.meeting });
	}),
	/** `ids` is a comma-separated list (at most 50): the chat cards on screen, labelled 待开始 / 进行中 / 已结束 / 已取消. */
	"GET im/meeting/status": guarded(async ({ env, url }) => {
		const ids = (url.searchParams.get("ids") ?? "").split(",").map((id) => id.trim());
		return imOk({ serverNow: Date.now(), meetings: await getMeetingStatuses(env, ids) });
	}),
	"POST im/meeting/cancel": guarded(async (context) => {
		const body = await readBody(context.request);
		const id = typeof body.id === "string" ? body.id : "";
		const result = await cancelMeeting(context.env, id, meetingUser(context), context.origin);
		// Every chat holding the card turns it to “已取消” at once, the host's other devices included.
		const [status] = await getMeetingStatuses(context.env, [id]);
		if (status) await notifyImUsers(context.env, await meetingAudience(context.env, id), { type: "meetingStatus", data: status });
		return imOk(result);
	}),
	/** The scheduling assistant: invitees' busy times and the earliest slots everyone has free. */
	"POST im/meeting/availability": guarded(async (context) => {
		const input = parseAvailabilityInput(await readBody(context.request));
		return imOk(await getAvailability(context.env, meetingUser(context), input, context.origin));
	}),
	"GET im/meeting/ics": guarded(async ({ env, origin, url }) => imOk(await getMeetingIcs(env, url.searchParams.get("id") ?? "", origin))),
};
