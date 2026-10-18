import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { recordAuthActivity } from "@/lib/auth/activity";
import { verifySecondFactor } from "@/lib/auth/mfa";
import { verifyPassword } from "@/lib/auth/password";
import { allowDeviceLoginAttempt } from "@/lib/auth/rate-limit";
import { getAvatarImageResponse } from "@/lib/avatar-images";
import { RequestBodyTooLargeError } from "@/lib/http/errors";
import { readJsonBody } from "@/lib/http/request";
import { IM_CODE, IM_MFA_REQUIRED_MESSAGE, imFail, imOk } from "./response";
import { issueImTokens, resolveImAccessToken, revokeImPair, rotateImRefreshToken, type ImUser } from "./tokens";
import { IM_USER_STATES, toImUserInfo } from "./users-utils";
import { findImRoute, imApiPath, type ImRouteTable } from "./handler-utils";
import {
	createGroup,
	exitGroup,
	getPeople,
	getSession,
	groupDetail,
	inviteMembers,
	listDirectory,
	listGroups,
	listMembers,
	listSessions,
	listSyncMessages,
	markRead,
	openSingleRoom,
	pageMessages,
	readCounts,
	recallMessage,
	removeMembers,
	sendMessage,
	setAdmins,
	updateMemberFlags,
	updateRoomInfo,
	type ImDelivery,
} from "./chat";
import { IM_ALL_STAFF_ROOM_ID, IM_ROOM_TYPE, ImChatError, parseImMessageId } from "./chat-utils";
import { notifyImUsers } from "./notify";

/**
 * The HuLa-compatible API under `/api/im/*`. HuLa's client was written for
 * HuLa-Server, so paths, verbs and the `{ success, code, msg, data }` envelope
 * follow that server; the Next route in `src/app/api/im/[...path]` only
 * delegates here. Endpoints not implemented yet answer code 501.
 */
export interface ImContext {
	request: Request;
	env: CloudflareEnv;
	url: URL;
	origin: string;
	/** Set on routes that require a signed-in user. */
	user: ImUser;
	pairId: string | null;
}

type PublicContext = Omit<ImContext, "user" | "pairId">;

const LOGIN_BODY_LIMIT = 16 * 1024;

const publicRoutes: ImRouteTable<PublicContext> = {
	"POST oauth/anyTenant/login": login,
	"POST oauth/anyTenant/refresh": refresh,
	"GET system/anyTenant/config/init": initConfig,
	"GET avatar/:uid": avatar,
};

