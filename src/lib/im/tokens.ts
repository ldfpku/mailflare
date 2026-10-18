import { and, eq, gt, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { sessions, users } from "@/db/schema";
import { hashSessionToken } from "@/lib/auth/session";
import { newId } from "@/lib/ids";
import {
	IM_ACCESS_TOKEN_PREFIX,
	IM_ACCESS_TTL_MS,
	IM_REFRESH_TOKEN_PREFIX,
	IM_REFRESH_TTL_MS,
	imPairSessionIds,
	parseImPairId,
} from "./tokens-utils";

/**
 * HuLa clients hold an access token (sent in the `token` header) and a
 * refresh token. Both are rows in `sessions`, so `deleteUserSessions` (password
 * change, reset, MFA change) signs the apps out too. The two rows of a pair
 * share an id stem, which lets sign-out and refresh find the partner.
 */
export type ImUser = typeof users.$inferSelect;

export interface ImTokenPair {
	token: string;
	refreshToken: string;
	/** Access token expiry, epoch milliseconds as a string (HuLa's `expire`). */
	expire: string;
}

export type ImAccessResult =
	| { status: "ok"; user: ImUser; pairId: string | null }
	| { status: "expired"; user: ImUser; pairId: string | null }
	| { status: "invalid" };

export async function issueImTokens(env: CloudflareEnv, userId: string): Promise<ImTokenPair> {
	const pairId = newId();
	const ids = imPairSessionIds(pairId);
	const token = newId(IM_ACCESS_TOKEN_PREFIX);
	const refreshToken = newId(IM_REFRESH_TOKEN_PREFIX);
	const now = Date.now();
	const accessExpiresAt = new Date(now + IM_ACCESS_TTL_MS);
	const db = getDb(env);
	await db.insert(sessions).values([
		{ id: ids.access, userId, tokenHash: await hashSessionToken(token), expiresAt: accessExpiresAt },
		{ id: ids.refresh, userId, tokenHash: await hashSessionToken(refreshToken), expiresAt: new Date(now + IM_REFRESH_TTL_MS) },
	]);
	await db.update(users).set({ lastSignInAt: new Date(now) }).where(eq(users.id, userId));
	return { token, refreshToken, expire: String(accessExpiresAt.getTime()) };
}

/**
 * Resolves the `token` header. An expired token is told apart from an unknown
 * one because HuLa refreshes on 406 but signs out on 401. Refresh tokens are
 * never accepted here.
 */
export async function resolveImAccessToken(env: CloudflareEnv, token: string | null | undefined): Promise<ImAccessResult> {
	if (!token || token.startsWith(`${IM_REFRESH_TOKEN_PREFIX}_`)) return { status: "invalid" };
	const db = getDb(env);
	const [session] = await db
		.select()
		.from(sessions)
		.where(eq(sessions.tokenHash, await hashSessionToken(token)))
		.limit(1);
	if (!session) return { status: "invalid" };
	const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
	if (!user || user.disabled || user.deletedAt) return { status: "invalid" };
	const pairId = parseImPairId(session.id);
	return session.expiresAt.getTime() > Date.now() ? { status: "ok", user, pairId } : { status: "expired", user, pairId };
}

/**
 * The WebSocket keeps the token it was opened with across reconnects, so an
 * expired access token still opens it while its refresh token is alive.
 */
export async function resolveImSocketToken(env: CloudflareEnv, token: string | null | undefined): Promise<ImUser | null> {
	const result = await resolveImAccessToken(env, token);
	if (result.status === "ok") return result.user;
	if (result.status === "invalid" || !result.pairId) return null;
	const [refresh] = await getDb(env)
		.select({ id: sessions.id })
		.from(sessions)
		.where(and(eq(sessions.id, imPairSessionIds(result.pairId).refresh), gt(sessions.expiresAt, new Date())))
		.limit(1);
	return refresh ? result.user : null;
}

/** Trades a live refresh token for a new pair; the old pair stops working. */
export async function rotateImRefreshToken(env: CloudflareEnv, refreshToken: string | null | undefined): Promise<ImTokenPair | null> {
	if (!refreshToken?.startsWith(`${IM_REFRESH_TOKEN_PREFIX}_`)) return null;
	const db = getDb(env);
	const [session] = await db
		.select()
		.from(sessions)
		.where(and(eq(sessions.tokenHash, await hashSessionToken(refreshToken)), gt(sessions.expiresAt, new Date())))
		.limit(1);
	const pairId = session ? parseImPairId(session.id) : null;
	if (!session || !pairId) return null;
	const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
	if (!user || user.disabled || user.deletedAt) return null;
	await revokeImPair(env, pairId);
	return issueImTokens(env, user.id);
}

export async function revokeImPair(env: CloudflareEnv, pairId: string): Promise<void> {
	const ids = imPairSessionIds(pairId);
	await getDb(env).delete(sessions).where(inArray(sessions.id, [ids.access, ids.refresh]));
}
