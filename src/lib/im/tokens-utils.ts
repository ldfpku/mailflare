export const IM_ACCESS_TOKEN_PREFIX = "imat";
export const IM_REFRESH_TOKEN_PREFIX = "imrt";
export const IM_ACCESS_TTL_MS = 2 * 60 * 60 * 1000;
export const IM_REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const PAIR_SESSION_PREFIX = "imp_";

/** Session row ids of a HuLa token pair: `imp_<pairId>_a` and `imp_<pairId>_r`. */
export function imPairSessionIds(pairId: string): { access: string; refresh: string } {
	return { access: `${PAIR_SESSION_PREFIX}${pairId}_a`, refresh: `${PAIR_SESSION_PREFIX}${pairId}_r` };
}

/** The pair a session row belongs to, or null for an ordinary web session. */
export function parseImPairId(sessionId: string): string | null {
	if (!sessionId.startsWith(PAIR_SESSION_PREFIX)) return null;
	const match = /^imp_(.+)_[ar]$/.exec(sessionId);
	return match ? match[1] : null;
}
