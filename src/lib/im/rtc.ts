import { IM_ROOM_TYPE } from "./chat-utils";
import {
	RTC_FALLBACK_ICE_SERVERS,
	buildRtcRelay,
	parseRtcSocketRequest,
	withoutBlockedTurnPorts,
	type RTCIceServerLike,
	type RtcRelay,
} from "./rtc-utils";

/** Long enough for any call; HuLa fetches new credentials for every call window. */
const TURN_CREDENTIAL_TTL_SECONDS = 4 * 60 * 60;

/**
 * Resolves a socket frame into the events to relay, or null when it is not a
 * call message or the two users do not share the one-to-one room it names.
 * Calls are only placed from a private chat, so the room check is also what
 * stops a client from ringing someone it has no conversation with.
 */
export async function resolveRtcRelay(env: CloudflareEnv, senderUid: string, frame: unknown): Promise<RtcRelay | null> {
	const request = parseRtcSocketRequest(frame);
	if (!request) return null;
	const relay = buildRtcRelay(senderUid, request);
	if (!relay) return null;
	return (await sharePrivateRoom(env, relay.roomId, senderUid, relay.peerUid)) ? relay : null;
}

async function sharePrivateRoom(env: CloudflareEnv, roomId: string, a: string, b: string): Promise<boolean> {
	const row = await env.DB
		.prepare(
			`SELECT COUNT(*) AS members FROM im_room_members m JOIN im_rooms r ON r.id = m.room_id
			WHERE m.room_id = ? AND r.type = ? AND m.user_id IN (?, ?)`,
		)
		.bind(roomId, IM_ROOM_TYPE.SINGLE, a, b)
		.first<{ members: number }>();
	return Number(row?.members) === 2;
}

/**
 * Short-lived Cloudflare Realtime TURN credentials, minted per request from the
 * TURN key so the key itself never reaches a client. Without a key the client
 * gets Cloudflare's public STUN server only.
 */
export async function generateIceServers(env: CloudflareEnv): Promise<RTCIceServerLike[]> {
	const keyId = env.REALTIME_TURN_KEY_ID?.trim();
	const token = env.REALTIME_TURN_KEY_API_TOKEN?.trim();
	if (!keyId || !token) return RTC_FALLBACK_ICE_SERVERS;
	const response = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(keyId)}/credentials/generate-ice-servers`, {
		method: "POST",
		headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
		body: JSON.stringify({ ttl: TURN_CREDENTIAL_TTL_SECONDS }),
	});
	if (!response.ok) {
		console.warn(`Cloudflare TURN credentials failed (${response.status})`);
		return RTC_FALLBACK_ICE_SERVERS;
	}
	const body = (await response.json().catch(() => null)) as { iceServers?: RTCIceServerLike[] } | null;
	const servers = Array.isArray(body?.iceServers) ? withoutBlockedTurnPorts(body.iceServers) : [];
	return servers.length ? servers : RTC_FALLBACK_ICE_SERVERS;
}
