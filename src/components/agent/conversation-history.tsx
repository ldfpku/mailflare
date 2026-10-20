"use client";

import { useState } from "react";
import { Check, MessageSquare, Pencil, Search, SquarePen, Trash2, X } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import type { AgentConversation } from "./types";
import { filterAgentConversations, groupAgentConversations } from "./utils";

type Props = {
	conversations: AgentConversation[];
	currentId: string | null;
	busyId: string | null;
	onSelect: (id: string) => void;
	onNew: () => void;
	onRename: (id: string, title: string) => Promise<boolean>;
	onDelete: (id: string) => void;
};

/** The assistant's history view: chats of this mailbox by last activity, searchable, renamed and deleted in place. */
export function AgentConversationHistory({ conversations, currentId, busyId, onSelect, onNew, onRename, onDelete }: Props) {
	const { t } = useLanguage();
	const [query, setQuery] = useState("");
	const [editingId, setEditingId] = useState<string | null>(null);
	const [draftTitle, setDraftTitle] = useState("");
	const groups = groupAgentConversations(filterAgentConversations(conversations, query));
	async function saveTitle(id: string) {
		if (!draftTitle.trim()) return;
		if (await onRename(id, draftTitle)) setEditingId(null);
	}
	return <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 text-sm">
		<button type="button" className="mb-3 flex w-full items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700" onClick={onNew}><SquarePen size={16} aria-hidden="true" />{t("agent.panel.newChatTitle")}</button>
		{conversations.length > 0 && <label className="mb-3 flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-neutral-500 focus-within:border-blue-400"><Search size={15} aria-hidden="true" /><input className="min-w-0 flex-1 bg-transparent text-neutral-900 outline-none" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("agent.panel.searchChats")} aria-label={t("agent.panel.searchChats")} /></label>}
		{!conversations.length && <p className="px-2 py-6 text-center text-neutral-500">{t("agent.panel.noChats")}</p>}
		{conversations.length > 0 && !groups.length && <p className="px-2 py-6 text-center text-neutral-500">{t("agent.panel.noMatches")}</p>}
		{groups.map((group) => <section key={group.key} className="mb-3">
			<h3 className="px-2 pb-1 text-xs font-medium text-neutral-500">{t(`agent.panel.${group.key}`)}</h3>
			<ul>{group.items.map((item) => <li key={item.id} className={`group flex items-center gap-1 rounded-xl ${currentId === item.id ? "bg-blue-50 text-blue-700" : "text-neutral-800 hover:bg-neutral-50"}`}>
				{editingId === item.id ? <form className="flex min-w-0 flex-1 items-center gap-1 py-1 pl-2" onSubmit={(event) => { event.preventDefault(); void saveTitle(item.id); }}>
					<input autoFocus className="min-w-0 flex-1 rounded-lg border border-blue-300 bg-white px-2 py-1 text-neutral-900 outline-none" value={draftTitle} maxLength={60} onChange={(event) => setDraftTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") setEditingId(null); }} aria-label={t("agent.panel.renameChatLabel", { title: item.title })} />
					<button type="submit" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-blue-700 hover:bg-blue-100 disabled:opacity-50" disabled={!draftTitle.trim() || busyId === item.id} aria-label={t("agent.panel.renameSave")} title={t("agent.panel.renameSave")}><Check size={15} /></button>
					<button type="button" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100" onClick={() => setEditingId(null)} aria-label={t("agent.panel.renameCancel")} title={t("agent.panel.renameCancel")}><X size={15} /></button>
				</form> : <>
					<button type="button" className="flex min-w-0 flex-1 items-center gap-2 py-2.5 pl-3 pr-1 text-left" onClick={() => onSelect(item.id)}><MessageSquare size={14} className="shrink-0 text-neutral-400" aria-hidden="true" /><span className="truncate">{item.title || t("agent.panel.untitled")}</span></button>
					<button type="button" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-500 opacity-0 transition-opacity hover:bg-neutral-100 hover:text-neutral-800 focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100" onClick={() => { setEditingId(item.id); setDraftTitle(item.title); }} aria-label={t("agent.panel.renameChatLabel", { title: item.title })} title={t("agent.panel.renameChat")}><Pencil size={14} /></button>
					<button type="button" className="mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-500 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100" disabled={busyId !== null} onClick={() => { if (window.confirm(t("agent.panel.deleteConfirm", { title: item.title }))) onDelete(item.id); }} aria-label={t("agent.panel.deleteChatLabel", { title: item.title })} title={t("agent.panel.deleteChat")}><Trash2 size={14} /></button>
				</>}
			</li>)}</ul>
		</section>)}
	</div>;
}
