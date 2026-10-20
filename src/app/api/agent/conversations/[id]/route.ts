import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { agentConversations } from "@/db/schema";
import { getEnv } from "@/lib/cloudflare";
import { getCurrentUser } from "@/lib/auth/cookies";
import { clearAgentConversation, getAgentChatHistory, renameAgentConversation } from "@/lib/agent/chat";
import { hasValidSessionMutationOrigin } from "@/lib/auth/origin";

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.object({ title: z.string().max(120).optional(), clear: z.boolean().optional() }).refine((value) => value.title !== undefined || value.clear, "Nothing to change");

export async function GET(request: Request, { params }: Params) {
	const env = getEnv();
	const user = await getCurrentUser(env, request);
	if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
	const { id } = await params;
	const mailboxId = new URL(request.url).searchParams.get("mailboxId");
	if (!mailboxId) return Response.json({ error: "Mailbox required" }, { status: 400 });
	try { return Response.json({ messages: await getAgentChatHistory({ env, user, mailboxId, origin: "chat" }, id) }); }
	catch { return Response.json({ error: "对话不存在" }, { status: 404 }); }
}

/** Renames a conversation (`title`) or empties it (`clear`), keeping its place in the history. */
export async function PATCH(request: Request, { params }: Params) {
	const env = getEnv();
	const user = await getCurrentUser(env, request);
	if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
	if (!hasValidSessionMutationOrigin(request)) return Response.json({ error: "Invalid origin" }, { status: 403 });
	const { id } = await params;
	const parsed = patchSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) return Response.json({ error: "请求无效" }, { status: 400 });
	try {
		if (parsed.data.clear) await clearAgentConversation(env, user.id, id);
		const conversation = parsed.data.title !== undefined ? await renameAgentConversation(env, user.id, id, parsed.data.title) : null;
		return Response.json({ ok: true, ...(conversation ? { conversation } : {}) });
	} catch (error) {
		return Response.json({ error: error instanceof Error ? error.message : "无法更新对话" }, { status: 404 });
	}
}

export async function DELETE(request: Request, { params }: Params) {
	const env = getEnv();
	const user = await getCurrentUser(env, request);
	if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
	if (!hasValidSessionMutationOrigin(request)) return Response.json({ error: "Invalid origin" }, { status: 403 });
	const { id } = await params;
	await getDb(env).delete(agentConversations).where(and(eq(agentConversations.id, id), eq(agentConversations.userId, user.id)));
	return Response.json({ ok: true });
}
