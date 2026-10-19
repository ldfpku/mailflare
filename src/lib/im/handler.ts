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
import { defaultAvatarResponse, defaultGroupAvatarSvg, defaultPersonAvatarSvg } from "./default-avatar-utils";
import { IM_CODE, IM_MFA_REQUIRED_MESSAGE, imFail, imOk } from "./response";
import { issueImTokens, resolveImAccessToken, resolveImSocketToken, revokeImPair, rotateImRefreshToken, type ImUser } from "./tokens";
import { IM_WS_TICKET_TTL_MS, formatImWsTicket } from "./ws-ticket-utils";
import { IM_USER_STATES, toImUserInfo } from "./users-utils";
import { findImRoute, imApiPath, type ImRouteTable } from "./handler-utils";
import {
	createGroup,
	deleteMessageFile,
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
	sendMessageWithToken,
	setAdmins,
	updateMemberFlags,
	updateRoomInfo,
	type ImDelivery,
} from "./chat";
import { IM_ALL_STAFF_ROOM_ID, IM_ROOM_TYPE, ImChatError, parseImMessageId } from "./chat-utils";
import {
	abortImMultipartUpload,
	completeImMultipartUpload,
	createImUpload,
	deleteUnsentImFiles,
	listUnsentImFiles,
	preflightImFile,
	receiveImUpload,
	serveImFile,
	startImMultipartUpload,
} from "./files";
import { countUnreadMail, createMailSsoLink, redeemMailSsoLink } from "./mail";
import { serveMailShare } from "./mail-share";
import { disableRoomMailbox, enableRoomMailbox, getRoomMailbox } from "./room-mailbox";
import { searchImAndMail } from "./search";
import { parseImSearchParams } from "./search-utils";
import { listDriveForPicker, listRoomFiles, removeRoomFile, saveRoomFileToDrive, sendDriveFileToRoom } from "./room-files";
import { notifyImUsers } from "./notify";
import { rtcRoutes } from "./meeting-routes";
import { draftMailTodo, summarizeRoom } from "./ai";
import { createTodo, deleteTodo, listTodos, updateTodo } from "./todos";
import { issueWebSessionTokens } from "./web-app";

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
	// The web client at /im trades the mail web session cookie for chat tokens (see web-app.ts).
	"POST web/session": ({ request, env }) => issueWebSessionTokens(request, env),
	"GET system/anyTenant/config/init": initConfig,
	// A one-time ticket for opening the chat socket, so the access token stays out of the socket URL (see ws-ticket-utils.ts).
	"POST ws/ticket": wsTicket,
	"GET avatar/:uid": avatar,
	"GET room-avatar/:id": ({ request }, params) => defaultAvatarResponse(request, defaultGroupAvatarSvg(params.id), `room-${params.id}`),
	// Chat files: the upload URL carries a single-use token and the download URL an unguessable id (see files.ts).
	"PUT files/:id/:name": ({ request, env, url }, params) => receiveImUpload(env, request, params.id, url.searchParams.get("token")),
	// Files over one part go up piece by piece: start (`&uploads`), PUT each part, then finish or abort with `&uploadId`.
	"POST files/:id/:name": ({ request, env, url }, params) =>
		url.searchParams.has("uploads")
			? startImMultipartUpload(env, request, params.id, url.searchParams.get("token"))
			: completeImMultipartUpload(env, request, params.id, url.searchParams.get("token")),
	"DELETE files/:id/:name": ({ request, env, url }, params) => abortImMultipartUpload(env, request, params.id, url.searchParams.get("token")),
	"GET files/:id/:name": ({ request, env }, params) => serveImFile(env, request, params.id),
	"HEAD files/:id/:name": ({ request, env }, params) => serveImFile(env, request, params.id),
	"OPTIONS files/:id/:name": ({ request }) => preflightImFile(request),
	"GET mail/sso/:code": ({ request, env }, params) => redeemMailSsoLink(env, request, params.code),
	// A mail shared into a chat: the page checks the web session cookie and room membership itself (see mail-share.ts).
	"GET mail/share/:id": ({ request, env, origin }, params) => serveMailShare(env, request, params.id, null, origin),
	"GET mail/share/:id/attachments/:attachmentId": ({ request, env, origin }, params) =>
		serveMailShare(env, request, params.id, params.attachmentId, origin),
};

