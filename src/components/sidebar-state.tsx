"use client";

import { createContext, useContext, useEffect, useLayoutEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { fetchCurrentUser } from "@/hooks/use-current-user";
import { readColumnWidth, readInitialColumnWidth, saveColumnWidth } from "./column-width-preferences";
import { isMobileViewport, useIsMobile } from "./sidebar-mobile-utils";
import { readInitialSidebarMinimal, saveInitialSidebarMinimal, syncInitialSidebarWidth } from "./sidebar-state-utils";
import type { SidebarProviderProps, SidebarState } from "./sidebar-state-types";

const SidebarContext = createContext<SidebarState>({ minimal: false, width: 260, userId: null, toggle: () => undefined, setWidth: () => undefined, setForcedMinimal: () => undefined, mobile: false, mobileOpen: false });

export function SidebarProvider({ children, expandedWidth = 260, mobileOverlay = false }: SidebarProviderProps) {
	const [minimal, setMinimal] = useState(false);
	const [forcedMinimal, setForcedMinimal] = useState(false);
	const [width, setWidth] = useState(expandedWidth);
	const [widthReady, setWidthReady] = useState(false);
	const [userId, setUserId] = useState<string | null>(null);
	const [storageKey, setStorageKey] = useState<string | null>(null);
	const pathname = usePathname();
	const mobile = useIsMobile();
	const [mobileOpen, setMobileOpen] = useState(false);
	// Overlay layouts have no minified rail on phones: the menu is either fully shown over the page or hidden.
	const overlay = mobileOverlay && mobile;

	useEffect(() => {
		// 外部系统同步：路由或视口变化时关闭移动端抽屉，避免覆盖层残留打开。
		// eslint-disable-next-line react/set-state-in-effect
		setMobileOpen(false);
	}, [pathname, mobile]);

	// Collapse on first load and after every navigation on phones, so the overlay never sticks open.
	useEffect(() => {
		// 外部系统同步：手机视口下首次加载与每次导航后折叠侧边栏。
		// eslint-disable-next-line react/set-state-in-effect
		if (mobile) setMinimal(true);
	}, [pathname, mobile]);

	useEffect(() => {
		// 外部系统同步：非移动端时从持久化偏好恢复折叠状态。
		// eslint-disable-next-line react/set-state-in-effect
		if (!mobile) setMinimal(readInitialSidebarMinimal());
	}, [mobile]);

	useLayoutEffect(() => {
		// 外部系统同步：挂载时从 localStorage 读取折叠偏好与列宽，完成后再启用过渡动画。
		// eslint-disable-next-line react/set-state-in-effect
		setMinimal(readInitialSidebarMinimal());
		setWidth(readInitialColumnWidth("sidebar", expandedWidth, 200, 480));
		const frame = requestAnimationFrame(() => setWidthReady(true));
		return () => cancelAnimationFrame(frame);
	}, [expandedWidth]);

	useLayoutEffect(() => {
		syncInitialSidebarWidth(width, minimal);
	}, [width, minimal]);

	useEffect(() => {
		// The sidebar preference is cosmetic, so every failure here degrades to the default.
		void fetchCurrentUser()
			.then((user) => {
				const userId = user?.id;
					if (!userId) return;
					setUserId(userId);
					const key = `mailflare-sidebar-minimal:${userId}`;
				setStorageKey(key);
		if (isMobileViewport()) return;
				try {
						const storedMinimal = localStorage.getItem(key);
						const savedMinimal = storedMinimal === null ? readInitialSidebarMinimal() : storedMinimal === "true";
						setMinimal(savedMinimal);
						saveInitialSidebarMinimal(savedMinimal);
						localStorage.setItem(key, String(savedMinimal));
						const savedWidth = readColumnWidth(userId, "sidebar", readInitialColumnWidth("sidebar", expandedWidth, 200, 480), 200, 480);
						setWidth(savedWidth);
						saveColumnWidth(userId, "sidebar", savedWidth);
				} catch {
					// Storage can be unavailable in private windows; keep the default.
				}
			})
			.catch(() => undefined);
		// 仅在挂载时读取一次当前用户的持久化侧边栏偏好；expandedWidth 只作为默认值，不应因其变化而重新覆盖用户偏好。
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	function toggle() {
		if (overlay) {
			setMobileOpen((current) => !current);
			return;
		}
		if (forcedMinimal) {
			setForcedMinimal(false);
			setMinimal(false);
			if (!isMobileViewport()) {
				saveInitialSidebarMinimal(false);
				if (storageKey) localStorage.setItem(storageKey, "false");
			}
			return;
		}
		setMinimal((current) => {
			const next = !current;
			if (!isMobileViewport()) {
				saveInitialSidebarMinimal(next);
				if (storageKey) localStorage.setItem(storageKey, String(next));
			}
			return next;
		});
	}

	return (
		<SidebarContext.Provider value={{ minimal: !overlay && (minimal || forcedMinimal), width, userId, toggle, setWidth, setForcedMinimal, mobile: overlay, mobileOpen }}>
			<div className="h-full" style={{ "--sidebar-width": widthReady ? `${minimal || forcedMinimal ? 72 : width}px` : `var(--persisted-sidebar-width, ${expandedWidth}px)`, "--sidebar-transition-duration": widthReady ? "200ms" : "0ms" } as React.CSSProperties}>
				{children}
			</div>
		</SidebarContext.Provider>
	);
}

export function useSidebar() {
	return useContext(SidebarContext);
}
