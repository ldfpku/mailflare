"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { MailTodoDialogProps } from "./types";
import { draftMessageTodo, fromDateTimeLocal, saveMessageTodo, toDateTimeLocal } from "./utils";

/** "转为待办": Workers AI drafts a to-do from the mail, the reader edits it and saves it to 我的待办 in chat. */
export function MailTodoDialog({ messageId, open, onOpenChange }: MailTodoDialogProps) {
	const { t } = useLanguage();
	const [drafting, setDrafting] = useState(false);
	const [saving, setSaving] = useState(false);
	const [title, setTitle] = useState("");
	const [due, setDue] = useState("");
	const [notes, setNotes] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);

	useEffect(() => {
		if (!open) return;
		let cancelled = false;
		setTitle("");
		setDue("");
		setNotes("");
		setError(null);
		setNotice(null);
		setDrafting(true);
		draftMessageTodo(messageId)
			.then((draft) => {
				if (cancelled) return;
				setTitle(draft.title);
				setDue(toDateTimeLocal(draft.dueAt));
				setNotes(draft.notes);
			})
			.catch((draftError) => !cancelled && setError(draftError instanceof Error && draftError.message ? draftError.message : t("mailTodo.draftFailed")))
			.finally(() => !cancelled && setDrafting(false));
		return () => {
			cancelled = true;
		};
	}, [open, messageId, t]);

	async function handleSave() {
		setSaving(true);
		setError(null);
		try {
			await saveMessageTodo(messageId, { title: title.trim(), notes, dueAt: fromDateTimeLocal(due) });
			setNotice(t("mailTodo.saved"));
			setTimeout(() => onOpenChange(false), 1200);
		} catch (saveError) {
			setError(saveError instanceof Error && saveError.message ? saveError.message : t("mailTodo.saveFailed"));
		} finally {
			setSaving(false);
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[calc(100vh-4rem)] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>{t("mailTodo.title")}</DialogTitle>
					<DialogDescription>{t("mailTodo.description")}</DialogDescription>
				</DialogHeader>
				{drafting ? (
					<p role="status" className="flex items-center gap-2 py-6 text-sm text-neutral-500">
						<Sparkles className="h-4 w-4 animate-pulse text-[#034fbc]" />
						{t("mailTodo.drafting")}
					</p>
				) : (
					<div className="space-y-3">
						<div className="space-y-1">
							<Label htmlFor="mail-todo-title">{t("mailTodo.fieldTitle")}</Label>
							<Input id="mail-todo-title" value={title} maxLength={100} onChange={(event) => setTitle(event.target.value)} />
						</div>
						<div className="space-y-1">
							<Label htmlFor="mail-todo-due">{t("mailTodo.fieldDue")}</Label>
							<Input id="mail-todo-due" type="datetime-local" value={due} onChange={(event) => setDue(event.target.value)} />
						</div>
						<div className="space-y-1">
							<Label htmlFor="mail-todo-notes">{t("mailTodo.fieldNotes")}</Label>
							<Textarea id="mail-todo-notes" rows={5} value={notes} maxLength={2000} onChange={(event) => setNotes(event.target.value)} />
						</div>
					</div>
				)}
				{error && <p role="alert" className="text-sm text-red-600">{error}</p>}
				{notice && <p role="status" className="text-sm text-green-700">{notice}</p>}
				<Button type="button" onClick={() => void handleSave()} disabled={drafting || saving || !title.trim() || notice !== null}>
					{saving ? t("mailTodo.saving") : t("mailTodo.save")}
				</Button>
			</DialogContent>
		</Dialog>
	);
}
