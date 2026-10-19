/**
 * Limits on the assistant surfaces (`/api/agent/chat`, `/mcp`, chat summaries in `src/lib/im/ai.ts`).
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

export type AgentLimitReason = "rate" | "user-daily" | "global-daily";
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

/** Adds one call to the (scope, day) counter atomically and returns the new total. */
export async function countAgentCall(env: Pick<CloudflareEnv, "DB">, scope: string, day: string): Promise<number> {
	const row = await env.DB
		.prepare("INSERT INTO ai_daily_counters (scope, day, count) VALUES (?, ?, 1) ON CONFLICT (scope, day) DO UPDATE SET count = count + 1 RETURNING count")
		.bind(scope, day)
		.first<{ count: number }>();
	return Number(row?.count ?? 0);
}

/**
 * Checks the per-minute limit for `key` (`chat:<user>`, `mcp:<key>`, `im-ai:<user>`), then the daily
 * caps for `dailyScope` (normally `user:<id>`, so every surface draws on the same per-user budget) and
 * for the whole install. The counters are incremented before the verdict, so a refused call still
 * shows up in them; nothing is spent on the model either way. Any failure refuses the call: the
 * counter is what keeps a loop from spending the budget, so it must not fail open.
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
		if (limits.perUser > 0 && await countAgentCall(env, dailyScope, day) > limits.perUser) {
			return { allowed: false, reason: "user-daily", retryAfterSeconds, limit: limits.perUser };
		}
		if (limits.global > 0 && await countAgentCall(env, GLOBAL_SCOPE, day) > limits.global) {
			return { allowed: false, reason: "global-daily", retryAfterSeconds, limit: limits.global };
		}
	} catch (error) {
		console.error("Could not count assistant usage; refusing the request", error);
		return { allowed: false, reason: "user-daily", retryAfterSeconds: 60 };
	}
	return { allowed: true };
}

export async function allowAgentRequest(env: LimitEnv, key: string, dailyScope: string = key): Promise<boolean> {
	return (await checkAgentLimits(env, key, dailyScope)).allowed;
}

export function agentLimitMessage(result: Extract<AgentLimitResult, { allowed: false }>): string {
	switch (result.reason) {
		case "rate": return "Rate limit exceeded";
		case "user-daily": return `Daily assistant limit reached${result.limit ? ` (${result.limit} requests)` : ""}. Try again tomorrow.`;
		case "global-daily": return "The assistant has used today's budget for everyone. Try again tomorrow.";
	}
}

/** The 429 the API routes return; `Retry-After` is the seconds until the minute or the UTC day rolls over. */
export function agentLimitResponse(result: Extract<AgentLimitResult, { allowed: false }>): Response {
	return Response.json({ error: agentLimitMessage(result), reason: result.reason }, { status: 429, headers: { "Retry-After": String(result.retryAfterSeconds) } });
}
