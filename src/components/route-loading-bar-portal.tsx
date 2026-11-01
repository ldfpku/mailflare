"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { RouteLoadingBar } from "./route-loading-bar";

// Pinned to the viewport top even when an ancestor's transform (e.g. a page transition) would otherwise become the fixed containing block.
export function RouteLoadingBarPortal() {
	const [mounted, setMounted] = useState(false);
	useEffect(() => {
		// 外部系统同步：挂载后才标记 mounted，以便在客户端用 document.body 作为 portal 目标（SSR 阶段没有 document）。
		// eslint-disable-next-line react/set-state-in-effect
		setMounted(true);
	}, []);
	if (!mounted) return <RouteLoadingBar />;
	return createPortal(<RouteLoadingBar />, document.body);
}
