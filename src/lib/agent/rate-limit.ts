/**
 * Limits on the surfaces that call Workers AI (`/api/agent/chat`, chat summaries and mail to-dos in
 * `src/lib/im/ai.ts`). `/mcp` is not one of them: its tools read and write mail without a model, so
 * MCP traffic (initialize, tools/list, every tool call) does not draw on these limits.
 *
 * Two layers, from the 2026-10-19 billing audit (§5 row 1): the per-minute Rate Limiting binding that
 * already existed (now 10/min per key), plus daily caps counted in D1 so a script, a leaked key or a
 * looping client cannot spend the Workers AI budget within a day. The daily counters live in
 * `ai_daily_counters` (migration 0077), one row per (scope, UTC day); scopes are `user:<id>` and
 * `global`. D1 rather than KV so the self-hosted Node runtime, which has no KV, gets the same cap.
 *
 * Limits come from the AGENT_DAILY_LIMIT (per user, default 200) and AGENT_DAILY_GLOBAL_LIMIT
 * (whole install, default 2000) settings; `0` disables a cap. On Workers they are secrets, since the
 * `cf` config keeps no plaintext vars across deploys.
 */

export type AgentLimitReason = "rate" | "user-daily" | "global-daily" | "unavailable";
export type AgentLimitResult =
	| { allowed: true }
	| { allowed: false; reason: AgentLimitReason; retryAfterSeconds: number; limit?: number };

export const DEFAULT_AGENT_DAILY_LIMIT = 200;
export const DEFAULT_AGENT_DAILY_GLOBAL_LIMIT = 2_000;
const GLOBAL_SCOPE = "global";

type LimitEnv = Pick<CloudflareEnv, "DB" | "AGENT_RATE_LIMIT" | "AGENT_DAILY_LIMIT" | "AGENT_DAILY_GLOBAL_LIMIT">;

function parseLimit(raw: string | undefined, fallback: number): number {
	if (raw === undefined || raw.trim() === "") return fallback;
	const value = Number(raw);
	// A typo must not open the cap: anything that is not a non-negative integer keeps the default.
	return Number.isSafeInteger(value) && value >= 0 ? value : fallback;
}

export function agentDailyLimits(env: Pick<CloudflareEnv, "AGENT_DAILY_LIMIT" | "AGENT_DAILY_GLOBAL_LIMIT">) {
	return {
		perUser: parseLimit(env.AGENT_DAILY_LIMIT, DEFAULT_AGENT_DAILY_LIMIT),
		global: parseLimit(env.AGENT_DAILY_GLOBAL_LIMIT, DEFAULT_AGENT_DAILY_GLOBAL_LIMIT),
	};
}

export const utcDay = (now = new Date()) => now.toISOString().slice(0, 10);

export function secondsUntilUtcMidnight(now = new Date()): number {
	const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
	return Math.max(1, Math.ceil((next - now.getTime()) / 1000));
}

/**
 * Adds one call to the (scope, day) counter unless it already reached `limit`, atomically. Returns
 * false, leaving the counter as it was, when the call is over the limit.
 */
export async function countAgentCall(env: Pick<CloudflareEnv, "DB">, scope: string, day: string, limit: number): Promise<boolean> {
	const row = await env.DB
		.prepare("INSERT INTO ai_daily_counters (scope, day, count) VALUES (?, ?, 1) ON CONFLICT (scope, day) DO UPDATE SET count = count + 1 WHERE count < ? RETURNING count")
		.bind(scope, day, limit)
		.first<{ count: number }>();
	return row !== null;
}

async function uncountAgentCall(env: Pick<CloudflareEnv, "DB">, scope: string, day: string) {
	await env.DB.prepare("UPDATE ai_daily_counters SET count = MAX(count - 1, 0) WHERE scope = ? AND day = ?").bind(scope, day).run();
}

/** True for the error D1 and SQLite give before migration 0077 has created the counters. */
export function isMissingCounterTable(error: unknown): boolean {
	return /no such table:?\s*ai_daily_counters/i.test(error instanceof Error ? `${error.message} ${String(error.cause ?? "")}` : String(error));
}

/**
 * Checks the per-minute limit for `key` (`chat:<user>`, `im-ai:<user>`), then the daily caps for
 * `dailyScope` (normally `user:<id>`, so every surface draws on the same per-user budget) and for the
 * whole install. Only an allowed call is counted: a refused one leaves both counters as they were, so
 * the totals are the calls that went on to the model. Any failure refuses the call: the counter is
 * what keeps a loop from spending the budget, so it must not fail open.
 */
export async function checkAgentLimits(env: LimitEnv, key: string, dailyScope: string = key): Promise<AgentLimitResult> {
	if (env.AGENT_RATE_LIMIT) {
		let success = false;
		try { success = (await env.AGENT_RATE_LIMIT.limit({ key })).success; }
		catch { success = false; }
		if (!success) return { allowed: false, reason: "rate", retryAfterSeconds: 60 };
	}
	const limits = agentDailyLimits(env);
	if (limits.perUser === 0 && limits.global === 0) return { allowed: true };
	const now = new Date();
	const day = utcDay(now);
	const retryAfterSeconds = secondsUntilUtcMidnight(now);
	try {
		if (limits.perUser > 0 && !(await countAgentCall(env, dailyScope, day, limits.perUser))) {
			return { allowed: false, reason: "user-daily", retryAfterSeconds, limit: limits.perUser };
		}
		if (limits.global > 0 && !(await countAgentCall(env, GLOBAL_SCOPE, day, limits.global))) {
			if (limits.perUser > 0) await uncountAgentCall(env, dailyScope, day);
			return { allowed: false, reason: "global-daily", retryAfterSeconds, limit: limits.global };
		}
	} catch (error) {
		if (isMissingCounterTable(error)) console.error("ai_daily_counters is missing; apply migration 0077. Refusing the request");
		else console.error("Could not count assistant usage; refusing the request", error);
		return { allowed: false, reason: "unavailable", retryAfterSeconds: 60 };
	}
	return { allowed: true };
}

/** What to tell the person, in Chinese like the rest of the product; the panel also maps `reason` through i18n. */
export function agentLimitMessage(result: Extract<AgentLimitResult, { allowed: false }>): string {
	switch (result.reason) {
		case "rate": return "请求太频繁，请一分钟后再试";
		case "user-daily": return `今天的 AI 次数已用完${result.limit ? `（每人每天 ${result.limit} 次）` : ""}，请明天再试`;
		case "global-daily": return "今天全公司的 AI 次数已用完，请明天再试";
		case "unavailable": return "AI 功能正在升级，请稍后再试";
	}
}

/** The 429 the API routes return; `Retry-After` is the seconds until the minute or the UTC day rolls over. */
export function agentLimitResponse(result: Extract<AgentLimitResult, { allowed: false }>): Response {
	return Response.json({ error: agentLimitMessage(result), reason: result.reason }, { status: result.reason === "unavailable" ? 503 : 429, headers: { "Retry-After": String(result.retryAfterSeconds) } });
}
