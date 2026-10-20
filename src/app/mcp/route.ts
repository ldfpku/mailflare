import { getEnv } from "@/lib/cloudflare";
import { authenticateMcpRequest } from "@/lib/mcp/auth";
import { createMailflareMcpHandler } from "@/lib/mcp/server";
import { agentLimitResponse, checkAgentLimits } from "@/lib/agent/rate-limit";

async function handle(request: Request) {
	const url = new URL(request.url);
	const origin = request.headers.get("Origin");
	if (origin && origin !== url.origin) return new Response("Invalid origin", { status: 403 });
	const env = getEnv();
	if (env.APP_URL && url.host !== new URL(env.APP_URL).host) return new Response("Invalid host", { status: 403 });
	const principal = await authenticateMcpRequest(env, request);
	if (!principal) return new Response("Unauthorized", { status: 401, headers: { "WWW-Authenticate": "Bearer" } });
	// Same per-minute limit and daily caps as the chat assistant; the key's owner is the daily scope,
	// so an automation cannot draw more than the person it belongs to.
	const limit = await checkAgentLimits(env, `mcp:${principal.keyId}`, `user:${principal.user.id}`);
	if (!limit.allowed) return agentLimitResponse(limit);
	const handler = createMailflareMcpHandler(env, principal, url.origin, request.headers.get("Authorization") ?? "");
	try { return await handler.fetch(request); }
	finally { await handler.close(); }
}

export const POST = handle;
export const GET = handle;
export const DELETE = handle;