const userRoutes: ImRouteTable<ImContext> = {
	"POST oauth/check": () => imOk(true),
	"POST oauth/anyUser/logout": logout,
	"GET im/user/userInfo": ({ user, origin }) => imOk(toImUserInfo(user, origin)),
	"GET im/user/state/list": () => imOk(IM_USER_STATES),
	"GET im/user/emoji/list": () => imOk([]),
	"GET im/user/badges": () => imOk([]),
	"POST im/user/badges/batch": () => imOk([]),
	"GET im/room/notice/unread": () => imOk({ unReadCount4Friend: 0, unReadCount4Group: 0 }),
	// HuLa-Server kept a status per user; presence here comes from open connections, so the choice is accepted and dropped.
	"POST im/user/state/changeState": () => imOk(true),
	// Contacts come from the organisation directory and there are no friend requests.
	"GET im/user/friend/page": async ({ env, user }) => imOk({ list: await listDirectory(env, user.id), cursor: "", isLast: true }),
	"GET im/room/notice/page": () => imOk(EMPTY_CURSOR_PAGE),
	"POST im/user/getUserByIds": async ({ request, env, origin }) => imOk(await getPeople(env, (await readBody(request)).uidList, origin)),

	"GET im/chat/contact/list": async ({ env, user, origin }) => imOk(await listSessions(env, user.id, origin)),
	"GET im/chat/contact/detail": async ({ env, user, url, origin }) => imOk(await getSession(env, user.id, url.searchParams.get("id"), origin)),
	"GET im/chat/contact/detail/friend": contactDetailWithFriend,
	"POST im/chat/setTop": async ({ request, env, user }) => {
		const body = await readBody(request);
		await updateMemberFlags(env, user.id, body.roomId, { top: Boolean(body.top) });
		return imOk(true);
	},
	"POST im/chat/setHide": async ({ request, env, user }) => {
		const body = await readBody(request);
		await updateMemberFlags(env, user.id, body.roomId, { hide: Boolean(body.hide) });
		return imOk(true);
	},
	"DELETE im/chat/delete": async ({ request, env, user }) => {
		await updateMemberFlags(env, user.id, (await readBody(request)).roomId, { hide: true });
		return imOk(true);
	},
	"POST im/chat/notification": async ({ request, env, user }) => {
		const body = await readBody(request);
		const type = Number(body.type);
		if (![0, 1].includes(type)) return imFail(IM_CODE.BAD_REQUEST, "通知设置无效");
		await updateMemberFlags(env, user.id, body.roomId, { muteNotification: type });
		return imOk(true);
	},
	"POST im/chat/setShield": async ({ request, env, user }) => {
		const body = await readBody(request);
		await updateMemberFlags(env, user.id, body.roomId, { shield: Boolean(body.state) });
		return imOk(true);
	},

	"POST im/chat/msg": async ({ request, env, user, origin }) => {
		const delivery = await sendMessage(env, user.id, await readBody(request), origin);
		await deliver(env, delivery);
		return imOk(delivery.message);
	},
	"POST im/chat/msg/list": async ({ env, user, origin }) => imOk(await listSyncMessages(env, user.id, origin)),
	"GET im/chat/msg/page": async ({ env, user, url, origin }) =>
		imOk(
			await pageMessages(
				env,
				user.id,
				url.searchParams.get("roomId"),
				url.searchParams.get("cursor"),
				Number(url.searchParams.get("pageSize")),
				origin,
			),
		),
	"PUT im/chat/msg/read": async ({ request, env, user }) => {
		await markRead(env, user.id, (await readBody(request)).roomId);
		return imOk(true);
	},
	"GET im/chat/msg/read": async ({ env, user, url }) => {
		const ids = url.searchParams
			.getAll("msgIds")
			.concat(url.searchParams.getAll("msgIds[]"))
			.flatMap((value) => value.split(","))
			.map(parseImMessageId)
			.filter((id): id is number => id !== null);
		return imOk(await readCounts(env, user.id, [...new Set(ids)].slice(0, 200)));
	},
	"PUT im/chat/msg/recall": async ({ request, env, user }) => {
		const { event, recipients } = await recallMessage(env, user.id, await readBody(request));
		await notifyImUsers(env, recipients, { type: "msgRecall", data: event });
		return imOk(true);
	},

	"GET im/room/group/list": groupList,
	"GET im/room/group/listMember": async ({ env, user, url, origin }) => imOk(await listMembers(env, user.id, url.searchParams.get("roomId"), origin)),
	"GET im/room/group/detail": async ({ env, user, url }) => imOk(await groupDetail(env, user.id, url.searchParams.get("id"))),
	"GET im/room/group/info": async ({ env, user, url }) => imOk(await groupDetail(env, user.id, url.searchParams.get("id"))),
	"POST im/room/group": async ({ request, env, user, origin }) => {
		const { roomId, delivery } = await createGroup(env, user.id, (await readBody(request)).uidList, origin);
		await deliver(env, delivery);
		return imOk({ id: roomId, roomId });
	},
	"POST im/room/group/member": async ({ request, env, user, origin }) => {
		await deliver(env, await inviteMembers(env, user.id, await readBody(request), origin));
		return imOk(true);
	},
	"DELETE im/room/group/member": async ({ request, env, user, origin }) => {
		await deliver(env, await removeMembers(env, user.id, await readBody(request), origin));
		return imOk(true);
	},
	"DELETE im/room/group/member/exit": async ({ request, env, user, origin }) => {
		await deliver(env, await exitGroup(env, user.id, (await readBody(request)).roomId, origin));
		return imOk(true);
	},
	"PUT im/room/group/admin": async ({ request, env, user }) => {
		await setAdmins(env, user.id, await readBody(request), true);
		return imOk(true);
	},
	"DELETE im/room/group/admin": async ({ request, env, user }) => {
		await setAdmins(env, user.id, await readBody(request), false);
		return imOk(true);
	},
	"POST im/room/updateRoomInfo": async ({ request, env, user, origin }) => {
		await deliver(env, await updateRoomInfo(env, user.id, await readBody(request), origin));
		return imOk(true);
	},
	"POST im/room/updateMyRoomInfo": async ({ request, env, user }) => {
		const body = await readBody(request);
		const myName = typeof body.myName === "string" ? body.myName.trim().slice(0, 30) : undefined;
		const remark = typeof body.remark === "string" ? body.remark.trim().slice(0, 30) : undefined;
		await updateMemberFlags(env, user.id, body.id, { myName, remark });
		return imOk(true);
	},
	// Announcements are not stored yet; an empty page keeps the group panel quiet.
	"GET im/room/announcement/list": ({ url }) => imOk({ records: [], total: "0", size: url.searchParams.get("size") ?? "0" }),
};

