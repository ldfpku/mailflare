import { recordAuthActivity } from "@/lib/auth/activity";
import { hasValidSessionMutationOrigin } from "@/lib/auth/origin";
import { getUserFromSession } from "@/lib/auth/session";
import { getSessionTokenFromRequest } from "@/lib/realtime/utils";
import { IM_CODE, imFail, imOk } from "./response";
import { issueImTokens } from "./tokens";
import { IM_WEB_APP_INDEX, IM_WEB_APP_PATH } from "./web-app-utils";

/**
 * HuLa's web build is published as static assets under `/im/`. The asset layer
 * serves its files; every other path below it is a client-side route, so it
 * gets the app's index page.
 */
export async function serveImWebApp(request: Request, env: CloudflareEnv): Promise<Response> {
	const url = new URL(request.url);
	if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405 });
	if (url.pathname === IM_WEB_APP_PATH) return Response.redirect(new URL(`${IM_WEB_APP_PATH}/${url.search}`, url), 302);
	const index = await env.ASSETS.fetch(new URL(IM_WEB_APP_INDEX, url));
	if (!index.ok) return new Response("网页版尚未部署", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
	const response = new Response(request.method === "HEAD" ? null : index.body, index);
	response.headers.set("Cache-Control", "no-cache");
	return response;
}

/**
 * The web client signs in with the mail web session it shares an origin with,
 * so someone already signed in to mail opens chat without a password. The
 * cookie is only honoured on same-origin requests.
 */
export async function issueWebSessionTokens(request: Request, env: CloudflareEnv): Promise<Response> {
	if (!hasValidSessionMutationOrigin(request)) return imFail(IM_CODE.FORBIDDEN, "Invalid origin");
	const user = await getUserFromSession(env, getSessionTokenFromRequest(request));
	if (!user || user.disabled || user.deletedAt) return imFail(IM_CODE.UNAUTHORIZED, "请重新登录");
	const tokens = await issueImTokens(env, user.id);
	await recordAuthActivity(env, { action: "auth.login", userId: user.id, request });
	return imOk({ ...tokens, uid: user.id, client: "" });
}
