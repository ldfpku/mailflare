import { withStorage } from "./src/lib/storage";
import vinextHandler from "vinext/server/fetch-handler";
import {
	processInboundMessage,
	storeRawToR2,
	type InboundQueueMessage,
} from "./src/lib/email/inbound";
import { processOutboundQueue, type OutboundQueueMessage } from "./src/lib/email/send";
import { isInboundQueueMessage, isWebhookRetryMessage } from "./worker-utils";
import { processWebhookRetry, type WebhookRetryMessage } from "./src/lib/email/webhooks";
import { resolveIncomingMail, forwardMessage } from "./src/lib/email/incoming";
import { getUserFromSession } from "./src/lib/auth/session";
import { resolveImSocketToken } from "./src/lib/im/tokens";
import { IM_WS_ACCEPT_LEGACY_TOKEN, parseImWsTicket } from "./src/lib/im/ws-ticket-utils";
import { handleMeetingRequest, isMeetingPath } from "./src/lib/meetings/http";
import { handleImRequest } from "./src/lib/im/handler";
import { IM_MAIL_SHARE_PATH } from "./src/lib/im/mail-share-utils";
import { serveImWebApp } from "./src/lib/im/web-app";
import { isImWebAppPath } from "./src/lib/im/web-app-utils";
import { getSessionTokenFromRequest } from "./src/lib/realtime/utils";
import { inboundAttachmentLimitReasonFromRaw } from "./src/lib/email/inbound-attachments";
import { hasValidSessionMutationOrigin } from "./src/lib/auth/origin";
import {
	getAccountForwardingDestination,
	MAILFLARE_FORWARDED_HEADER,
} from "./src/lib/email/account-forwarding";
import { runScheduledDatabaseBackup } from "./src/lib/backups/runner";
import { processAgentDraftJob } from "./src/lib/agent/jobs/utils";
import { runAgentMaintenance } from "./src/lib/agent/maintenance";
import { runTrashRetention } from "./src/lib/email/trash-retention";
import { runDriveTrashRetention } from "./src/lib/drive/retention";
import { runAccountRetention } from "./src/lib/accounts/deletion";
import { runJmapChangeRetention } from "./src/lib/jmap/changes";
import { runFollowUpReminders } from "./src/lib/follow-ups/service";
export { RealtimeHub } from "./src/lib/realtime/hub";
export { ImUserHub } from "./src/lib/im/hub";

