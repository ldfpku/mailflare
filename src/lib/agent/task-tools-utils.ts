/** At most this many to-dos in one proposal, matching a sensible read of one mail or a week of them. */
export const AGENT_TODO_PROPOSAL_LIMIT = 10;
/** Attachments larger than this are not read: conversion time and model context both grow with size. */
export const AGENT_ATTACHMENT_MAX_BYTES = 10 * 1_048_576;
/** Characters of attachment text handed to the model. */
export const AGENT_ATTACHMENT_TEXT_LIMIT = 20_000;

const TEXT_EXTENSIONS = /\.(txt|text|csv|tsv|md|markdown|json|xml|html?|log|ics|vcf|eml|ya?ml)$/i;
const DOCUMENT_EXTENSIONS = /\.(pdf|docx|xlsx|xlsm|xls|ods|odt|pptx)$/i;
const DOCUMENT_TYPES = /^(application\/pdf|application\/vnd\.openxmlformats-officedocument\.|application\/vnd\.ms-excel|application\/vnd\.oasis\.opendocument\.)/i;

/** How an attachment's text is read: decoded as text, converted by Workers AI `toMarkdown`, or not at all. */
export function attachmentReadKind(filename: string | null | undefined, contentType: string | null | undefined): "text" | "document" | "unsupported" {
	const name = filename ?? "";
	const type = (contentType ?? "").toLowerCase();
	if (DOCUMENT_EXTENSIONS.test(name) || DOCUMENT_TYPES.test(type)) return "document";
	if (TEXT_EXTENSIONS.test(name) || type.startsWith("text/") || type === "application/json" || type === "application/xml") return "text";
	return "unsupported";
}

/** UTF-8 first; Chinese mail still carries GB18030 text files, so a file that is not valid UTF-8 is read as that. */
export function decodeAttachmentText(bytes: ArrayBuffer): string {
	try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^﻿/, ""); }
	catch {
		try { return new TextDecoder("gb18030").decode(bytes); }
		catch { return new TextDecoder("utf-8").decode(bytes); }
	}
}

/** Gmail-style operators for the structured search fields, so the model need not know the grammar. */
export function buildAgentSearchQuery(input: { query?: string | null; from?: string | null; to?: string | null; subject?: string | null; after?: string | null; before?: string | null; hasAttachment?: boolean | null; unread?: boolean | null }): string {
	const quote = (value: string) => /\s/.test(value) ? `"${value.replace(/"/g, "")}"` : value.replace(/"/g, "");
	const parts: string[] = [];
	if (input.from?.trim()) parts.push(`from:${quote(input.from.trim())}`);
	if (input.to?.trim()) parts.push(`to:${quote(input.to.trim())}`);
	if (input.subject?.trim()) parts.push(`subject:${quote(input.subject.trim())}`);
	if (input.after?.trim()) parts.push(`after:${input.after.trim()}`);
	if (input.before?.trim()) parts.push(`before:${input.before.trim()}`);
	if (input.hasAttachment) parts.push("has:attachment");
	if (input.unread === true) parts.push("is:unread");
	if (input.unread === false) parts.push("is:read");
	if (input.query?.trim()) parts.push(input.query.trim());
	return parts.join(" ");
}

/** The language the assistant answers in, from the web app's locale; SMJ defaults to Simplified Chinese. */
export function agentReplyLanguage(locale: string | null | undefined): string {
	const code = (locale ?? "").trim();
	if (!code || /^zh(-CN|-Hans)?$/i.test(code)) return "Simplified Chinese (简体中文)";
	if (/^zh/i.test(code)) return "Traditional Chinese (繁體中文)";
	if (/^en/i.test(code)) return "English";
	try { return new Intl.DisplayNames(["en"], { type: "language" }).of(code) ?? "Simplified Chinese (简体中文)"; }
	catch { return "Simplified Chinese (简体中文)"; }
}

/** A conversation title from the first question: its first line, without the email ids quick tasks may carry. */
export function agentConversationTitle(text: string, title?: string | null): string {
	const chosen = (title ?? "").replace(/\s+/g, " ").trim();
	if (chosen) return chosen.slice(0, 60);
	const line = text.split(/\r?\n/).find((value) => value.trim()) ?? "";
	const cleaned = line.replace(/\bmsg_[0-9a-z]+\b/gi, "").replace(/\s+/g, " ").trim();
	return (cleaned || "新对话").slice(0, 60);
}
