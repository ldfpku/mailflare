import { generateText } from "ai";
import { createWorkersAI } from "workers-ai-provider";
import { getDb } from "@/db";
import { getAgentEnabled, getAgentProviderConfig } from "@/lib/agent/provider";
import { DEFAULT_CLOUDFLARE_MODEL } from "@/lib/agent/provider-constants";
import { allowAgentRequest } from "@/lib/agent/rate-limit";
import { recordAiUsage } from "@/lib/ai/usage";
import { getEmailAddress, getEmailDisplayName } from "@/lib/email/address";
import { getMailboxAccessLevel } from "@/lib/mailboxes/access";
import {
	IM_SUMMARY_DEFAULT_MESSAGES,
	IM_SUMMARY_MAX_MESSAGES,
	buildTranscript,
	chunkTranscript,
	cleanModelText,
	mailPlainText,
	mergeSystemPrompt,
	parseTodoDraft,
	partSystemPrompt,
	summarySystemPrompt,
	todoSystemPrompt,
	todoUserPrompt,
} from "./ai-utils";
import { ensureAllStaffRoom, isRoomMember } from "./chat";
import { IM_ALL_STAFF_ROOM_ID, IM_ROOM_TYPE, ImChatError, imUserName, type ImMessageRow, type ImUserRow } from "./chat-utils";
import { isMailShareId, type SharedMailRow } from "./mail-share-utils";
import { pointsToNotes } from "./todos-utils";
import type { ImUser } from "./tokens";

/**
 * Chat summaries and mail to-do drafts on Workers AI, through the same `AI`
 * binding the mail assistant uses. Only Cloudflare models are ever called: the
 * assistant's model is reused when the admin picked a Workers AI one, and
 * `IM_AI_MODEL` can name another `@cf/` model. A summary is returned to the
 * person who asked and is never stored or posted into the chat.
 */
type Env = CloudflareEnv;

function imAiModelId(env: Env, configured: { provider: string; model: string }): string {
	const override = env.IM_AI_MODEL?.trim();
	if (override?.startsWith("@cf/")) return override;
	return configured.provider === "cloudflare" && configured.model.startsWith("@cf/") ? configured.model : DEFAULT_CLOUDFLARE_MODEL;
}

async function imAiModel(env: Env, userId: string) {
	if (!env.AI) throw new ImChatError(400, "AI 功能未开启，请联系管理员");
	if (!(await getAgentEnabled(env))) throw new ImChatError(403, "管理员已关闭 AI 功能");
	if (!(await allowAgentRequest(env, `im-ai:${userId}`))) throw new ImChatError(400, "请求太频繁，请稍后再试");
	const config = await getAgentProviderConfig(env);
	const modelId = imAiModelId(env, config);
	return { model: createWorkersAI({ binding: env.AI })(modelId), modelId, provider: "cloudflare", rates: config.rates[modelId] };
}

type ImAiModel = Awaited<ReturnType<typeof imAiModel>>;

async function generate(env: Env, selection: ImAiModel, source: string, system: string, prompt: string, maxOutputTokens: number): Promise<string> {
	let result;
	try {
		result = await generateText({ model: selection.model, system, prompt, maxOutputTokens, temperature: 0.2 });
	} catch (error) {
		console.error("[im-ai] Workers AI call failed", selection.modelId, error);
		throw new ImChatError(400, "AI 暂时不可用，请稍后再试");
	}
	await recordAiUsage({ env, details: selection, usage: result.usage, source });
	return cleanModelText(result.text);
}

// Chat summary ----------------------------------------------------------------

export interface ImSummaryResult {
	summary: string;
	/** Messages that went into the summary (recalled ones and empty bodies left out). */
	messageCount: number;
	firstAt: number | null;
	lastAt: number | null;
	/** How many parts a long chat was split into. */
	parts: number;
	/** Messages left out because the chat was too long to read in full. */
	dropped: number;
}

