"use client";

import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { useSidebar } from "@/components/sidebar-state";
import { useAssistantOpen } from "@/components/agent/assistant-open-state";
import { readColumnWidth, readInitialColumnWidth, saveColumnWidth } from "@/components/column-width-preferences";
import { ResizeHandle } from "@/components/ui/resize-handle";
import { BulkMessageSelectionPane } from "./bulk-message-selection-pane";
import { MessageFolderPage } from "./message-folder-page";
import { MessageDetailNavigationProvider } from "./message-detail-navigation";
import { MessageListVisibilityContext } from "./message-list-visibility";
import { readInitialMessageListVisible, saveMessageListVisible } from "./message-list-visibility-utils";
import { useTwoColumnReading } from "./use-two-column-reading";
import type { MessageSplitLayoutProps, SelectedMessage } from "./types";

export function MessageSplitLayout({
	children,
	config,
}: MessageSplitLayoutProps) {
	const pathname = usePathname();
	const [selectedMessages, setSelectedMessages] = useState<SelectedMessage[]>([]);
	const [listWidth, setListWidth] = useState(360);
	const [widthReady, setWidthReady] = useState(false);
	const [containerWidth, setContainerWidth] = useState(0);
	const [manualListVisible, setManualListVisible] = useState(true);
	const [twoColumnReading] = useTwoColumnReading();
	const containerRef = useRef<HTMLDivElement>(null);
	const startWidth = useRef(listWidth);
	const resizedWidth = useRef(listWidth);
	const { t } = useLanguage();
	const { userId, setForcedMinimal } = useSidebar();
	const assistantOpen = useAssistantOpen();
	const listVisible = twoColumnReading && !assistantOpen && manualListVisible;
	const detailPrefix = `${config.hrefPrefix}/`;
	const selectedMessageId = pathname.startsWith(detailPrefix)
		? pathname.slice(detailPrefix.length).split("/")[0]
		: undefined;
	const renderedListWidth = Math.max(250, Math.min(listWidth, (containerWidth || 1000) - 280));

	useLayoutEffect(() => {
		// 外部系统同步：挂载时从 localStorage 读取列宽与列表可见偏好，读完后再用 rAF 启用过渡动画，
		// SSR 阶段无 localStorage，故必须在挂载后的 effect 中 setState。
		// eslint-disable-next-line react/set-state-in-effect
		setListWidth(readInitialColumnWidth("message-list", 360, 250, 1200));
		setManualListVisible(readInitialMessageListVisible());
		const frame = requestAnimationFrame(() => setWidthReady(true));
		return () => cancelAnimationFrame(frame);
	}, []);

	useEffect(() => {
		if (!userId) return;
		// 外部系统同步：拿到 userId 后从该用户的持久化偏好读取列宽并回写，属于与 localStorage 的同步。
		const savedWidth = readColumnWidth(userId, "message-list", readInitialColumnWidth("message-list", 360, 250, 1200), 250, 1200);
		// eslint-disable-next-line react/set-state-in-effect
		setListWidth(savedWidth);
		saveColumnWidth(userId, "message-list", savedWidth);
	}, [userId]);

	useLayoutEffect(() => {
		if (!selectedMessageId) {
			setForcedMinimal(false);
			return;
		}
		const container = containerRef.current;
		if (!container) return;
		// 外部系统同步：测量容器宽度并用 ResizeObserver 订阅后续尺寸变化，属于与 DOM 布局的同步。
		// eslint-disable-next-line react/set-state-in-effect
		setContainerWidth(container.clientWidth);
		const observer = new ResizeObserver(() => setContainerWidth(container.clientWidth));
		observer.observe(container);
		return () => observer.disconnect();
	}, [selectedMessageId, setForcedMinimal]);

	useEffect(() => () => setForcedMinimal(false), [setForcedMinimal]);

	if (!selectedMessageId) return children;

	return (
		<div ref={containerRef} className="h-full min-h-0 overflow-hidden lg:grid lg:transition-[grid-template-columns] lg:ease-in-out motion-reduce:transition-none" style={{ gridTemplateColumns: twoColumnReading ? `${listVisible ? renderedListWidth : 0}px minmax(0,1fr)` : "minmax(0,1fr)", transitionDuration: widthReady ? "300ms" : "0ms" }}>
			{twoColumnReading && (
			<aside className={`relative hidden min-h-0 min-w-0 overflow-hidden bg-white lg:block ${listVisible ? "border-r border-neutral-200" : "pointer-events-none"}`} aria-hidden={!listVisible} inert={!listVisible}>
				<div className={`h-full overflow-hidden transition-transform duration-300 ease-in-out motion-reduce:transition-none ${listVisible ? "translate-x-0" : "-translate-x-full"}`} style={{ width: renderedListWidth }}>
				<MessageFolderPage
					config={config}
					compact
					selectedMessageId={selectedMessageId}
					selection={{ selectedMessages, setSelectedMessages }}
				/>
				</div>
				<ResizeHandle
					label={t("list.resize")}
					onResizeStart={() => { startWidth.current = listWidth; resizedWidth.current = listWidth; }}
					onResize={(delta) => {
						const requestedWidth = startWidth.current + delta;
						setForcedMinimal(requestedWidth < 250);
						resizedWidth.current = Math.max(250, Math.min(requestedWidth, Math.max(250, (containerRef.current?.clientWidth ?? 1000) - 280)));
						setListWidth(resizedWidth.current);
					}}
					onResizeEnd={() => saveColumnWidth(userId, "message-list", resizedWidth.current)}
				/>
			</aside>
			)}
			<MessageListVisibilityContext.Provider value={{ visible: listVisible, toggle: () => { const visible = !manualListVisible; setManualListVisible(visible); saveMessageListVisible(visible); }, singleColumn: !twoColumnReading, backHref: config.hrefPrefix, backLabel: config.titleKey ? t(config.titleKey) : config.title }}>
			<MessageDetailNavigationProvider config={config}>
			<section className="min-h-0 min-w-0 overflow-hidden bg-white flex flex-col h-full">
				{twoColumnReading && selectedMessages.length > 0 ? (
					<BulkMessageSelectionPane
						folder={config.folder}
						selectedMessages={selectedMessages}
						onClearSelection={() => setSelectedMessages([])}
					/>
				) : (
					children
				)}
			</section>
			</MessageDetailNavigationProvider>
			</MessageListVisibilityContext.Provider>
		</div>
	);
}
