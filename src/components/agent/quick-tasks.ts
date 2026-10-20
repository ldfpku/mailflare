import { CalendarClock, FileText, Languages, LayoutTemplate, ListChecks, Paperclip, PenLine, Search, Signature, Sparkles } from "lucide-react";
import type { AgentQuickTask } from "./types";

/**
 * The panel's quick tasks. With an email open they work on that email (the chat request carries
 * its id as `currentMessageId`, so the prompts name no id); otherwise on the mailbox. `insert`
 * tasks put a starter sentence in the input for the user to finish instead of sending it.
 */
export const AGENT_EMAIL_TASKS: AgentQuickTask[] = [
	{ id: "summarizeThread", icon: FileText, mode: "send" },
	{ id: "replyThread", icon: PenLine, mode: "send" },
	{ id: "todosThread", icon: ListChecks, mode: "send" },
	{ id: "translateThread", icon: Languages, mode: "send" },
	{ id: "meetingThread", icon: CalendarClock, mode: "send" },
	{ id: "attachmentThread", icon: Paperclip, mode: "send" },
	{ id: "templatesThread", icon: LayoutTemplate, mode: "send" },
	{ id: "polish", icon: Sparkles, mode: "insert" },
];

export const AGENT_MAILBOX_TASKS: AgentQuickTask[] = [
	{ id: "summarizeRecent", icon: FileText, mode: "send" },
	{ id: "todosRecent", icon: ListChecks, mode: "send" },
	{ id: "searchMail", icon: Search, mode: "insert" },
	{ id: "meetingsRecent", icon: CalendarClock, mode: "send" },
	{ id: "polish", icon: Sparkles, mode: "insert" },
	{ id: "templates", icon: LayoutTemplate, mode: "send" },
	{ id: "signature", icon: Signature, mode: "send" },
];

export function agentQuickTasks(hasOpenEmail: boolean): AgentQuickTask[] {
	return hasOpenEmail ? AGENT_EMAIL_TASKS : AGENT_MAILBOX_TASKS;
}

/** The history title for a conversation a quick task starts: the task, and the subject of the email it is about. */
export function agentQuickTaskTitle(label: string, subject: string | null | undefined): string {
	const clean = (subject ?? "").replace(/\s+/g, " ").trim();
	return (clean ? `${label}：${clean}` : label).slice(0, 60);
}
