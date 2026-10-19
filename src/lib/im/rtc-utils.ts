import type { ImSocketEvent } from "./hub-utils";

/**
 * One-to-one calls in HuLa are peer-to-peer WebRTC. The server only relays the
 * call state and the SDP/ICE signals between the two clients, over the same
 * socket as chat. These are the request types HuLa's `WsRequestMsgType` sends.
 */
export const RTC_REQUEST = {
	CALL: 5,
	CALL_RESPONSE: 6,
	SIGNAL: 14,
} as const;

/** `accepted` values of a call response (HuLa's `CallResponseStatus`) and the event each one becomes. */
const CALL_RESPONSE_EVENTS: Record<number, string> = {
	[-1]: "TIMEOUT",
	0: "CallRejected",
	1: "CallAccepted",
	2: "DROPPED",
	3: "CANCEL",
};

export const RTC_SIGNAL_TYPES = new Set(["offer", "answer", "candidate"]);

/** An SDP offer with many candidates stays well below this; anything larger is not a signal. */
export const RTC_SIGNAL_MAX_LENGTH = 32 * 1024;

export interface RtcSocketRequest {
	type: number;
	data: Record<string, unknown>;
}

/**
 * What one call message becomes: the event for the other party, and
 * optionally one for the sender's other devices (an answered call stops
 * ringing everywhere else).
 */
export interface RtcRelay {
	roomId: string;
	peerUid: string;
	toPeer: ImSocketEvent;
	toOwnOtherDevices?: ImSocketEvent;
}

/** Reads a socket frame as a call message, or null for anything else (heartbeats, acks). */
export function parseRtcSocketRequest(value: unknown): RtcSocketRequest | null {
	if (!value || typeof value !== "object") return null;
	const { type, data } = value as { type?: unknown; data?: unknown };
	const numericType = typeof type === "string" && /^\d+$/.test(type) ? Number(type) : type;
	if (numericType !== RTC_REQUEST.CALL && numericType !== RTC_REQUEST.CALL_RESPONSE && numericType !== RTC_REQUEST.SIGNAL) return null;
	if (!data || typeof data !== "object" || Array.isArray(data)) return null;
	return { type: numericType, data: data as Record<string, unknown> };
}

function idString(value: unknown): string | null {
	if (typeof value === "number" && Number.isSafeInteger(value)) return String(value);
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	return trimmed && trimmed.length <= 64 ? trimmed : null;
}

/**
 * Turns a validated call message from `senderUid` into the events to push.
 * Room membership is checked by the caller; this only shapes the payloads
 * HuLa's call window reads.
 */
export function buildRtcRelay(senderUid: string, request: RtcSocketRequest): RtcRelay | null {
	const { data } = request;
	const roomId = idString(data.roomId);
	if (!roomId) return null;

	if (request.type === RTC_REQUEST.CALL) {
		const peerUid = idString(data.targetUid);
		if (!peerUid || peerUid === senderUid) return null;
		const isVideo = data.isVideo === true;
		return {
			roomId,
			peerUid,
			toPeer: { type: "VideoCallRequest", data: { callerUid: senderUid, targetUid: peerUid, roomId, isVideo } },
		};
	}

	if (request.type === RTC_REQUEST.CALL_RESPONSE) {
		// HuLa names the other party `callerUid` whichever side answers.
		const peerUid = idString(data.callerUid);
		const accepted = Number(data.accepted);
		const event = CALL_RESPONSE_EVENTS[accepted];
		if (!peerUid || peerUid === senderUid || !event) return null;
		const payload = { callerUid: senderUid, targetUid: peerUid, roomId, accepted };
		return {
			roomId,
			peerUid,
			toPeer: { type: event, data: payload },
			// Answering or declining on one device dismisses the incoming call on the others.
			...(accepted === 0 || accepted === 1 ? { toOwnOtherDevices: { type: "CANCEL", data: payload } } : {}),
		};
	}

	const peerUid = idString(data.targetUid);
	const signalType = typeof data.signalType === "string" ? data.signalType : "";
	const signal = typeof data.signal === "string" ? data.signal : "";
	if (!peerUid || peerUid === senderUid || !RTC_SIGNAL_TYPES.has(signalType)) return null;
	if (!signal || signal.length > RTC_SIGNAL_MAX_LENGTH) return null;
	return {
		roomId,
		peerUid,
		toPeer: {
			type: "WEBRTC_SIGNAL",
			data: { callerUid: senderUid, targetUid: peerUid, roomId, signal, signalType, video: data.video === true },
		},
	};
}

/** Cloudflare lists port 53 too, which browsers block; without it ICE does not wait for that timeout. */
export function withoutBlockedTurnPorts(servers: RTCIceServerLike[]): RTCIceServerLike[] {
	return servers
		.map((server) => {
			const urls = (Array.isArray(server.urls) ? server.urls : [server.urls]).filter((url) => typeof url === "string" && !/:53(\?|$)/.test(url));
			return { ...server, urls };
		})
		.filter((server) => server.urls.length > 0);
}

export interface RTCIceServerLike {
	urls: string | string[];
	username?: string;
	credential?: string;
}

/** Used when no TURN key is configured: calls still connect on networks where STUN suffices. */
export const RTC_FALLBACK_ICE_SERVERS: RTCIceServerLike[] = [{ urls: ["stun:stun.cloudflare.com:3478"] }];