const EMPTY_CURSOR_PAGE = { list: [], cursor: "", isLast: true };

export async function handleImRequest(request: Request, env: CloudflareEnv): Promise<Response> {
	const url = new URL(request.url);
	const path = imApiPath(url.pathname);
	if (path === null) return imFail(IM_CODE.NOT_FOUND, "Not found");
	const origin = env.APP_URL?.trim().replace(/\/+$/, "") || url.origin;
	const base = { request, env, url, origin };

	const publicRoute = findImRoute(publicRoutes, request.method, path);
	if (publicRoute) return publicRoute.handler(base, publicRoute.params);

	const userRoute = findImRoute(userRoutes, request.method, path);
	if (!userRoute) return imFail(IM_CODE.NOT_IMPLEMENTED, "暂未实现");

	const auth = await resolveImAccessToken(env, request.headers.get("token"));
	if (auth.status === "invalid") return imFail(IM_CODE.UNAUTHORIZED, "请重新登录");
	if (auth.status === "expired") return imFail(IM_CODE.TOKEN_EXPIRED, "token已过期");
	try {
		return await userRoute.handler({ ...base, user: auth.user, pairId: auth.pairId }, userRoute.params);
	} catch (error) {
		if (!(error instanceof ImChatError)) throw error;
		const code = error.status === 403 ? IM_CODE.FORBIDDEN : error.status === 404 ? IM_CODE.NOT_FOUND : IM_CODE.BAD_REQUEST;
		return imFail(code, error.message);
	}
}

const BODY_LIMIT = 64 * 1024;

async function readBody(request: Request): Promise<Record<string, unknown>> {
	try {
		const body = await readJsonBody<unknown>(request, BODY_LIMIT);
		return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
	} catch (error) {
		throw new ImChatError(400, error instanceof RequestBodyTooLargeError ? "请求过大" : "请求格式错误");
	}
}

/** Pushes a stored message to its recipients' open clients as HuLa's `receiveMessage`. */
async function deliver(env: CloudflareEnv, delivery: ImDelivery | null): Promise<void> {
	if (delivery) await notifyImUsers(env, delivery.recipients, { type: "receiveMessage", data: delivery.message });
}

/**
 * Opening a chat from a contact: `roomType` 2 names a person, whose one-to-one
 * room is created on first use; 1 names a group the caller is already in.
 */
async function contactDetailWithFriend({ env, user, url, origin }: ImContext): Promise<Response> {
	const id = url.searchParams.get("id");
	const roomType = Number(url.searchParams.get("roomType") ?? IM_ROOM_TYPE.SINGLE);
	const roomId = roomType === IM_ROOM_TYPE.GROUP ? id : await openSingleRoom(env, user.id, id);
	return imOk(await getSession(env, user.id, roomId, origin));
}

