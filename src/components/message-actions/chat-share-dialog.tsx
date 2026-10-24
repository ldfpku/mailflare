"use client";

import { useEffect, useMemo, useState } from "react";
import { MessagesSquare, Users } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { ChatShareDialogProps, ChatShareTarget } from "./types";
import { fetchChatShareTargets, filterChatShareTargets, shareMessageToChats } from "./utils";

export function ChatShareDialog({ messageId, open, onOpenChange }: ChatShareDialogProps) {
	const { t } = useLanguage();
	const [targets, setTargets] = useState<ChatShareTarget[] | null>(null);
	const [query, setQuery] = useState("");
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [sharing, setSharing] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);

	useEffect(() => {
		if (!open) return;
		let cancelled = false;
		setTargets(null);
		setSelected(new Set());
		setQuery("");
		setError(null);
		setNotice(null);
		fetchChatShareTargets(messageId)
			.then((next) => !cancelled && setTargets(next))
			.catch(() => !cancelled && (setTargets([]), setError(t("chatShare.loadFailed"))));
		return () => {
			cancelled = true;
		};
	}, [open, messageId, t]);

	const visible = useMemo(() => filterChatShareTargets(targets ?? [], query), [targets, query]);

	function toggle(roomId: string) {
		setSelected((current) => {
			const next = new Set(current);
			if (next.has(roomId)) next.delete(roomId);
			else next.add(roomId);
			return next;
		});
	}

	async function handleShare() {
		setSharing(true);
		setError(null);
		try {
			const count = await shareMessageToChats(messageId, [...selected]);
			setNotice(t("chatShare.done", { count }));
			setSelected(new Set());
			setTimeout(() => onOpenChange(false), 900);
		} catch (shareError) {
			setError(shareError instanceof Error && shareError.message ? shareError.message : t("chatShare.failed"));
		} finally {
			setSharing(false);
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[calc(100vh-4rem)] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>{t("chatShare.title")}</DialogTitle>
					<DialogDescription>{t("chatShare.description")}</DialogDescription>
				</DialogHeader>
				<div className="space-y-3">
					<Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("chatShare.search")} aria-label={t("chatShare.search")} />
					<div className="max-h-72 space-y-1 overflow-y-auto">
						{targets === null && <p className="px-2 py-4 text-sm text-neutral-500">…</p>}
						{targets !== null && visible.length === 0 && <p className="px-2 py-4 text-sm text-neutral-500">{t("chatShare.empty")}</p>}
						{visible.map((target) => (
							<label key={target.roomId} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-neutral-100">
								<Checkbox checked={selected.has(target.roomId)} onChange={() => toggle(target.roomId)} />
								{target.avatar ? (
									// eslint-disable-next-line @next/next/no-img-element
									<img src={target.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
								) : (
									<span className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 text-neutral-500">
										{target.type === 1 ? <Users className="h-4 w-4" /> : <MessagesSquare className="h-4 w-4" />}
									</span>
								)}
								<span className="min-w-0 flex-1 truncate text-sm text-neutral-800">{target.name}</span>
								{target.type === 1 && target.memberNum ? (
									<span className="text-xs text-neutral-500">{t("chatShare.members", { count: target.memberNum })}</span>
								) : null}
							</label>
						))}
					</div>
					{error && <p role="alert" className="text-sm text-red-600">{error}</p>}
					{notice && <p role="status" className="text-sm text-green-700">{notice}</p>}
					<Button type="button" onClick={() => void handleShare()} disabled={sharing || selected.size === 0}>
						{sharing ? t("chatShare.sharing") : t("chatShare.submit")}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
