"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { DesktopOs, DesktopReleaseInfo } from "@/lib/desktop/release-types";
import type { TranslationKey } from "@/lib/i18n/types";
import { detectDesktopOs } from "@/lib/desktop/release-utils";
import { formatUserDate } from "@/lib/time/utils";

type State = { status: "loading" } | { status: "error" } | { status: "ready"; release: DesktopReleaseInfo | null };

const OS_LABEL: Record<DesktopOs, TranslationKey> = {
	windows: "settingsPage.desktop.windows",
	macos: "settingsPage.desktop.macos",
};

function formatSize(bytes: number): string {
	return bytes > 0 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : "";
}

/** Settings > Desktop app: the latest SMJ desktop release from DESKTOP_BUCKET, this computer's system first. */
export function DesktopDownloadSettings() {
	const { t } = useLanguage();
	const [state, setState] = useState<State>({ status: "loading" });
	// Read in the browser only; the release list renders after the fetch, so server and client markup agree
	const [os] = useState<DesktopOs | null>(() => (typeof navigator === "undefined" ? null : detectDesktopOs(navigator.userAgent)));

	useEffect(() => {
		let cancelled = false;
		fetch("/api/desktop/latest")
			.then((res) => (res.ok ? (res.json() as Promise<{ release: DesktopReleaseInfo | null }>) : Promise.reject(new Error(String(res.status)))))
			.then((data) => { if (!cancelled) setState({ status: "ready", release: data.release }); })
			.catch(() => { if (!cancelled) setState({ status: "error" }); });
		return () => { cancelled = true; };
	}, []);

	if (state.status === "loading") {
		return <div className="space-y-3" aria-label={t("settingsPage.desktop.loading")}>
			<Skeleton className="h-6 w-40" />
			<Skeleton className="h-16 w-full" />
		</div>;
	}
	if (state.status === "error") return <p className="text-sm text-neutral-500">{t("settingsPage.desktop.loadFailed")}</p>;
	const release = state.release;
	if (!release || release.downloads.length === 0) return <p className="text-sm text-neutral-500">{t("settingsPage.desktop.notPublished")}</p>;

	const downloads = [...release.downloads].sort((a, b) => Number(b.os === os) - Number(a.os === os));
	const notes = release.notes.split("\n").map((line) => line.replace(/^\s*[-*]\s*/, "").trim()).filter(Boolean);

	return <div className="space-y-6">
		<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
			<span className="text-lg font-semibold text-neutral-900">{t("settingsPage.desktop.version", { version: release.version })}</span>
			{release.publishedAt && <span className="text-sm text-neutral-500">{t("settingsPage.desktop.published", { date: formatUserDate(release.publishedAt, { dateStyle: "medium" }) })}</span>}
		</div>
		<ul className="space-y-3">
			{downloads.map((item) => <li key={item.os} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-200 p-4">
				<div className="min-w-0">
					<p className="font-medium text-neutral-900">
						{t(OS_LABEL[item.os])}
						{item.os === os && <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-normal text-blue-700">{t("settingsPage.desktop.recommended")}</span>}
					</p>
					<p className="truncate text-sm text-neutral-500">{item.fileName}{item.size > 0 && ` · ${formatSize(item.size)}`}</p>
				</div>
				<Button asChild variant={item.os === os || !os ? "default" : "outline"}>
					<a href={item.url} download={item.fileName} title={item.fileName}>
						<Download className="size-4" aria-hidden />
						{t("settingsPage.desktop.download")}
					</a>
				</Button>
			</li>)}
		</ul>
		{notes.length > 0 && <div>
			<h2 className="text-sm font-semibold text-neutral-900">{t("settingsPage.desktop.notes")}</h2>
			<ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-600">
				{notes.map((line, index) => <li key={index}>{line}</li>)}
			</ul>
		</div>}
		<div>
			<h2 className="text-sm font-semibold text-neutral-900">{t("settingsPage.desktop.installTitle")}</h2>
			<dl className="mt-2 space-y-3 text-sm text-neutral-600">
				{downloads.map((item) => <div key={item.os}>
					<dt className="font-medium text-neutral-800">{t(OS_LABEL[item.os])}</dt>
					<dd className="mt-1">{t(item.os === "windows" ? "settingsPage.desktop.windowsSteps" : "settingsPage.desktop.macSteps")}</dd>
				</div>)}
			</dl>
			<p className="mt-3 text-sm text-neutral-600">{t("settingsPage.desktop.updates")}</p>
		</div>
	</div>;
}
