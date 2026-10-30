"use client";

import { MailPlus } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useLayoutEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { ComposeForm } from "@/components/compose/compose-form";
import { useCompose } from "@/components/compose/compose-context";
import { useSidebar } from "@/components/sidebar-state";
import { useLanguage } from "@/components/language-provider";

export function FloatingComposeButton() {
	const { open, openComposer } = useCompose();
	const pathname = usePathname();
	const { t } = useLanguage();
	const { mobileOpen } = useSidebar();
	if (open || mobileOpen || pathname === "/compose") return null;
	return (
		<button
			type="button"
			onClick={openComposer}
			aria-label={t("navigation.compose")}
			className="fixed right-[max(1rem,env(safe-area-inset-right))] bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 flex h-12 items-center gap-3 rounded-2xl bg-blue-100 px-5 text-base font-medium text-blue-950 shadow-sm transition-colors hover:bg-blue-200 active:bg-blue-200 md:hidden"
		>
			<MailPlus size={19} />
			{t("navigation.compose")}
		</button>
	);
}

function placeComposer(container: HTMLDivElement, slot: HTMLDivElement | null, isPage: boolean) {
	// Moving the same portal container preserves the editor across route changes.
	(slot ?? document.body).appendChild(container);
	container.className = slot ? "h-full min-h-[720px] w-full max-w-4xl" : "";
	container.style.display = isPage && !slot ? "none" : "";
}

const subscribeToMount = () => () => {};
const mounted = () => true;
const notMounted = () => false;

export function FloatingComposer() {
	const { open, draftId, presentation, pageSlot, closeComposer, notice } = useCompose();
	const pathname = usePathname();
	const router = useRouter();
	const [container] = useState<HTMLDivElement | null>(() =>
		typeof document === "undefined" ? null : document.createElement("div"),
	);
	const isMounted = useSyncExternalStore(subscribeToMount, mounted, notMounted);
	const isPage = presentation === "page" && pathname === "/compose";

	useLayoutEffect(() => {
		if (!container || !isMounted) return;
		const slot = isPage && pageSlot?.isConnected ? pageSlot : null;
		placeComposer(container, slot, isPage);
		return () => { container.remove(); };
	}, [container, isMounted, isPage, pageSlot]);

	return (
		<>
			{notice && (
				<div role="status" className="fixed right-6 top-6 z-[60] rounded-lg bg-green-600 px-4 py-3 text-sm font-medium text-white shadow-lg">
					{notice}
				</div>
			)}
			{isMounted && container && open && createPortal(<ComposeForm key={draftId ?? "new"} mode={isPage ? "page" : "popup"} draftIdToLoad={draftId} onClose={() => {
				closeComposer();
				if (/^\/drafts\/[^/]+\/?$/.test(pathname)) router.replace("/drafts");
			}} />, container)}
		</>
	);
}
