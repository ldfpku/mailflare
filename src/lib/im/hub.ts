import { DurableObject } from "cloudflare:workers";
import { setPresence } from "./chat";
import { IM_HEARTBEAT_REQUEST, IM_HEARTBEAT_RESPONSE, type ImSocketAttachment, type ImSocketEvent } from "./hub-utils";

/**
 * One per user: holds every HuLa client the user has open and speaks HuLa's
 * socket protocol. Heartbeats are answered by the runtime's auto-response, so
 * an idle connection lets the object hibernate instead of waking every 10s.
 */
export class ImUserHub extends DurableObject<CloudflareEnv> {
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
			const pair = new WebSocketPair();
			const [client, server] = [pair[0], pair[1]];
			this.ctx.acceptWebSocket(server);
			const attachment: ImSocketAttachment = {
				userId,
				clientId: request.headers.get("X-Mailflare-Im-Client") ?? "",
				connectedAt: Date.now(),
			};
			server.serializeAttachment(attachment);
			await setPresence(this.env, userId, true).catch(() => undefined);
			return new Response(null, { status: 101, webSocket: client });
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
		try {
			if ((JSON.parse(text) as { type?: unknown }).type === "2") socket.send(IM_HEARTBEAT_RESPONSE);
		} catch {
			// Delivery acknowledgements and anything else are ignored until message sync needs them.
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
		if (userId) await setPresence(this.env, userId, false).catch(() => undefined);
	}
}
