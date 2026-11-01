"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { MouseEvent } from "react";
import { primeMessageDetail } from "@/lib/messages/detail-cache";
import type { Message } from "@/hooks/types";
import type { MessageNavigationState } from "./message-navigation-types";

export function useMessageNavigation(href: string, message: Message): MessageNavigationState {
	const pathname = usePathname();
	const router = useRouter();
	const [progress, setProgress] = useState<number | null>(null);

	// 导航完成（pathname 变化）时把进度条补到 100% 再延时清空，是对外部系统（路由切换 + 定时器）的同步。
	// 只应在路由变化时触发：把 progress 加进依赖会在 12→100→null 之间反复重跑并重置定时器，破坏动画。
	useEffect(() => {
		if (progress === null) return;
		// setState 发生在对外部系统（路由切换）的同步 effect 中，故豁免 set-state-in-effect。
		// eslint-disable-next-line react/set-state-in-effect
		setProgress(100);
		const timer = window.setTimeout(() => setProgress(null), 220);
		return () => window.clearTimeout(timer);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [pathname]);

	function onNavigate(event: MouseEvent<HTMLAnchorElement>, markRead = false) {
		if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
		event.preventDefault();
		primeMessageDetail({ ...message, read: markRead || message.read });
		setProgress(12);
		try {
			router.push(href);
		} catch {
			setProgress(null);
		}
	}

	return { progress, onNavigate };
}

export function MessageNavigationProgress({ progress }: { progress: number | null }) {
	if (progress === null) return null;
	return (
		<div className="fixed inset-x-0 top-0 z-[120] h-1 bg-blue-100">
			<div className="h-full bg-blue-600 transition-[width] duration-100 ease-out" style={{ width: `${progress}%` }} />
		</div>
	);
}