/** Summarizes the latest `count` messages of a room the caller is in (default 100, at most 500). */
export async function summarizeRoom(env: Env, user: ImUser, input: { roomId?: unknown; count?: unknown }): Promise<ImSummaryResult> {
	const roomId = typeof input.roomId === "string" ? input.roomId : "";
	if (!roomId) throw new ImChatError(400, "缺少会话");
	if (roomId === IM_ALL_STAFF_ROOM_ID) await ensureAllStaffRoom(env);
	const room = await env.DB.prepare("SELECT r.type FROM im_room_members m JOIN im_rooms r ON r.id = m.room_id WHERE m.room_id = ? AND m.user_id = ?")
		.bind(roomId, user.id)
		.first<{ type: number }>();
	if (!room) throw new ImChatError(403, "你不在该会话中");
	const requested = Math.floor(Number(input.count));
	const count = Number.isFinite(requested) && requested > 0 ? Math.min(requested, IM_SUMMARY_MAX_MESSAGES) : IM_SUMMARY_DEFAULT_MESSAGES;

	const result = await env.DB.prepare(
		"SELECT id, room_id, from_uid, type, body, reply_msg_id, recalled_by, recalled_at, created_at FROM im_messages WHERE room_id = ? ORDER BY id DESC LIMIT ?",
	)
		.bind(roomId, count)
		.all<ImMessageRow>();
	const rows = result.results.reverse();
	const senderIds = [...new Set(rows.map((row) => row.from_uid))];
	const names = new Map<string, string>();
	for (let index = 0; index < senderIds.length; index += 50) {
		const chunk = senderIds.slice(index, index + 50);
		const people = await env.DB.prepare(`SELECT id, email, name FROM users WHERE id IN (${chunk.map(() => "?").join(", ")})`)
			.bind(...chunk)
			.all<ImUserRow>();
		for (const person of people.results) names.set(person.id, imUserName(person));
	}
	const lines = buildTranscript(rows, (uid) => names.get(uid) ?? imUserName(null));
	const messages = lines.filter((line) => !line.text.startsWith("—— "));
	const base = { messageCount: messages.length, firstAt: messages[0]?.at ?? null, lastAt: messages.at(-1)?.at ?? null };
	if (!messages.length) return { summary: "这段时间没有可以摘要的消息。", ...base, parts: 0, dropped: 0 };

	const isGroup = room.type === IM_ROOM_TYPE.GROUP;
	const { chunks, dropped } = chunkTranscript(lines);
	const selection = await imAiModel(env, user.id);
	if (chunks.length === 1) {
		const summary = await generate(env, selection, "im_summary", summarySystemPrompt(isGroup), `聊天记录：\n${chunks[0]}`, 900);
		return { summary, ...base, messageCount: base.messageCount - dropped, parts: 1, dropped };
	}
	const partials: string[] = [];
	for (const [index, chunk] of chunks.entries()) {
		partials.push(`第 ${index + 1} 段：\n${await generate(env, selection, "im_summary", partSystemPrompt(), `聊天记录（第 ${index + 1}/${chunks.length} 段）：\n${chunk}`, 600)}`);
	}
	const summary = await generate(env, selection, "im_summary", mergeSystemPrompt(isGroup), partials.join("\n\n"), 900);
	return { summary, ...base, messageCount: base.messageCount - dropped, parts: chunks.length, dropped };
}

// Mail to-do draft --------------------------------------------------------------

const MAIL_COLUMNS = "id, mailbox_id, from_addr, to_addr, cc_addr, subject, snippet, text_body, html_body, created_at";

/**
 * The mail named by `mailId` (the caller must be able to read its mailbox) or by
 * `shareId` (a mail card in a chat the caller is in). Not found either way
 * answers 404, so ids of mails the caller cannot see are not confirmed.
 */
export async function findReadableMail(env: Env, user: Pick<ImUser, "id" | "role">, input: { mailId?: unknown; shareId?: unknown }): Promise<SharedMailRow> {
	let mail: SharedMailRow | null = null;
	if (isMailShareId(input.shareId)) {
		const share = await env.DB.prepare("SELECT message_id, room_id FROM im_mail_shares WHERE id = ?").bind(input.shareId).first<{ message_id: string; room_id: string }>();
		if (share && (await isRoomMember(env, share.room_id, user.id))) {
			mail = await env.DB.prepare(`SELECT ${MAIL_COLUMNS} FROM messages WHERE id = ?`).bind(share.message_id).first<SharedMailRow>();
		}
	} else if (typeof input.mailId === "string" && input.mailId) {
		const found = await env.DB.prepare(`SELECT ${MAIL_COLUMNS} FROM messages WHERE id = ?`).bind(input.mailId).first<SharedMailRow>();
		if (found?.mailbox_id && (await getMailboxAccessLevel(getDb(env), user, found.mailbox_id))?.canRead) mail = found;
	}
	if (!mail) throw new ImChatError(404, "邮件不存在");
	return mail;
}

/** A to-do drafted from a mail for the caller to check and save; nothing is stored here. */
export async function draftMailTodo(env: Env, user: Pick<ImUser, "id" | "role">, input: { mailId?: unknown; shareId?: unknown }) {
	const mail = await findReadableMail(env, user, input);
	const subject = mail.subject?.trim() || "(无主题)";
	const sender = getEmailDisplayName(mail.from_addr) || getEmailAddress(mail.from_addr) || mail.from_addr;
	const selection = await imAiModel(env, user.id);
	const answer = await generate(
		env,
		selection,
		"im_mail_todo",
		todoSystemPrompt(Date.now()),
		todoUserPrompt({ subject, from: sender, date: mail.created_at * 1000, body: mailPlainText(mail.text_body, mail.html_body) }),
		600,
	);
	const draft = parseTodoDraft(answer, subject) ?? { title: `处理邮件：${subject}`.slice(0, 100), dueAt: null, points: [] };
	return { ...draft, notes: pointsToNotes(draft.points), mailId: mail.id, mailSubject: subject };
}
