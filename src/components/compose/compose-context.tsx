"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AUTH_SESSION_CHANGED_EVENT } from "@/lib/auth/client";
import { canLeaveMailEditor } from "./mail-navigation-guard";

type ComposeContextValue = {
	open: boolean;
	draftId: string | null;
	presentation: "popup" | "page";
	pageSlot: HTMLDivElement | null;
	setPageSlot: (slot: HTMLDivElement | null) => void;
	openComposer: () => void;
	openPageComposer: () => void;
	openDraftComposer: (draftId: string) => void;
	closeComposer: () => void;
	notice: string | null;
	showNotice: (message: string) => void;
};

const ComposeContext = createContext<ComposeContextValue | null>(null);

export function useCompose() {
	const ctx = useContext(ComposeContext);
	if (!ctx) throw new Error("useCompose must be used within ComposeProvider");
	return ctx;
}

export function ComposeProvider({ children }: { children: ReactNode }) {
	const [open, setOpen] = useState(false);
	const [draftId, setDraftId] = useState<string | null>(null);
	const [presentation, setPresentation] = useState<"popup" | "page">("popup");
	const [pageSlot, setPageSlot] = useState<HTMLDivElement | null>(null);
	const opener = useRef<HTMLElement | null>(null);

	function rememberOpener() {
		opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
	}
	const [notice, setNotice] = useState<string | null>(null);

	useEffect(() => {
		if (!notice) return;
		const timer = setTimeout(() => setNotice(null), 3200);
		return () => clearTimeout(timer);
	}, [notice]);

	useEffect(() => {
		const onSessionChanged = () => {
			if (canLeaveMailEditor()) {
				setOpen(false);
				setDraftId(null);
				opener.current = null;
			}
		};
		window.addEventListener(AUTH_SESSION_CHANGED_EVENT, onSessionChanged);
		return () => window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, onSessionChanged);
	}, []);

	return (
		<ComposeContext.Provider
			value={{
				open,
				draftId,
				presentation,
				pageSlot,
				setPageSlot,
				openComposer: () => {
					if (open) return;
					if (!canLeaveMailEditor(true)) return;
					rememberOpener();
					setPresentation("popup");
					setDraftId(null);
					setOpen(true);
				},
				openPageComposer: () => {
					if (!open) {
						if (!canLeaveMailEditor(true)) return;
						rememberOpener();
						setDraftId(null);
						setOpen(true);
					}
					setPresentation("page");
				},
				openDraftComposer: (nextDraftId) => {
					if (open && draftId === nextDraftId) return;
					if (!canLeaveMailEditor(true)) return;
					if (!open) rememberOpener();
					setPresentation("popup");
					setDraftId(nextDraftId);
					setOpen(true);
				},
				closeComposer: () => {
					setOpen(false);
					setDraftId(null);
					const previous = opener.current;
					opener.current = null;
					if (previous) requestAnimationFrame(() => { if (previous.isConnected) previous.focus(); });
				},
				notice,
				showNotice: setNotice,
			}}
		>
			{children}
		</ComposeContext.Provider>
	);
}
