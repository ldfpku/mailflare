"use client";

import { useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { authFetch } from "@/lib/auth/client";
import { ACCOUNT_RESTORE_DAYS } from "@/lib/accounts/deletion-utils";
import type { DeleteAccountsDialogProps } from "./accounts-table-types";

export function DeleteAccountsDialog({ open, onOpenChange, accounts, candidates, permanentOnly = false, onDeleted }: DeleteAccountsDialogProps) {
	const { t } = useLanguage();
	const [transferToId, setTransferToId] = useState("");
	const [permanentChoice, setPermanentChoice] = useState(false);
	const [deleting, setDeleting] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const doomed = new Set(accounts.map((account) => account.id));
	const permanent = permanentOnly || permanentChoice;
	const recipients = candidates.filter((account) => !doomed.has(account.id) && !account.disabled && !account.deletedAt);

	async function confirm() {
		setDeleting(true);
		setMessage(null);
		try {
			const response = await authFetch("/api/accounts", {
				method: "DELETE",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ ids: accounts.map((account) => account.id), transferToId: permanentOnly ? null : transferToId || null, permanent }),
			});
			const data = (await response.json()) as { error?: string };
			if (!response.ok) throw new Error(data.error ?? t("accounts.deleteFailed"));
			setTransferToId("");
			setPermanentChoice(false);
			onDeleted();
		} catch (error) {
			setMessage(error instanceof Error ? error.message : t("accounts.deleteFailed"));
		} finally {
			setDeleting(false);
		}
	}

	return <Dialog open={open} onOpenChange={(next) => { if (!deleting) { setMessage(null); setPermanentChoice(false); onOpenChange(next); } }}>
		<DialogContent className="max-h-[calc(100dvh-4rem)] w-[min(520px,calc(100vw-32px))] overflow-y-auto">
			<DialogHeader><DialogTitle>{t(permanentOnly ? "accounts.purgeTitle" : "accounts.deleteTitle", { count: accounts.length })}</DialogTitle><DialogDescription>{permanentOnly ? t("accounts.purgeDescription") : t("accounts.deleteDescription", { days: ACCOUNT_RESTORE_DAYS })}</DialogDescription></DialogHeader>
			<ul className="space-y-1 text-sm text-neutral-700">{accounts.map((account) => <li key={account.id} className="truncate">{account.name} <span className="text-neutral-500">{account.email}</span></li>)}</ul>
			{!permanentOnly && <div className="space-y-2"><Label htmlFor="transfer-account">{t("accounts.transferLabel")}</Label>
				<Select id="transfer-account" value={transferToId} onChange={(event) => setTransferToId(event.target.value)} disabled={deleting} containerClassName="h-10 w-full bg-white px-0" className="px-3 text-sm"><option value="">{t("accounts.transferNone")}</option>{recipients.map((account) => <option key={account.id} value={account.id}>{account.name} ({account.email})</option>)}</Select>
				<p className="text-xs text-neutral-500">{t("accounts.transferHint")}</p></div>}
			{!permanentOnly && <label className="flex items-start gap-2 text-sm text-neutral-700"><Checkbox className="mt-0.5" checked={permanentChoice} disabled={deleting} onChange={(event) => setPermanentChoice(event.target.checked)} /><span>{t("accounts.deletePermanently")}</span></label>}
			{permanent && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{t("accounts.permanentWarning")}</p>}
			{message && <p role="alert" className="text-sm text-red-600">{message}</p>}
			<div className="flex justify-end gap-2"><Button variant="outline" disabled={deleting} onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button><Button variant="destructive" disabled={deleting || !accounts.length} onClick={confirm}>{deleting ? t("accounts.deleting") : t(permanent ? "accounts.confirmPurge" : "accounts.confirmDelete")}</Button></div>
		</DialogContent>
	</Dialog>;
}