async function login({ request, env }: PublicContext): Promise<Response> {
	let body: { account?: unknown; password?: unknown; code?: unknown };
	try {
		body = await readJsonBody(request, LOGIN_BODY_LIMIT);
	} catch (error) {
		return imFail(IM_CODE.BAD_REQUEST, error instanceof RequestBodyTooLargeError ? "请求过大" : "请求格式错误");
	}
	const account = typeof body.account === "string" ? body.account.trim().toLowerCase() : "";
	const password = typeof body.password === "string" ? body.password : "";
	const code = typeof body.code === "string" ? body.code.trim() : "";
	if (!account || !password) return imFail(IM_CODE.BAD_REQUEST, "请输入账号和密码");
	if (!(await allowDeviceLoginAttempt(env, request))) return imFail(IM_CODE.TOO_MANY_REQUESTS, "登录尝试过多，请稍后再试");

	const [user] = await getDb(env).select().from(users).where(eq(users.email, account)).limit(1);
	if (!user || !verifyPassword(password, user.passwordHash)) return imFail(IM_CODE.BAD_REQUEST, "账号或密码错误");
	if (user.disabled || user.deletedAt) return imFail(IM_CODE.FORBIDDEN, "账号已停用");
	if (user.totpEnabled && user.totpSecret) {
		// HuLa sends the authenticator code in the same request once it has asked for it.
		if (!code) return imFail(IM_CODE.MFA_REQUIRED, IM_MFA_REQUIRED_MESSAGE);
		if (!(await verifySecondFactor(env, user, code))) return imFail(IM_CODE.BAD_REQUEST, "验证码不正确");
	}

	const tokens = await issueImTokens(env, user.id);
	await recordAuthActivity(env, { action: "auth.login", userId: user.id, request });
	return imOk({ ...tokens, uid: user.id, client: "" });
}

async function refresh({ request, env }: PublicContext): Promise<Response> {
	let body: { refreshToken?: unknown };
	try {
		body = await readJsonBody(request, LOGIN_BODY_LIMIT);
	} catch {
		return imFail(IM_CODE.BAD_REQUEST, "请求格式错误");
	}
	const tokens = await rotateImRefreshToken(env, typeof body.refreshToken === "string" ? body.refreshToken : null);
	return tokens ? imOk(tokens) : imFail(IM_CODE.UNAUTHORIZED, "请重新登录");
}

async function logout({ env, pairId }: ImContext): Promise<Response> {
	if (pairId) await revokeImPair(env, pairId);
	return imOk(true);
}

function initConfig(): Response {
	// HuLa reads upload settings from `qiNiu`; uploads go to object storage through presigned URLs instead.
	return imOk({ logo: "", name: "SMJ", qiNiu: { ossDomain: "", fragmentSize: "", turnSharSize: "" }, roomGroupId: IM_ALL_STAFF_ROOM_ID });
}

async function avatar({ request, env }: PublicContext, params: Record<string, string>): Promise<Response> {
	const [user] = await getDb(env)
		.select({ avatarKey: users.avatarKey, disabled: users.disabled })
		.from(users)
		.where(eq(users.id, params.uid))
		.limit(1);
	if (!user?.avatarKey || user.disabled) return new Response("Not found", { status: 404 });
	return getAvatarImageResponse(request, env.BUCKET, user.avatarKey);
}

async function groupList({ env, user, url }: ImContext): Promise<Response> {
	const groups = await listGroups(env, user.id);
	// The Rust side pages with `current`/`size` and expects `{ records, total, size }`; the web side wants the bare list.
	if (!url.searchParams.has("current")) return imOk(groups);
	const size = Math.min(Math.max(Number(url.searchParams.get("size")) || 20, 1), 200);
	const current = Math.max(Number(url.searchParams.get("current")) || 1, 1);
	return imOk({ records: groups.slice((current - 1) * size, current * size), total: String(groups.length), size: String(size) });
}
