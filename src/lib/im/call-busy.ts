/**
 * Who is in a one-to-one call or a meeting right now (`im_call_busy`), so a
 * new call to them is answered "busy" instead of ringing on top of it. Rows
 * are refreshed while the call or meeting runs and simply expire when a
 * client disappears without saying goodbye.
 *
 * Every function here swallows database errors: a missing table (code
 * deployed before the migration ran) must never stop calls from ringing.
 */

/** HuLa gives up ringing after 30 s; an unanswered call stops counting a little after that. */
export const CALL_RING_TTL_MS = 45_000;
/** Call windows and meeting pages renew every 15 s, so two missed renewals still count as present. */
export const CALL_ALIVE_TTL_MS = 45_000;
/**
 * Meeting pages renew every 15 s too, but a background meeting window may only get its timer once a minute
 * (browser timer throttling), and leaving clears the row explicitly, so a meeting counts for longer.
 */
export const MEETING_ALIVE_TTL_MS = 120_000;

export const callBusyRef = (roomId: string) => `call:${roomId}`;
export const meetingBusyRef = (meetingId: string) => `meeting:${meetingId}`;

/** True when the user is in another call or a meeting; `exceptRef` is the call being placed, which never counts. */
export async function isUserBusy(env: CloudflareEnv, userId: string, exceptRef: string, now = Date.now()): Promise<boolean> {
	try {
		const row = await env.DB
			.prepare("SELECT 1 AS busy FROM im_call_busy WHERE user_id = ? AND ref <> ? AND busy_until > ? LIMIT 1")
			.bind(userId, exceptRef, now)
			.first<{ busy: number }>();
		return Boolean(row);
	} catch (error) {
		console.warn("Call busy check failed", error);
		return false;
	}
}

export async function markUsersBusy(env: CloudflareEnv, userIds: string[], ref: string, ttlMs: number, now = Date.now()): Promise<void> {
	try {
		await env.DB.batch([
			env.DB.prepare("DELETE FROM im_call_busy WHERE busy_until <= ?").bind(now),
			...[...new Set(userIds)].map((userId) =>
				env.DB
					.prepare(
						`INSERT INTO im_call_busy (user_id, ref, busy_until) VALUES (?, ?, ?)
						ON CONFLICT (user_id, ref) DO UPDATE SET busy_until = MAX(busy_until, excluded.busy_until)`,
					)
					.bind(userId, ref, now + ttlMs),
			),
		]);
	} catch (error) {
		console.warn("Call busy update failed", error);
	}
}

export async function clearUsersBusy(env: CloudflareEnv, userIds: string[], ref: string): Promise<void> {
	try {
		await env.DB.batch(
			[...new Set(userIds)].map((userId) => env.DB.prepare("DELETE FROM im_call_busy WHERE user_id = ? AND ref = ?").bind(userId, ref)),
		);
	} catch (error) {
		console.warn("Call busy update failed", error);
	}
}