const userRoutes: ImRouteTable<ImContext> = {
	"POST oauth/check": () => imOk(true),
	"POST oauth/anyUser/logout": logout,
	// HuLa's MinIO upload path: a presigned PUT URL plus the URL to send in the message.
	"GET system/anyTenant/storage/provider": () => imOk({ provider: "minio" }),
	"GET system/anyTenant/ossToken": async ({ env, user, url, origin }) => imOk(await createImUpload(env, user.id, url.searchParams.get("fileName"), origin)),
	// Mail: a one-time sign-in link for the web app window, and the inbox unread count for the mail button.
	"GET im/mail/sso": async ({ env, user, url, origin }) => imOk(await createMailSsoLink(env, user.id, origin, url.searchParams.get("next"))),
	"GET im/mail/unread": async ({ env, user }) => imOk({ count: await countUnreadMail(env, user.id) }),
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

	// Deleting a sent file, and the caller's own uploads that never made it into a message (see files.ts).
	"POST im/chat/msg/file/delete": async ({ request, env, user, origin }) => {
		const { event, recipients } = await deleteMessageFile(env, user, await readBody(request), origin);
		await notifyImUsers(env, recipients, { type: "msgFileDeleted", data: event });
		return imOk(event.message ?? true);
	},
	"GET im/chat/files/unsent": async ({ env, user }) => imOk(await listUnsentImFiles(env, user.id)),
	"POST im/chat/files/unsent/delete": async ({ request, env, user }) => imOk(await deleteUnsentImFiles(env, user.id, (await readBody(request)).ids)),
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
	"GET im/room/group/detail": async ({ env, user, url, origin }) => imOk(await groupDetail(env, user.id, url.searchParams.get("id"), origin)),
	"GET im/room/group/info": async ({ env, user, url, origin }) => imOk(await groupDetail(env, user.id, url.searchParams.get("id"), origin)),
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
	"GET im/room/mailbox": async ({ env, user, url }) => imOk(await getRoomMailbox(env, user.id, url.searchParams.get("roomId"))),
	"POST im/room/mailbox": async ({ request, env, user, origin }) => imOk(await enableRoomMailbox(env, user.id, await readBody(request), origin)),
	"POST im/room/mailbox/disable": async ({ request, env, user }) => imOk(await disableRoomMailbox(env, user.id, (await readBody(request)).roomId)),
	// One search box over chat and mail; each side is paged on its own.
	"GET im/search": async ({ env, user, url, origin }) => {
		const params = parseImSearchParams(url.searchParams);
		if (!params) return imFail(IM_CODE.BAD_REQUEST, "请输入搜索内容");
		return imOk(await searchImAndMail(env, user, params, origin));
	},
	// Group files, the group's folder in Drive (see room-files.ts), and the Drive picker for sending a Drive file.
	"GET im/room/files": async ({ env, user, url, origin }) =>
		imOk(
			await listRoomFiles(
				env,
				user.id,
				{
					roomId: url.searchParams.get("roomId"),
					cursor: url.searchParams.get("cursor"),
					pageSize: url.searchParams.get("pageSize"),
					keyword: url.searchParams.get("keyword"),
				},
				origin,
			),
		),
	"POST im/room/files/remove": async ({ request, env, user }) => {
		await removeRoomFile(env, user.id, await readBody(request));
		return imOk(true);
	},
	"POST im/room/files/saveToDrive": async ({ request, env, user }) => imOk(await saveRoomFileToDrive(env, user.id, await readBody(request))),
	"POST im/room/files/fromDrive": async ({ request, env, user, origin }) => {
		const delivery = await sendDriveFileToRoom(env, user.id, await readBody(request), origin);
		await deliver(env, delivery);
		return imOk(delivery.message);
	},
	"GET im/drive/items": async ({ env, user, url }) => imOk(await listDriveForPicker(env, user.id, url.searchParams.get("parentId"))),
	// Workers AI: a summary only the caller sees (nothing is stored or posted), and a to-do drafted from a mail.
	"POST im/ai/summary": async ({ request, env, user }) => imOk(await summarizeRoom(env, user, await readBody(request))),
	"POST im/ai/mailTodo": async ({ request, env, user }) => imOk(await draftMailTodo(env, user, await readBody(request))),
	// "我的待办" (see todos.ts).
	"GET im/todo/list": async ({ env, user, url }) => imOk(await listTodos(env, user.id, url.searchParams.get("status"))),
	"POST im/todo": async ({ request, env, user }) => imOk(await createTodo(env, user, await readBody(request))),
	"POST im/todo/update": async ({ request, env, user }) => imOk(await updateTodo(env, user.id, await readBody(request))),
	"POST im/todo/delete": async ({ request, env, user }) => {
		await deleteTodo(env, user.id, (await readBody(request)).id);
		return imOk(true);
	},
	"GET im/room/announcement/list": ({ url }) => imOk({ records: [], total: "0", size: url.searchParams.get("size") ?? "0" }),
};

