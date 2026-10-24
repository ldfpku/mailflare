import { DurableObject } from "cloudflare:workers";
import { setPresence } from "./chat";
import { IM_HEARTBEAT_REQUEST, IM_HEARTBEAT_RESPONSE, type ImSocketAttachment, type ImSocketEvent } from "./hub-utils";
import { notifyImUsers } from "./notify";
import { resolveRtcRelay } from "./rtc";
import { randomHex, sha256Hex } from "./files-utils";
import { IM_WS_TICKET_STORAGE_PREFIX, IM_WS_TICKET_TTL_MS, staleImWsTickets } from "./ws-ticket-utils";

/**
 * One per user: holds every HuLa client the user has open and speaks HuLa's
 * socket protocol. Heartbeats are answered by the runtime's auto-response, so
 * an idle connection lets the object hibernate instead of waking every 10s.
 */
export class ImUserHub extends DurableObject<CloudflareEnv> {
	/** The last online write, so an offline write cannot land before it. */
	private presenceWrite: Promise<unknown> = Promise.resolve();

	constructor(ctx: DurableObjectState, env: CloudflareEnv) {
		super(ctx, env);
		ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(IM_HEARTBEAT_REQUEST, IM_HEARTBEAT_RESPONSE));
	}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === "/connect") {
			if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
				return new Response("Expected WebSocket upgrade", { status: 426 });
			}
			const userId = request.headers.get("X-Mailflare-Im-User");
			if (!userId) return new Response("Unauthorized", { status: 401 });
			// The Worker has already checked a legacy token; anything else must bring a ticket this hub issued.
			if (request.headers.get("X-Mailflare-Im-Auth") !== "token" && !(await this.redeemTicket(request.headers.get("X-Mailflare-Im-Ticket")))) {
				return new Response("Unauthorized", { status: 401 });
			}
			const pair = new WebSocketPair();
			const [client, server] = [pair[0], pair[1]];
			this.ctx.acceptWebSocket(server);
			const attachment: ImSocketAttachment = {
				userId,
				clientId: request.headers.get("X-Mailflare-Im-Client") ?? "",
				connectedAt: Date.now(),
			};
			server.serializeAttachment(attachment);
			// The upgrade answers at once; the presence write must not hold up the client's handshake.
			this.presenceWrite = setPresence(this.env, userId, true).catch(() => undefined);
			this.ctx.waitUntil(this.presenceWrite);
			return new Response(null, { status: 101, webSocket: client });
		}

		if (url.pathname === "/ticket" && request.method === "POST") {
			return Response.json({ secret: await this.issueTicket() });
		}

		if (url.pathname === "/notify" && request.method === "POST") {
			const message = JSON.stringify((await request.json()) as ImSocketEvent);
			for (const socket of this.ctx.getWebSockets()) {
				try {
					socket.send(message);
				} catch {
					socket.close(1011, "Delivery failed");
				}
			}
			return new Response(null, { status: 204 });
		}

		if (url.pathname === "/disconnect" && request.method === "POST") {
			for (const socket of this.ctx.getWebSockets()) socket.close(4001, "Signed out");
			return new Response(null, { status: 204 });
		}

		return new Response("Not found", { status: 404 });
	}

	async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer): Promise<void> {
		// A heartbeat that missed the auto-response (different spacing, binary frame) still gets its pong.
		const text = typeof message === "string" ? message : new TextDecoder().decode(message);
		let frame: unknown;
		try {
			frame = JSON.parse(text);
		} catch {
			return;
		}
		if ((frame as { type?: unknown } | null)?.type === "2") {
			socket.send(IM_HEARTBEAT_RESPONSE);
			return;
		}
		// Call setup and WebRTC signals are relayed to the other party; delivery acknowledgements and anything else are ignored.
		const userId = (socket.deserializeAttachment() as ImSocketAttachment | null)?.userId;
		if (!userId) return;
		const relay = await resolveRtcRelay(this.env, userId, frame).catch(() => null);
		if (!relay) return;
		if (relay.toSender) {
			try {
				socket.send(JSON.stringify(relay.toSender));
			} catch {}
		}
		if (relay.toPeer) await notifyImUsers(this.env, [relay.peerUid], relay.toPeer);
		if (relay.toOwnOtherDevices) this.sendToOthers(socket, relay.toOwnOtherDevices);
	}

	/** Ticket secrets are stored hashed with their expiry; issuing one also clears out stale ones. */
	private async issueTicket(): Promise<string> {
		const secret = randomHex(24);
		const now = Date.now();
		const stored = await this.ctx.storage.list<number>({ prefix: IM_WS_TICKET_STORAGE_PREFIX });
		const stale = staleImWsTickets([...stored.entries()], now);
		if (stale.length) await this.ctx.storage.delete(stale);
		await this.ctx.storage.put(`${IM_WS_TICKET_STORAGE_PREFIX}${await sha256Hex(secret)}`, now + IM_WS_TICKET_TTL_MS);
		return secret;
	}

	/** True once per issued secret, within its lifetime. Storage calls hold the input gate, so two upgrades cannot both read the same ticket. */
	private async redeemTicket(secret: string | null): Promise<boolean> {
		if (!secret) return false;
		const key = `${IM_WS_TICKET_STORAGE_PREFIX}${await sha256Hex(secret)}`;
		const expiresAt = await this.ctx.storage.get<number>(key);
		if (expiresAt === undefined) return false;
		await this.ctx.storage.delete(key);
		return expiresAt > Date.now();
	}

	private sendToOthers(origin: WebSocket, event: ImSocketEvent): void {
		const body = JSON.stringify(event);
		for (const socket of this.ctx.getWebSockets()) {
			if (socket === origin) continue;
			try {
				socket.send(body);
			} catch {
				// A socket that is closing is cleaned up by webSocketClose.
			}
		}
	}

	async webSocketClose(socket: WebSocket, code: number, reason: string): Promise<void> {
		try {
			socket.close(code, reason);
		} catch {
			// Already closed.
		}
		await this.markOfflineIfLast(socket);
	}

	async webSocketError(socket: WebSocket): Promise<void> {
		await this.markOfflineIfLast(socket);
	}

	/** Presence is per user: offline once the last of their clients has gone. */
	private async markOfflineIfLast(closing: WebSocket): Promise<void> {
		const open = this.ctx.getWebSockets().filter((socket) => socket !== closing && socket.readyState === WebSocket.OPEN);
		if (open.length) return;
		const userId = (closing.deserializeAttachment() as ImSocketAttachment | null)?.userId;
		await this.presenceWrite;
		if (userId) await setPresence(this.env, userId, false).catch(() => undefined);
	}
}
