"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";

export function useDismissible(open: boolean, onClose: () => void, container: RefObject<HTMLElement | null>) {
	const close = useRef(onClose);
	// 把「最新回调」写入 ref 的操作移到 effect 中执行，避免在渲染期读写 ref.current（refs 规则）。
	useEffect(() => { close.current = onClose; }, [onClose]);

	useEffect(() => {
		if (!open) return;

		function onKeyDown(event: KeyboardEvent) {
			if (event.key !== "Escape") return;
			event.stopPropagation();
			close.current();
			container.current?.querySelector<HTMLElement>("[aria-expanded]")?.focus();
		}
		function onPointerDown(event: PointerEvent) {
			if (!container.current?.contains(event.target as Node)) close.current();
		}
		function onFocusIn(event: FocusEvent) {
			if (!container.current?.contains(event.target as Node)) close.current();
		}

		document.addEventListener("keydown", onKeyDown);
		document.addEventListener("pointerdown", onPointerDown);
		document.addEventListener("focusin", onFocusIn);
		return () => {
			document.removeEventListener("keydown", onKeyDown);
			document.removeEventListener("pointerdown", onPointerDown);
			document.removeEventListener("focusin", onFocusIn);
		};
	}, [open, container]);
}
