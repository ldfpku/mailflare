import { and, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { agentDraftMetadata, messageAttachments, messages } from "@/db/schema";
import { buildSnippet } from "@/lib/email/parse";
import { getAuthorizedSenderAddress } from "@/lib/email/sender";
import { getEmailAddress, splitEmailAddressList } from "@/lib/email/address";
import { getMailboxAccessLevel } from "@/lib/mailboxes/access";
import { copyMessageAttachments, deleteMessageAttachment, getAttachmentMetadataForUser, MAX_ATTACHMENT_COUNT } from "@/lib/email/attachments";
import { getOutboundAttachmentMaxMb } from "@/lib/email/attachment-policy";
import type { AgentDraftEditInput, AgentToolContext } from "./types";
import { formatAgentDraftBody } from "./draft-format";
import { parseAgentScheduledAt } from "./schedule";

function recipientHeader(value: string, label: string, required: boolean): string {
	const entries = splitEmailAddressList(value);
	if (required && entries.length === 0) throw new Error(`${label} needs at least one address`);
	if (entries.some((entry) => !/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(getEmailAddress(entry)))) throw new Error(`${label} contains an invalid address`);
	return entries.join(", ");
}

export async function editAgentDraft(context: AgentToolContext, input: AgentDraftEditInput) {
	if (![input.from, input.to, input.cc, input.bcc, input.subject, input.body, input.scheduledAt, input.addAttachments?.length, input.removeAttachmentIds?.length].some((value) => value !== undefined && value !== 0)) throw new Error("Provide at least one draft change");
	const db = getDb(context.env);
	const access = await getMailboxAccessLevel(db, context.user, context.mailboxId);
	if (!access?.canSendOnBehalf) throw new Error("You cannot edit drafts in this mailbox");
	const [draft] = await db.select().from(messages).where(and(eq(messages.id, input.draftId), eq(messages.mailboxId, context.mailboxId), eq(messages.userId, context.user.id), eq(messages.status, "draft"))).limit(1);
	if (!draft) throw new Error("Draft not found in the selected mailbox");
	const [metadata] = await db.select().from(agentDraftMetadata).where(and(eq(agentDraftMetadata.draftId, draft.id), eq(agentDraftMetadata.mailboxId, context.mailboxId))).limit(1);
	if (!metadata) throw new Error("This draft was not created by the assistant");
	if (metadata.revision !== input.expectedRevision) throw new Error("Draft changed; read it again before editing");

	const fromAddr = input.from === undefined ? draft.fromAddr : (await getAuthorizedSenderAddress(context.env, { userId: context.user.id, mailboxId: context.mailboxId, from: input.from })).fromAddr;
	const toAddr = input.to === undefined ? draft.toAddr : recipientHeader(input.to, "To", true);
	const ccAddr = input.cc === undefined ? draft.ccAddr : input.cc === null ? null : recipientHeader(input.cc, "Cc", false) || null;
	const bccAddr = input.bcc === undefined ? draft.bccAddr : input.bcc === null ? null : recipientHeader(input.bcc, "Bcc", false) || null;
	const formattedBody = input.body === undefined ? null : formatAgentDraftBody(input.body);
	const scheduledAt = input.scheduledAt === undefined ? undefined : parseAgentScheduledAt(input.scheduledAt);
	const existing = await db.select().from(messageAttachments).where(and(eq(messageAttachments.messageId, draft.id), isNull(messageAttachments.trashedAt)));
	const removeIds = new Set(input.removeAttachmentIds ?? []);
	if ([...removeIds].some((id) => !existing.some((attachment) => attachment.id === id))) throw new Error("Attachment to remove was not found on this draft");
	const remaining = existing.filter((attachment) => !removeIds.has(attachment.id));
	const additions: { sourceId: string; attachmentId: string; size: number }[] = [];
	for (const attachment of input.addAttachments ?? []) {
		const [source] = await db.select({ id: messages.id, userId: messages.userId, status: messages.status }).from(messages).where(and(eq(messages.id, attachment.sourceEmailId), eq(messages.mailboxId, context.mailboxId))).limit(1);
		if (!source || (source.status === "draft" && source.userId !== context.user.id)) throw new Error("Attachment source email not found in the selected mailbox");
		const found = await getAttachmentMetadataForUser(context.env, context.user, source.id, attachment.attachmentId);
		if (!found || found.disposition !== "attachment") throw new Error("Attachment not found on the source email");
		additions.push({ sourceId: source.id, attachmentId: found.id, size: found.size });
	}
	const maxBytes = (await getOutboundAttachmentMaxMb(context.env)) * 1_000_000;
	if (remaining.length + additions.length > MAX_ATTACHMENT_COUNT || remaining.reduce((total, attachment) => total + attachment.size, 0) + additions.reduce((total, attachment) => total + attachment.size, 0) > maxBytes) throw new Error("Draft attachments exceed the allowed count or total size");
	const [updated] = await db.update(agentDraftMetadata).set({ revision: sql`${agentDraftMetadata.revision} + 1`, ...(scheduledAt !== undefined ? { scheduledAt } : {}) }).where(and(eq(agentDraftMetadata.draftId, draft.id), eq(agentDraftMetadata.revision, input.expectedRevision))).returning({ revision: agentDraftMetadata.revision, scheduledAt: agentDraftMetadata.scheduledAt });
	if (!updated) throw new Error("Draft changed; read it again before editing");
	const copied: string[] = [];
	try {
		for (const addition of additions) {
			const rows = await copyMessageAttachments(context.env, addition.sourceId, draft.id, [addition.attachmentId]);
			copied.push(...rows.map((row) => row.id));
		}
	} catch (error) {
		try {
			for (const id of copied) await deleteMessageAttachment(context.env, draft.id, id);
		} catch (cleanupError) {
			throw new AggregateError([error, cleanupError], "Attachment copy and cleanup failed");
		}
		throw error;
	}
	for (const attachmentId of removeIds) await deleteMessageAttachment(context.env, draft.id, attachmentId);
	await db.update(messages).set({
		fromAddr, toAddr, ccAddr, bccAddr,
		subject: input.subject === undefined ? draft.subject : input.subject,
		...(formattedBody ? { textBody: formattedBody.text, htmlBody: formattedBody.html, snippet: buildSnippet(formattedBody.text, null) } : {}),
	}).where(eq(messages.id, draft.id));
	return { draftId: draft.id, revision: updated.revision, status: "draft_updated", scheduledAt: updated.scheduledAt?.toISOString() ?? null, composerUrl: `/drafts/${encodeURIComponent(draft.id)}`, attachmentCount: remaining.length + additions.length };
}
