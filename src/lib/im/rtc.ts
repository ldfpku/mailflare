import { CALL_ALIVE_TTL_MS, CALL_RING_TTL_MS, callBusyRef, clearUsersBusy, isUserBusy, markUsersBusy } from "./call-busy";
import { IM_ROOM_TYPE } from "./chat-utils";
import {
	RTC_FALLBACK_ICE_SERVERS,
	RTC_REQUEST,
	buildRtcRelay,
	callBusyEvent,
	parseCallAlive,
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
 *
 * It also keeps `im_call_busy`: ringing and answering mark both people busy,
 * the end of a call clears them, and a call to someone busy in another call or
 * a meeting rings nobody and answers the caller "busy".
 */
export async function resolveRtcRelay(env: CloudflareEnv, senderUid: string, frame: unknown): Promise<RtcRelay | null> {
	const request = parseRtcSocketRequest(frame);
	if (!request) return null;

	const alive = parseCallAlive(senderUid, request);
	if (alive) {
		if (await sharePrivateRoom(env, alive.roomId, senderUid, alive.peerUid)) {
			await markUsersBusy(env, [senderUid], callBusyRef(alive.roomId), CALL_ALIVE_TTL_MS);
		}
		return null;
	}

	const relay = buildRtcRelay(senderUid, request);
	if (!relay) return null;
	if (!(await sharePrivateRoom(env, relay.roomId, senderUid, relay.peerUid))) return null;

	const ref = callBusyRef(relay.roomId);
	const people = [senderUid, relay.peerUid];
	if (request.type === RTC_REQUEST.CALL) {
		if (await isUserBusy(env, relay.peerUid, ref)) {
			return { roomId: relay.roomId, peerUid: relay.peerUid, toSender: callBusyEvent(senderUid, relay.peerUid, relay.roomId) };
		}
		await markUsersBusy(env, people, ref, CALL_RING_TTL_MS);
	} else if (request.type === RTC_REQUEST.CALL_RESPONSE) {
		if (Number(request.data.accepted) === 1) await markUsersBusy(env, people, ref, CALL_ALIVE_TTL_MS);
		else await clearUsersBusy(env, people, ref);
	}
	return relay;
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
	}).catch(() => null);
	if (!response?.ok) {
		console.warn(`Cloudflare TURN credentials failed (${response?.status ?? "network"})`);
		return RTC_FALLBACK_ICE_SERVERS;
	}
	const body = (await response.json().catch(() => null)) as { iceServers?: RTCIceServerLike[] } | null;
	const servers = Array.isArray(body?.iceServers) ? withoutBlockedTurnPorts(body.iceServers) : [];
	return servers.length ? servers : RTC_FALLBACK_ICE_SERVERS;
}
