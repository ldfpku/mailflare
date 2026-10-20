import { z } from "zod";
import { getEnv } from "@/lib/cloudflare";
import { getCurrentUser } from "@/lib/auth/cookies";
import { createAgentChatStream } from "@/lib/agent/chat";
import { agentLimitResponse, checkAgentLimits } from "@/lib/agent/rate-limit";
import { readJsonBody } from "@/lib/http/request";
import { hasValidSessionMutationOrigin } from "@/lib/auth/origin";
import { agentProviderErrorMessage } from "@/lib/agent/errors";
import { getRequestTimeZone } from "@/lib/time/utils";

const schema = z.object({ mailboxId: z.string().min(1), conversationId: z.string().nullish(), text: z.string().trim().min(1).max(4_000), timeZone: z.string().max(80).optional(), currentMessageId: z.string().max(100).nullish() });

export async function POST(request: Request) {
	const env = getEnv();
	const user = await getCurrentUser(env, request);
	if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
	if (!hasValidSessionMutationOrigin(request)) return Response.json({ error: "Invalid origin" }, { status: 403 });
	const raw = await readJsonBody(request, 8_000).catch(() => null);
	const parsed = schema.safeParse(raw);
	if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
	// Per-minute limit plus the per-user and global daily caps; checked after validation so a malformed
	// request does not use up the day's budget, and before anything is stored or sent to the model.
	const limit = await checkAgentLimits(env, `chat:${user.id}`, `user:${user.id}`);
	if (!limit.allowed) return agentLimitResponse(limit);
	try {
		const { conversationId, stream } = await createAgentChatStream({ env, user, mailboxId: parsed.data.mailboxId, origin: "chat" }, parsed.data.text, parsed.data.conversationId ?? undefined, request.signal, getRequestTimeZone(request, user.timeZone), parsed.data.currentMessageId ?? undefined);
		return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Conversation-Id": conversationId } });
	} catch (error) {
		return Response.json({ error: agentProviderErrorMessage(error) }, { status: 400 });
	}
}
