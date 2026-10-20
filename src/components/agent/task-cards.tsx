"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarClock, Download, ListChecks } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import type { AgentActionProposal, AgentMessage, AgentTurnProps } from "./types";
import { buildAgentMeetingIcs } from "./meeting-ics";
import { formatAgentTime } from "./utils";

type CardProps = Pick<AgentTurnProps, "onApproveAction" | "approvingId"> & { item: AgentMessage; proposal: AgentActionProposal };

/** "建议的待办": the user keeps the items they want and adds them to 我的待办 in one click. */
export function AgentTodoProposalCard({ item, proposal, onApproveAction, approvingId }: CardProps) {
	const { t, locale } = useLanguage();
	const items = proposal.items ?? [];
	const [selected, setSelected] = useState<number[]>(() => items.map((_, index) => index));
	const done = proposal.status === "approved";
	const busy = approvingId === item.id || proposal.status === "processing";
	return <div className="rounded-2xl border border-neutral-200 bg-white p-3 text-sm">
		<p className="mb-2 flex items-center gap-1.5 font-medium text-neutral-800"><ListChecks size={15} aria-hidden="true" />{t("agent.todos.title")}</p>
		<ul className="space-y-2">{items.map((todo, index) => <li key={index} className="flex items-start gap-2">
			{!done && <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-blue-600" checked={selected.includes(index)} disabled={busy} aria-label={t("agent.todos.toggle", { title: todo.title })} onChange={(event) => setSelected((current) => event.target.checked ? [...current, index].sort((a, b) => a - b) : current.filter((value) => value !== index))} />}
			<div className="min-w-0">
				<p className="break-words text-neutral-900">{todo.title}</p>
				{todo.notes && <p className="break-words text-xs text-neutral-500">{todo.notes}</p>}
				<p className="text-xs text-neutral-500">
					{todo.dueAt && <span className="mr-2">{t("agent.todos.due", { date: formatAgentTime(todo.dueAt, locale) })}</span>}
					{todo.sourceEmailId && <Link className="text-blue-700 hover:underline" href={`/inbox/${encodeURIComponent(todo.sourceEmailId)}`}>{t("agent.todos.from", { subject: todo.sourceSubject || t("list.noSubject") })}</Link>}
				</p>
			</div>
		</li>)}</ul>
		<div className="mt-3 flex flex-wrap items-center justify-end gap-3 text-xs">
			{done ? <p className="text-green-700">{t("agent.todos.added")}</p> : <button type="button" className="rounded-lg bg-blue-600 px-3 py-2 font-medium text-white disabled:opacity-50" disabled={!item.recordId || busy || !selected.length} onClick={() => onApproveAction(item, { selected })}>{busy ? t("agent.todos.adding") : t("agent.todos.add")}</button>}
		</div>
	</div>;
}

/** "建议的会议": book it as an SMJ video meeting (mails .ics invitations to company accounts) or download an .ics. */
export function AgentMeetingProposalCard({ item, proposal, onApproveAction, approvingId }: CardProps) {
	const { t, locale } = useLanguage();
	const done = proposal.status === "approved";
	const busy = approvingId === item.id || proposal.status === "processing";
	const invitees = proposal.invitees ?? [];
	const external = proposal.external ?? [];
	function downloadIcs() {
		const ics = buildAgentMeetingIcs(proposal, item.recordId ?? item.id);
		if (!ics) return;
		const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
		const link = document.createElement("a");
		link.href = url;
		link.download = `${(proposal.title || "meeting").replace(/[\\/:*?"<>|]+/g, " ").trim() || "meeting"}.ics`;
		link.click();
		window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
	}
	return <div className="rounded-2xl border border-neutral-200 bg-white p-3 text-sm">
		<p className="mb-2 flex items-center gap-1.5 font-medium text-neutral-800"><CalendarClock size={15} aria-hidden="true" />{t("agent.meeting.title")}</p>
		<p className="break-words font-medium text-neutral-900">{proposal.title}</p>
		<p className="text-xs text-neutral-600">{formatAgentTime(proposal.startsAt, locale)} · {t("agent.meeting.duration", { minutes: String(proposal.durationMinutes ?? 60) })}</p>
		{proposal.location && <p className="break-words text-xs text-neutral-600">{t("agent.meeting.location", { location: proposal.location })}</p>}
		<p className="break-words text-xs text-neutral-600">{invitees.length ? t("agent.meeting.invitees", { list: invitees.map((person) => person.name).join("、") }) : t("agent.meeting.noInvitees")}</p>
		{external.length > 0 && <p className="break-words text-xs text-amber-700">{t("agent.meeting.external", { list: external.join("、") })}</p>}
		{done && <div className="mt-2 space-y-1 text-xs">
			<p className="text-green-700">{t("agent.meeting.booked")}{proposal.result?.invited?.length ? ` ${t("agent.meeting.invited", { list: proposal.result.invited.join("、") })}` : ""}</p>
			{proposal.result?.mailError && <p className="text-red-600">{t("agent.meeting.mailError", { error: proposal.result.mailError })}</p>}
			{proposal.result?.url && <a className="text-blue-700 hover:underline" href={proposal.result.url} target="_blank" rel="noreferrer">{t("agent.meeting.openLink")}</a>}
		</div>}
		<div className="mt-3 flex flex-wrap items-center justify-end gap-3 text-xs">
			<button type="button" className="inline-flex items-center gap-1 text-blue-700 hover:underline" onClick={downloadIcs}><Download size={13} aria-hidden="true" />{t("agent.meeting.ics")}</button>
			{!done && <button type="button" className="rounded-lg bg-blue-600 px-3 py-2 font-medium text-white disabled:opacity-50" disabled={!item.recordId || busy} onClick={() => onApproveAction(item)}>{busy ? t("agent.meeting.scheduling") : t("agent.meeting.schedule")}</button>}
		</div>
	</div>;
}
