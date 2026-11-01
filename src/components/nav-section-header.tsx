"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { readStorage, writeStorage } from "./reorderable-list-utils";

/** Open/closed state of a menu section, remembered in localStorage. Starts open. */
export function useSectionOpen(storageKey: string): [boolean, () => void] {
	const [open, setOpen] = useState(true);
	// 从 localStorage 读取持久化的展开状态属于与外部系统同步：SSR 阶段没有 localStorage，
	// 只能在挂载后读取以避免 hydration 不匹配，所以这里必须在 effect 里 setState。
	// eslint-disable-next-line react/set-state-in-effect
	useEffect(() => { setOpen(readStorage(storageKey, true)); }, [storageKey]);
	function toggle() {
		writeStorage(storageKey, !open);
		setOpen(!open);
	}
	return [open, toggle];
}

/** Collapsible section label: small uppercase text behind a chevron that turns when the section opens. */
export function NavSectionHeader({ label, open, onToggle, children }: { label: string; open: boolean; onToggle: () => void; children?: ReactNode }) {
	return (
		<div className="mt-2 flex h-9 shrink-0 items-center justify-between gap-1 ml-3 mr-2 hover:bg-neutral-200/60 rounded-full pr-2">
			<button type="button" onClick={onToggle} aria-expanded={open} className="flex h-9 min-w-0 flex-1 items-center gap-2 pl-3 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500 max-md:text-sm">
				<ChevronRight className={cn("h-3.5 w-3.5 shrink-0 transition-transform", open && "rotate-90")} />
				<span className="truncate">{label}</span>
			</button>
			{children}
		</div>
	);
}
