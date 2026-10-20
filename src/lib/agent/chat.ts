import { and, asc, desc, eq } from "drizzle-orm";
import { streamText, stepCountIs } from "ai";
import { getDb } from "@/db";
import { agentChatMessages, agentConversations, mailboxAgentSettings, messages } from "@/db/schema";
import { getMailboxAccessLevel } from "@/lib/mailboxes/access";
import { newId } from "@/lib/ids";
import { agentCurrentEmailContext, agentSystemPrompt, getAgentModel } from "./model";
import { agentProviderErrorMessage } from "./errors";
import { getAgentEnabled } from "./provider";
import { recordAiUsage } from "@/lib/ai/usage";
import { EMAIL_TOOL_NAMES, emailToolDescriptions, emailToolSchemas, runEmailTool } from "./tools";
import type { AgentToolContext } from "./types";
import { normalizeTimeZone } from "@/lib/time/utils";
import { CALENDAR_TOOL_NAMES, calendarToolDescriptions, calendarToolSchemas, runCalendarTool } from "@/lib/calendar/tools";
import { TASK_TOOL_NAMES, runTaskTool, taskToolDescriptions, taskToolSchemas } from "./task-tools";
import { agentConversationTitle, agentReplyLanguage } from "./task-tools-utils";

export type AgentChatOptions = { locale?: string | null; title?: string | null };

export async function getAgentConversation(context: AgentToolContext, conversationId: string) {
	const db = getDb(context.env);
	const [conversation] = await db.select().from(agentConversations).where(and(eq(agentConversations.id, conversationId), eq(agentConversations.userId, context.user.id), eq(agentConversations.mailboxId, context.mailboxId))).limit(1);
	return conversation ?? null;
}

export async function listAgentConversations(context: AgentToolContext) {
	const db = getDb(context.env);
	const access = await getMailboxAccessLevel(db, context.user, context.mailboxId);
	if (!access?.canRead) throw new Error("邮箱不存在");
	return db.select().from(agentConversations).where(and(eq(agentConversations.userId, context.user.id), eq(agentConversations.mailboxId, context.mailboxId))).orderBy(desc(agentConversations.updatedAt)).limit(30);
}

export async function getAgentChatHistory(context: AgentToolContext, conversationId: string) {
	if (!await getAgentConversation(context, conversationId)) throw new Error("对话不存在");
	return getDb(context.env).select().from(agentChatMessages).where(eq(agentChatMessages.conversationId, conversationId)).orderBy(asc(agentChatMessages.createdAt)).limit(200);
}