export default {
	async fetch(request: Request, rawEnv: CloudflareEnv, ctx: ExecutionContext) {
		const env = withStorage(rawEnv);
		const url = new URL(request.url);
		if (url.pathname === "/api/realtime") {
			if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
				return new Response("Expected WebSocket upgrade", { status: 426 });
			}
			if (!hasValidSessionMutationOrigin(request)) {
				return new Response("Invalid origin", { status: 403 });
			}

			const user = await getUserFromSession(env, getSessionTokenFromRequest(request));
			if (!user || user.disabled) {
				return new Response("Unauthorized", { status: 401 });
			}

			const hub = env.REALTIME.getByName(user.id);
			const hubRequest = new Request("https://mailflare-realtime/connect", request);
			hubRequest.headers.set("X-Mailflare-Realtime-User", user.id);
			return hub.fetch(hubRequest);
		}

		if (url.pathname === "/api/im/ws") {
			// HuLa's client socket. It authenticates with a one-time ticket from /api/im/ws/ticket, which the
			// user's hub checks and burns; desktop apps released before tickets still send their access token.
			if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
				return new Response("Expected WebSocket upgrade", { status: 426 });
			}
			const startedAt = Date.now();
			const ticket = parseImWsTicket(url.searchParams.get("ticket"));
			let userId = ticket?.userId;
			if (!ticket) {
				const legacyToken = url.searchParams.get("Token");
				const user = IM_WS_ACCEPT_LEGACY_TOKEN && legacyToken ? await resolveImSocketToken(env, legacyToken) : null;
				if (!user) return new Response("Unauthorized", { status: 401 });
				userId = user.id;
				console.warn("[im/ws] legacy token in socket URL");
			}
			if (!userId) return new Response("Unauthorized", { status: 401 });
			const authMs = Date.now() - startedAt;

			const hubRequest = new Request("https://mailflare-im/connect", request);
			hubRequest.headers.set("X-Mailflare-Im-User", userId);
			hubRequest.headers.set("X-Mailflare-Im-Client", url.searchParams.get("clientId")?.slice(0, 200) ?? "");
			// Always set both, so a client cannot supply either header itself.
			hubRequest.headers.set("X-Mailflare-Im-Auth", ticket ? "ticket" : "token");
			hubRequest.headers.set("X-Mailflare-Im-Ticket", ticket?.secret ?? "");
			const response = await env.IM_HUB.getByName(userId).fetch(hubRequest);
			// Clients give up on a handshake after 15s; a slow one should show in the Worker logs.
			const totalMs = Date.now() - startedAt;
			if (totalMs > 2000) console.warn(`[im/ws] slow upgrade: auth ${authMs}ms, hub ${totalMs - authMs}ms, status ${response.status}`);
			return response;
		}

		// Meeting pages set their own CSP and Permissions-Policy (camera, microphone), which the Next headers forbid.
		if (isMeetingPath(url.pathname)) return handleMeetingRequest(request, env);
		// Mail shared into a chat is sender-controlled HTML: its page must keep its own sandboxed CSP, not the app's.
		if (url.pathname.startsWith(IM_MAIL_SHARE_PATH)) return handleImRequest(request, env);
		// HuLa's web build: its files are static assets, any other path below /im is a client-side route.
		if (isImWebAppPath(url.pathname)) return serveImWebApp(request, env);

		return vinextHandler.fetch(request, env, ctx);
	},

	async email(message: ForwardableEmailMessage, rawEnv: CloudflareEnv, ctx: ExecutionContext) {
		const env = withStorage(rawEnv);
		try {
			if (message.rawSize > 25 * 1024 * 1024) {
				message.setReject("Message rejected: raw email exceeds the 25 MiB receiving limit. Send a download link instead.");
				return;
			}
			// Domain routing rules are resolved here rather than in the queue because reject and
			// forward can only be actioned on the live ForwardableEmailMessage.
			const decision = await resolveIncomingMail(env, message.from, message.to);

			if (decision?.action === "reject") {
				message.setReject(decision.rejectReason ?? "Message rejected by routing rule");
				return;
			}
			const raw = await new Response(message.raw).arrayBuffer();
			const attachmentLimitReason = await inboundAttachmentLimitReasonFromRaw(raw);
			if (attachmentLimitReason) {
				message.setReject(attachmentLimitReason);
				return;
			}

			if (decision?.action === "forward" && decision.forwardTo) {
				const forwarded = await forwardMessage(message, decision.forwardTo);
				// A forward rule drops the message unless it was explicitly asked to keep a copy.
				// If the forward itself failed we still store it, so mail is never silently lost.
				if (forwarded && !decision.keepCopy) return;
			}

			if (message.headers.get(MAILFLARE_FORWARDED_HEADER) !== "1") {
				const forwardingDestination = await getAccountForwardingDestination(env, message.to);
				if (forwardingDestination) {
					await forwardMessage(message, forwardingDestination);
				}
			}
			const rawR2Key = await storeRawToR2(env, message.from, message.to, raw);
			const payload: InboundQueueMessage = {
				from: message.from,
				to: message.to,
				rawR2Key,
				headers: Object.fromEntries(message.headers),
			};
			await env.INBOUND_QUEUE.send(payload);
		} catch (err) {
			console.error("Inbound enqueue failed", err);
			message.setReject("Processing failed");
		}
	},

	async queue(batch: MessageBatch, rawEnv: CloudflareEnv): Promise<void> {
		const env = withStorage(rawEnv);
		for (const msg of batch.messages) {
			try {
				if (isInboundQueueMessage(msg.body)) {
					await processInboundMessage(env, msg.body);
				} else if (typeof msg.body === "object" && msg.body !== null && (msg.body as { kind?: unknown }).kind === "agent.draft" && typeof (msg.body as { jobId?: unknown }).jobId === "string") {
					await processAgentDraftJob(env, (msg.body as { jobId: string }).jobId);
				} else if (isWebhookRetryMessage(msg.body)) {
					await processWebhookRetry(env, msg.body as WebhookRetryMessage);
				} else if (typeof msg.body === "object" && msg.body !== null && (msg.body as { kind?: unknown }).kind === "email.scheduled") {
					await processOutboundQueue(env, msg.body as OutboundQueueMessage);
				} else {
					throw new Error("Unknown queue message type");
				}
				msg.ack();
			} catch (err) {
				console.error("Queue processing failed", {
					rawR2Key: isInboundQueueMessage(msg.body) ? msg.body.rawR2Key : undefined,
					recipient: isInboundQueueMessage(msg.body) ? msg.body.to : undefined,
					attempts: msg.attempts,
					error: err,
				});
				msg.retry({ delaySeconds: 10 });
			}
		}
	},

	async scheduled(controller: ScheduledController, rawEnv: CloudflareEnv, ctx: ExecutionContext) {
		const env = withStorage(rawEnv);
		if (controller.cron === "0 2 * * *") ctx.waitUntil(runScheduledDatabaseBackup(env, new Date(controller.scheduledTime)));
		ctx.waitUntil(runAgentMaintenance(env));
		ctx.waitUntil(runTrashRetention(env, new Date(controller.scheduledTime)));
		ctx.waitUntil(runFollowUpReminders(env, new Date(controller.scheduledTime)));
		if (controller.cron === "0 2 * * *") ctx.waitUntil(runAccountRetention(env, new Date(controller.scheduledTime)));
		// Drive trash is emptied once a day, with the 02:00 UTC cron; the 5-minute cron is for queue-like upkeep.
		if (controller.cron === "0 2 * * *") ctx.waitUntil(runDriveTrashRetention(env, new Date(controller.scheduledTime)));
		if (controller.cron === "0 2 * * *") ctx.waitUntil(runJmapChangeRetention(env, new Date(controller.scheduledTime)));
	},
} satisfies ExportedHandler<CloudflareEnv>;
