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
	// Conversations, groups and messages arrive with the chat tables; until then every list is empty.
	"GET im/chat/contact/list": () => imOk([]),
	"POST im/chat/msg/list": () => imOk([]),
	"GET im/room/group/list": groupList,
};

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
	return userRoute.handler({ ...base, user: auth.user, pairId: auth.pairId }, userRoute.params);
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
	return imOk({ logo: "", name: "SMJ", qiNiu: { ossDomain: "", fragmentSize: "", turnSharSize: "" }, roomGroupId: "" });
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

function groupList({ url }: ImContext): Response {
	// The Rust side pages with `current`/`size` and expects `{ records, total, size }`; the web side wants the bare list.
	if (url.searchParams.has("current")) return imOk({ records: [], total: "0", size: url.searchParams.get("size") ?? "0" });
	return imOk([]);
}