export async function createAgentChatStream(context: AgentToolContext, text: string, conversationId?: string, signal?: AbortSignal, timeZone?: string, currentMessageId?: string, options: AgentChatOptions = {}) {
	timeZone = normalizeTimeZone(timeZone ?? context.timeZone);
	context = { ...context, timeZone };
	const db = getDb(context.env);
	const access = await getMailboxAccessLevel(db, context.user, context.mailboxId);
	if (!access?.canRead) throw new Error("邮箱不存在");
	if (!await getAgentEnabled(context.env)) throw new Error("邮件助手已关闭");
	const [settings] = await db.select().from(mailboxAgentSettings).where(eq(mailboxAgentSettings.mailboxId, context.mailboxId)).limit(1);
	const selection = await getAgentModel(context.env, settings?.modelId);
	if (!selection) throw new Error("尚未配置 AI 服务");
	// Ignored unless it is in this mailbox and visible to the user, matching get_email.
	const [current] = currentMessageId ? await db.select({ id: messages.id, status: messages.status, userId: messages.userId }).from(messages).where(and(eq(messages.id, currentMessageId), eq(messages.mailboxId, context.mailboxId))).limit(1) : [];
	const openEmailId = current && (current.status !== "draft" || current.userId === context.user.id) ? current.id : null;
	let conversation = conversationId ? await getAgentConversation(context, conversationId) : null;
	if (conversationId && !conversation) throw new Error("对话不存在");
	if (!conversation) {
		const id = newId("conv");
		await db.insert(agentConversations).values({ id, userId: context.user.id, mailboxId: context.mailboxId, title: agentConversationTitle(text, options.title) });
		conversation = await getAgentConversation(context, id);
	}
	if (!conversation) throw new Error("无法创建对话");
	const history = await db.select().from(agentChatMessages).where(eq(agentChatMessages.conversationId, conversation.id)).orderBy(desc(agentChatMessages.createdAt)).limit(30);
	await db.insert(agentChatMessages).values({ id: newId("chat"), conversationId: conversation.id, role: "user", content: text });
	const prompt = history.reverse().filter((row) => row.role === "user" || row.role === "assistant").map((row) => ({ role: row.role as "user" | "assistant", content: row.content }));
	// Sent with the latest turn rather than the system prompt so it outweighs emails named earlier in the history; never stored.
	prompt.push({ role: "user", content: openEmailId ? `${text}\n\n(${agentCurrentEmailContext(openEmailId)})` : text });
	const tools = Object.fromEntries(EMAIL_TOOL_NAMES.map((name) => [name, {
		description: emailToolDescriptions[name], inputSchema: emailToolSchemas[name],
		execute: async (input: unknown) => runEmailTool(context, name, input),
	}]));
	const calendarTools = Object.fromEntries(CALENDAR_TOOL_NAMES.map((name) => [name, {
		description: calendarToolDescriptions[name], inputSchema: calendarToolSchemas[name],
		execute: async (input: unknown) => runCalendarTool(context, name, input),
	}]));
	const taskTools = Object.fromEntries(TASK_TOOL_NAMES.map((name) => [name, {
		description: taskToolDescriptions[name], inputSchema: taskToolSchemas[name],
		execute: async (input: unknown) => runTaskTool(context, name, input),
	}]));
	// One "[agent] request" line per turn, in the same shape as the chat summaries' "[im-ai] request".
	const trace = { started: Date.now(), steps: 0, toolCalls: 0, inputTokens: 0, outputTokens: 0, finishReason: "" as string, error: "" };
	const result = streamText({ model: selection.model, system: agentSystemPrompt(settings?.instructions ?? "", timeZone, agentReplyLanguage(options.locale)), messages: prompt, tools: { ...tools, ...calendarTools, ...taskTools }, stopWhen: stepCountIs(8), maxOutputTokens: 2000, abortSignal: signal, onStepFinish: async ({ usage, finishReason }) => {
		trace.steps += 1;
		trace.inputTokens += usage.inputTokens ?? 0;
		trace.outputTokens += usage.outputTokens ?? 0;
		trace.finishReason = finishReason;
		await recordAiUsage({ env: context.env, details: selection, usage, source: "chat" });
	} });
	const logTurn = () => {
		const outcome = trace.error ? "failed" : signal?.aborted ? "aborted" : "ok";
		const line = { source: "chat", outcome, ms: Date.now() - trace.started, model: selection.modelId, attempts: 1, steps: trace.steps, toolCalls: trace.toolCalls, finishReason: trace.finishReason, inputTokens: trace.inputTokens, outputTokens: trace.outputTokens, ...(trace.error ? { error: trace.error } : {}) };
		if (outcome === "ok") console.log("[agent] request", JSON.stringify(line));
		else console.warn("[agent] request", JSON.stringify(line));
	};
	const encoder = new TextEncoder();
	const id = conversation.id;
	const stream = new ReadableStream<Uint8Array>({
		async start(controller) {
			let response = "";
			let stepText = "";
			const emit = (event: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
			emit({ type: "conversation", conversationId: id });
			try {
				for await (const part of result.fullStream) {
					if (part.type === "text-delta") {
						response += part.text;
						stepText += part.text;
						emit({ type: "text", text: part.text });
					} else if (part.type === "finish-step") {
						// The model's thinking, and text it wrote before calling a tool, are often English
						// and are never shown or kept: the panel shows only "正在思考…" until the answer.
						if (part.finishReason === "tool-calls" && stepText) {
							response = response.slice(0, -stepText.length);
							emit({ type: "reclassify", text: stepText });
						}
						stepText = "";
					} else if (part.type === "tool-call") {
						trace.toolCalls += 1;
						emit({ type: "tool", id: part.toolCallId, name: part.toolName, state: "running" });
					} else if (part.type === "tool-result") {
						const recordId = newId("chat");
						await db.insert(agentChatMessages).values({ id: recordId, conversationId: id, role: "tool", toolName: part.toolName, content: (JSON.stringify(part.output) ?? "null").slice(0, 12_000) });
						emit({ type: "tool", id: part.toolCallId, name: part.toolName, state: "complete", result: part.output, recordId });
					} else if (part.type === "tool-error") {
						const message = agentProviderErrorMessage(part.error);
						await db.insert(agentChatMessages).values({ id: newId("chat"), conversationId: id, role: "tool", toolName: part.toolName, content: message });
						emit({ type: "tool", id: part.toolCallId, name: part.toolName, state: "failed", result: message });
					} else if (part.type === "error") {
						trace.error = agentProviderErrorMessage(part.error).slice(0, 300);
						emit({ type: "error", message: agentProviderErrorMessage(part.error) });
					}
				}
				if (response.trim()) await db.insert(agentChatMessages).values({ id: newId("chat"), conversationId: id, role: "assistant", content: response });
				await db.update(agentConversations).set({ updatedAt: new Date() }).where(eq(agentConversations.id, id));
				emit({ type: "done" });
			} catch (error) {
				if (response.trim()) await db.insert(agentChatMessages).values({ id: newId("chat"), conversationId: id, role: "assistant", content: response });
				trace.error = agentProviderErrorMessage(error).slice(0, 300);
				emit({ type: "error", message: agentProviderErrorMessage(error) });
			} finally {
				logTurn();
				controller.close();
			}
		},
	});
	return { conversationId: id, stream };
}

export async function renameAgentConversation(env: CloudflareEnv, userId: string, conversationId: string, title: string) {
	const clean = title.replace(/\s+/g, " ").trim().slice(0, 60);
	if (!clean) throw new Error("请填写对话名称");
	const [row] = await getDb(env).update(agentConversations).set({ title: clean }).where(and(eq(agentConversations.id, conversationId), eq(agentConversations.userId, userId))).returning({ id: agentConversations.id, title: agentConversations.title, updatedAt: agentConversations.updatedAt });
	if (!row) throw new Error("对话不存在");
	return row;
}

/** Deletes every message of a conversation the user owns; the conversation itself stays in the history. */
export async function clearAgentConversation(env: CloudflareEnv, userId: string, conversationId: string) {
	const db = getDb(env);
	const [row] = await db.select({ id: agentConversations.id }).from(agentConversations).where(and(eq(agentConversations.id, conversationId), eq(agentConversations.userId, userId))).limit(1);
	if (!row) throw new Error("对话不存在");
	await db.delete(agentChatMessages).where(eq(agentChatMessages.conversationId, row.id));
	await db.update(agentConversations).set({ updatedAt: new Date() }).where(eq(agentConversations.id, row.id));
}
