/**
 * One-time tickets for opening the chat socket. Browsers cannot set headers on
 * a WebSocket, so whatever authenticates it ends up in the URL, and from there
 * in proxy and CDN logs. A ticket is only good for one upgrade within a minute,
 * so a logged URL is worthless, unlike the two-hour access token it replaces.
 *
 * `<userId>.<secret>`: the user id picks the user's ImUserHub, which holds the
 * secret's hash and deletes it on first use. A forged user id lands in a hub
 * that never issued the secret.
 */
export const IM_WS_TICKET_TTL_MS = 60 * 1000;
/** How many unused tickets a hub keeps; a client that keeps asking without connecting loses the oldest. */
export const IM_WS_TICKET_LIMIT = 20;
export const IM_WS_TICKET_STORAGE_PREFIX = "ws-ticket:";
/**
 * Clients released before tickets still send `Token=<access token>`. Accepted
 * for one release so un-updated desktop apps stay connected; remove afterwards.
 */
export const IM_WS_ACCEPT_LEGACY_TOKEN = true;

const SECRET = /^[a-f0-9]{48}$/;
const USER_ID = /^[A-Za-z0-9_-]{1,64}$/;

export function formatImWsTicket(userId: string, secret: string): string {
	return `${userId}.${secret}`;
}

export function parseImWsTicket(ticket: string | null | undefined): { userId: string; secret: string } | null {
	if (!ticket) return null;
	const dot = ticket.lastIndexOf(".");
	if (dot <= 0) return null;
	const userId = ticket.slice(0, dot);
	const secret = ticket.slice(dot + 1);
	return USER_ID.test(userId) && SECRET.test(secret) ? { userId, secret } : null;
}

/** Stored tickets past their expiry, plus the oldest ones beyond the limit, so a hub's storage stays small. */
export function staleImWsTickets(entries: Array<[string, number]>, now: number, limit = IM_WS_TICKET_LIMIT): string[] {
	const live = entries.filter(([, expiresAt]) => expiresAt > now).sort((a, b) => b[1] - a[1]);
	const keep = new Set(live.slice(0, limit).map(([key]) => key));
	return entries.filter(([key]) => !keep.has(key)).map(([key]) => key);
}
