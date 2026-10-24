import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { messages, users } from "@/db/schema";
import { getAttachmentForUser } from "@/lib/email/attachments";
import { getMailboxAccessLevel } from "@/lib/mailboxes/access";
import { toolEmailSchema } from "./schema-utils";
import { AGENT_ATTACHMENT_MAX_BYTES, AGENT_ATTACHMENT_TEXT_LIMIT, AGENT_TODO_PROPOSAL_LIMIT, attachmentReadKind, decodeAttachmentText } from "./task-tools-utils";
import type { AgentToolContext, TaskToolName } from "./types";

/**
 * The assistant's mail tasks beyond reading and drafting: to-dos for "我的待办" (`im_todos`),
 * a meeting with an .ics invitation, and reading an attachment's text. Nothing here writes
 * anything in chat: to-dos and meetings come back as `pending_approval` proposals that the
 * user confirms in the panel (`confirmAgentAction`), because a meeting mails its invitees.
 */
const id = z.string().min(1).max(160);
const instant = z.string().datetime({ offset: true });

export const taskToolSchemas = {
	suggest_todos: z.object({
		items: z.array(z.object({
			title: z.string().trim().min(1).max(200).describe("One concrete action, in the user's language"),
			notes: z.string().max(1_000).optional().describe("Who asked, context or details"),
			dueAt: instant.nullish().describe("Deadline as ISO 8601 with offset, only when the email states one"),
			sourceEmailId: id.optional().describe("The email this action comes from"),
		})).min(1).max(AGENT_TODO_PROPOSAL_LIMIT),
	}),
	propose_meeting: z.object({
		title: z.string().trim().min(1).max(100),
		startsAt: instant.describe("Start as ISO 8601 with offset in the user's timezone"),
		durationMinutes: z.number().int().min(5).max(720).default(60),
		attendees: z.array(toolEmailSchema).max(50).default([]),
		location: z.string().max(300).optional(),
		description: z.string().max(2_000).optional(),
		sourceEmailId: id.optional(),
	}),
	read_attachment: z.object({ emailId: id, attachmentId: id }),
} as const;

export const taskToolDescriptions: Record<TaskToolName, string> = {
	suggest_todos: "Propose to-do items for the user's personal to-do list (我的待办), usually action items found in emails. This saves nothing: the user picks and confirms them in the panel.",
	propose_meeting: "Propose a meeting found in or requested from email: title, start, duration and attendee emails. This schedules nothing and sends nothing: the user can confirm an SMJ video meeting (which mails .ics invitations to company attendees) or download an .ics file.",
	read_attachment: "Read the text of one email attachment (plain text, CSV, Markdown, HTML, JSON, PDF, Word or Excel). Use the attachment IDs returned by get_email. Images and other files cannot be read.",
};

export const TASK_TOOL_NAMES = Object.keys(taskToolSchemas) as TaskToolName[];

async function readableEmail(context: AgentToolContext, emailId: string) {
	const db = getDb(context.env);
	const access = await getMailboxAccessLevel(db, context.user, context.mailboxId);
	if (!access?.canRead) throw new Error("Mailbox not found or permission denied");
	const [row] = await db.select({ id: messages.id, subject: messages.subject, status: messages.status, userId: messages.userId }).from(messages).where(and(eq(messages.id, emailId), eq(messages.mailboxId, context.mailboxId))).limit(1);
	if (!row || (row.status === "draft" && row.userId !== context.user.id)) throw new Error("Message not found");
	return row;
}

export async function runTaskTool(context: AgentToolContext, name: TaskToolName, rawInput: unknown): Promise<unknown> {
	if (name === "suggest_todos") {
		const input = taskToolSchemas.suggest_todos.parse(rawInput);
		const items: { title: string; notes: string; dueAt: string | null; sourceEmailId: string | null; sourceSubject: string | null }[] = [];
		for (const item of input.items) {
			// A source the user cannot read is dropped rather than failing the whole proposal.
			const source = item.sourceEmailId ? await readableEmail(context, item.sourceEmailId).catch(() => null) : null;
			items.push({ title: item.title, notes: item.notes ?? "", dueAt: item.dueAt ?? null, sourceEmailId: source?.id ?? null, sourceSubject: source?.subject ?? null });
		}
		return { action: "create_todos", status: "pending_approval", items };
	}
	if (name === "propose_meeting") {
		const input = taskToolSchemas.propose_meeting.parse(rawInput);
		const startsAt = Date.parse(input.startsAt);
		if (startsAt < Date.now() - 10 * 60_000) throw new Error("The meeting time is in the past; ask the user for a new time");
		const emails = [...new Set(input.attendees.map((email) => email.trim().toLowerCase()))].filter((email) => email !== context.user.email.toLowerCase());
		const db = getDb(context.env);
		const found = emails.length ? await db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(and(inArray(sql`lower(${users.email})`, emails), eq(users.disabled, false), isNull(users.deletedAt))) : [];
		const byEmail = new Map(found.map((row) => [row.email.toLowerCase(), row]));
		const invitees = emails.flatMap((email) => { const row = byEmail.get(email); return row ? [{ id: row.id, name: row.name || row.email, email: row.email }] : []; });
		const external = emails.filter((email) => !byEmail.has(email));
		const source = input.sourceEmailId ? await readableEmail(context, input.sourceEmailId).catch(() => null) : null;
		return {
			action: "schedule_meeting", status: "pending_approval", title: input.title, startsAt: new Date(startsAt).toISOString(), durationMinutes: input.durationMinutes,
			location: input.location ?? "", description: input.description ?? "", invitees, external, sourceEmailId: source?.id ?? null,
			note: external.length ? "Only company accounts get the video meeting invitation; external attendees need the .ics file sent by the user." : undefined,
		};
	}
	if (name === "read_attachment") {
		const input = taskToolSchemas.read_attachment.parse(rawInput);
		await readableEmail(context, input.emailId);
		const found = await getAttachmentForUser(context.env, context.user, input.emailId, input.attachmentId);
		if (!found) throw new Error("Attachment not found");
		const { attachment, object } = found;
		const kind = attachmentReadKind(attachment.filename, attachment.contentType);
		const base = { emailId: input.emailId, attachmentId: attachment.id, filename: attachment.filename, size: attachment.size };
		if (kind === "unsupported") return { ...base, readable: false, reason: "Only text, PDF, Word and Excel attachments can be read" };
		if (attachment.size > AGENT_ATTACHMENT_MAX_BYTES) return { ...base, readable: false, reason: `Attachments over ${Math.round(AGENT_ATTACHMENT_MAX_BYTES / 1_048_576)} MB cannot be read` };
		const bytes = await object.arrayBuffer();
		let text: string;
		if (kind === "text") text = decodeAttachmentText(bytes);
		else {
			// Workers AI converts PDF and Office files to Markdown; without the binding they cannot be read.
			if (!context.env.AI?.toMarkdown) return { ...base, readable: false, reason: "Document conversion is unavailable" };
			const converted = await context.env.AI.toMarkdown({ name: attachment.filename || "attachment", blob: new Blob([bytes], { type: attachment.contentType || "application/octet-stream" }) });
			if (!converted || converted.format === "error" || typeof (converted as { data?: unknown }).data !== "string") return { ...base, readable: false, reason: "The document could not be converted to text" };
			text = (converted as { data: string }).data;
		}
		text = text.trim();
		return { ...base, readable: true, text: text.slice(0, AGENT_ATTACHMENT_TEXT_LIMIT), truncated: text.length > AGENT_ATTACHMENT_TEXT_LIMIT };
	}
	throw new Error("Unknown tool");
}
