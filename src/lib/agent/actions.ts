import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { agentChatMessages, agentConversations } from "@/db/schema";
import type { SessionUser } from "@/lib/auth/types";
import { createTodo } from "@/lib/im/todos";
import { createMeeting, getMeetingUser } from "@/lib/meetings/service";
import { runEmailTool } from "./tools";
import type { EmailToolName } from "./types";

const proposalSchema = z.discriminatedUnion("action", [
	z.object({ action: z.literal("move_email"), status: z.literal("pending_approval"), emailIds: z.array(z.string()).length(1), destination: z.enum(["inbox", "archived", "trash", "spam"]) }),
	z.object({ action: z.literal("move_emails"), status: z.literal("pending_approval"), emailIds: z.array(z.string()).min(1).max(20), destination: z.enum(["inbox", "archived", "trash", "spam"]) }),
	z.object({ action: z.literal("mark_email_read"), status: z.literal("pending_approval"), emailId: z.string(), read: z.boolean() }),
	z.object({ action: z.literal("discard_draft"), status: z.literal("pending_approval"), draftId: z.string(), expectedRevision: z.number().int().positive() }),
	z.object({ action: z.literal("create_todos"), status: z.literal("pending_approval"), items: z.array(z.object({ title: z.string(), notes: z.string(), dueAt: z.string().nullable(), sourceEmailId: z.string().nullable() })).min(1) }),
	z.object({ action: z.literal("schedule_meeting"), status: z.literal("pending_approval"), title: z.string(), startsAt: z.string(), durationMinutes: z.number().int(), invitees: z.array(z.object({ id: z.string(), name: z.string(), email: z.string() })) }),
]);

/** The tool that wrote each proposal; to-dos and meetings come from task tools whose names differ from the action. */
const PROPOSAL_TOOL: Record<string, string> = { create_todos: "suggest_todos", schedule_meeting: "propose_meeting" };

export type AgentActionOptions = {
	/** For a to-do proposal, the indexes of the items the user kept; all of them when omitted. */
	selected?: number[];
	/** The site origin, for the meeting link. */
	origin?: string;
};

type Proposal = z.infer<typeof proposalSchema>;

async function runProposal(env: CloudflareEnv, user: SessionUser, mailboxId: string, proposal: Proposal, options: AgentActionOptions) {
	if (proposal.action === "create_todos") {
		const picked = options.selected ? proposal.items.filter((_, index) => options.selected!.includes(index)) : proposal.items;
		if (!picked.length) throw new Error("请至少选择一项待办");
		const todos: Awaited<ReturnType<typeof createTodo>>[] = [];
		for (const item of picked) {
			const dueAt = item.dueAt ? Date.parse(item.dueAt) : null;
			todos.push(await createTodo(env, user, { title: item.title, notes: item.notes, dueAt: Number.isFinite(dueAt) ? dueAt : null, ...(item.sourceEmailId ? { mailId: item.sourceEmailId } : {}) }));
		}
		return { todos: todos.map((todo) => ({ id: todo.id, title: todo.title })) };
	}
	if (proposal.action === "schedule_meeting") {
		const host = await getMeetingUser(env, user.id);
		if (!host) throw new Error("账号不可用");
		const startsAt = Date.parse(proposal.startsAt);
		if (!Number.isFinite(startsAt) || startsAt < Date.now() - 10 * 60_000) throw new Error("会议时间已过，请让助手换个时间");
		const created = await createMeeting(env, host, { title: proposal.title.slice(0, 100), roomId: null, startsAt, durationMinutes: Math.min(Math.max(proposal.durationMinutes, 5), 720), inviteeIds: proposal.invitees.map((invitee) => invitee.id), inviteesChosen: true, sendMail: true }, options.origin ?? "");
		return { meetingId: created.meeting.id, url: created.meeting.url, invited: created.invited, mailError: created.mailError };
	}
	const input = proposal.action === "move_email" ? { emailId: proposal.emailIds[0], destination: proposal.destination }
		: proposal.action === "move_emails" ? { emailIds: proposal.emailIds, destination: proposal.destination }
		: proposal.action === "mark_email_read" ? { emailId: proposal.emailId, read: proposal.read }
		: { draftId: proposal.draftId, expectedRevision: proposal.expectedRevision };
	return runEmailTool({ env, user, mailboxId, origin: "mcp" }, proposal.action as EmailToolName, input);
}

export async function confirmAgentAction(env: CloudflareEnv, user: SessionUser, toolMessageId: string, options: AgentActionOptions = {}) {
	const db = getDb(env);
	const [row] = await db.select({ message: agentChatMessages, conversation: agentConversations }).from(agentChatMessages)
		.innerJoin(agentConversations, eq(agentChatMessages.conversationId, agentConversations.id))
		.where(and(eq(agentChatMessages.id, toolMessageId), eq(agentChatMessages.role, "tool"), eq(agentConversations.userId, user.id))).limit(1);
	if (!row) throw new Error("操作不存在");
	const proposal = proposalSchema.safeParse(JSON.parse(row.message.content));
	if (!proposal.success || row.message.toolName !== (PROPOSAL_TOOL[proposal.data.action] ?? proposal.data.action)) throw new Error("该操作已处理或已失效");
	const claimed = await db.update(agentChatMessages).set({ content: JSON.stringify({ ...JSON.parse(row.message.content), status: "processing" }) })
		.where(and(eq(agentChatMessages.id, toolMessageId), eq(agentChatMessages.content, row.message.content))).returning({ id: agentChatMessages.id });
	if (!claimed.length) throw new Error("该操作正在处理中");
	try {
		const result = await runProposal(env, user, row.conversation.mailboxId, proposal.data, options);
		const updated = { ...JSON.parse(row.message.content), status: "approved", result };
		await db.update(agentChatMessages).set({ content: JSON.stringify(updated) }).where(eq(agentChatMessages.id, toolMessageId));
		return updated;
	} catch (error) {
		await db.update(agentChatMessages).set({ content: row.message.content }).where(eq(agentChatMessages.id, toolMessageId));
		throw error;
	}
}