/**
 * Public because it accepts what the socket accepts: an expired access token
 * still gets a ticket while its refresh token lives, as it used to open the socket.
 */
async function wsTicket({ request, env }: PublicContext): Promise<Response> {
	const user = await resolveImSocketToken(env, request.headers.get("token"));
	if (!user) return imFail(IM_CODE.UNAUTHORIZED, "请重新登录");
	const response = await env.IM_HUB.getByName(user.id).fetch("https://mailflare-im/ticket", { method: "POST" });
	if (!response.ok) throw new Error(`ws ticket: hub answered ${response.status}`);
	const { secret } = (await response.json()) as { secret: string };
	return imOk({ ticket: formatImWsTicket(user.id, secret), expiresIn: IM_WS_TICKET_TTL_MS / 1000 });
}

const EMPTY_CURSOR_PAGE = { list: [], cursor: "", isLast: true };

export async function handleImRequest(request: Request, env: CloudflareEnv): Promise<Response> {
	const url = new URL(request.url);
	const path = imApiPath(url.pathname);
	if (path === null) return imFail(IM_CODE.NOT_FOUND, "Not found");
	const origin = env.APP_URL?.trim().replace(/\/+$/, "") || url.origin;
	const base = { request, env, url, origin };

	const publicRoute = findImRoute(publicRoutes, request.method, path);
	if (publicRoute) return publicRoute.handler(base, publicRoute.params);

	// Sending is the hot path: the token is checked inside the batch that stores the message (see sendMessageWithToken).
	if (request.method === "POST" && path === "im/chat/msg") return guardImChat(() => send(base));

	const userRoute = findImRoute(userRoutes, request.method, path) ?? findImRoute(rtcRoutes, request.method, path);
	if (!userRoute) return imFail(IM_CODE.NOT_IMPLEMENTED, "暂未实现");

	const auth = await resolveImAccessToken(env, request.headers.get("token"));
	if (auth.status !== "ok") return refuseSignIn(auth.status);
	return guardImChat(() => userRoute.handler({ ...base, user: auth.user, pairId: auth.pairId }, userRoute.params));
}

/** Turns a refusal from the chat modules into HuLa's envelope. */
async function guardImChat(handler: () => Promise<Response> | Response): Promise<Response> {
	try {
		return await handler();
	} catch (error) {
		if (!(error instanceof ImChatError)) throw error;
		const code = error.status === 403 ? IM_CODE.FORBIDDEN : error.status === 404 ? IM_CODE.NOT_FOUND : IM_CODE.BAD_REQUEST;
		return imFail(code, error.message);
	}
}

const refuseSignIn = (auth: "invalid" | "expired") =>
	auth === "expired" ? imFail(IM_CODE.TOKEN_EXPIRED, "token已过期") : imFail(IM_CODE.UNAUTHORIZED, "请重新登录");

async function send({ request, env, origin }: PublicContext): Promise<Response> {
	const token = request.headers.get("token");
	let body: Record<string, unknown>;
	try {
		body = await readBody(request);
	} catch (error) {
		// A body that is not JSON is refused after the sign-in check, as on every other route.
		const auth = await resolveImAccessToken(env, token);
		if (auth.status !== "ok") return refuseSignIn(auth.status);
		throw error;
	}
	const result = await sendMessageWithToken(env, token, body, origin);
	if ("auth" in result) return refuseSignIn(result.auth);
	await deliver(env, result);
	return imOk(result.message);
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
	if (user?.avatarKey && !user.disabled) return getAvatarImageResponse(request, env.BUCKET, user.avatarKey);
	return defaultAvatarResponse(request, defaultPersonAvatarSvg(params.uid), params.uid);
}

async function groupList({ env, user, url, origin }: ImContext): Promise<Response> {
	const groups = await listGroups(env, user.id, origin);
	// The Rust side pages with `current`/`size` and expects `{ records, total, size }`; the web side wants the bare list.
	if (!url.searchParams.has("current")) return imOk(groups);
	const size = Math.min(Math.max(Number(url.searchParams.get("size")) || 20, 1), 200);
	const current = Math.max(Number(url.searchParams.get("current")) || 1, 1);
	return imOk({ records: groups.slice((current - 1) * size, current * size), total: String(groups.length), size: String(size) });
}
