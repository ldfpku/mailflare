"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import QRCode from "qrcode";
import { Copy } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import type { TranslationKey } from "@/lib/i18n/types";
import { detectMobileOs, mobileAppUrl, type MobileOs } from "./mobile-app-settings-utils";

// Line icons drawn in the IconPark style (48 grid, 4 px round strokes) so they need no external assets
function LineIcon({ children, label }: { children: ReactNode; label?: string }) {
	return <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" className="size-5 shrink-0" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>{children}</svg>;
}

const PhoneIcon = () => <LineIcon><rect x="11" y="4" width="26" height="40" rx="3" /><path d="M21 37h6" /></LineIcon>;
const ShareIcon = () => <LineIcon><path d="M17 18h-7v24h28V18h-7" /><path d="M24 30V5" /><path d="M16 12l8-8 8 8" /></LineIcon>;
const AddSquareIcon = () => <LineIcon><rect x="6" y="6" width="36" height="36" rx="3" /><path d="M24 16v16M16 24h16" /></LineIcon>;
const MoreIcon = () => <LineIcon><circle cx="24" cy="10" r="1.5" fill="currentColor" /><circle cx="24" cy="24" r="1.5" fill="currentColor" /><circle cx="24" cy="38" r="1.5" fill="currentColor" /></LineIcon>;
const InstallIcon = () => <LineIcon><path d="M24 6v24" /><path d="M14 20l10 10 10-10" /><path d="M8 34v8h32v-8" /></LineIcon>;
const HomeIcon = () => <LineIcon><path d="M9 18v24h30V18L24 6 9 18z" /><path d="M19 29v13h10V29H19z" /></LineIcon>;

type Step = { key: TranslationKey; icon: () => ReactNode };

const GUIDES: { os: MobileOs; title: TranslationKey; steps: Step[] }[] = [
	{
		os: "ios",
		title: "settingsPage.mobile.ios",
		steps: [
			{ key: "settingsPage.mobile.iosStep1", icon: PhoneIcon },
			{ key: "settingsPage.mobile.iosStep2", icon: ShareIcon },
			{ key: "settingsPage.mobile.iosStep3", icon: AddSquareIcon },
			{ key: "settingsPage.mobile.iosStep4", icon: HomeIcon },
		],
	},
	{
		os: "android",
		title: "settingsPage.mobile.android",
		steps: [
			{ key: "settingsPage.mobile.androidStep1", icon: PhoneIcon },
			{ key: "settingsPage.mobile.androidStep2", icon: MoreIcon },
			{ key: "settingsPage.mobile.androidStep3", icon: InstallIcon },
			{ key: "settingsPage.mobile.androidStep4", icon: HomeIcon },
		],
	},
];

const TIPS: TranslationKey[] = [
	"settingsPage.mobile.tipInApp",
	"settingsPage.mobile.tipInstalled",
	"settingsPage.mobile.tipUpdates",
	"settingsPage.mobile.tipFeatures",
];

type BrowserEnv = { url: string; os: MobileOs | null };

let browserEnv: BrowserEnv | null = null;
const subscribeNever = () => () => {};
// Cached so every snapshot is the same object, as useSyncExternalStore requires
function readBrowserEnv(): BrowserEnv {
	browserEnv ??= { url: mobileAppUrl(window.location.origin), os: detectMobileOs(navigator.userAgent, navigator.maxTouchPoints) };
	return browserEnv;
}

/** Settings > Mobile: phones have no installer, so this explains adding the web IM to the home screen. */
export function MobileAppSettings() {
	const { t } = useLanguage();
	// Read in the browser only: the server and hydration render without an address, then this fills it in
	const env = useSyncExternalStore(subscribeNever, readBrowserEnv, () => null);
	const [qr, setQr] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);

	// On a computer the quickest way onto the phone is to scan the address
	useEffect(() => {
		if (!env || env.os) return;
		let cancelled = false;
		QRCode.toDataURL(env.url, { margin: 1, width: 176, errorCorrectionLevel: "M", color: { dark: "#034fbc", light: "#ffffff" } })
			.then((url) => { if (!cancelled) setQr(url); })
			.catch(() => { if (!cancelled) setQr(null); });
		return () => { cancelled = true; };
	}, [env]);

	const os = env?.os ?? null;
	const guides = [...GUIDES].sort((a, b) => Number(b.os === os) - Number(a.os === os));

	return <div className="space-y-4">
		<div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-white p-4 sm:p-6">
			<div className="min-w-0 space-y-2">
				<p className="text-sm text-neutral-500">{t("settingsPage.mobile.address")}</p>
				<p className="break-all text-lg font-semibold text-[#034fbc]">{env?.url ?? " "}</p>
				<div className="flex flex-wrap gap-2">
					{os && env && <Button asChild>
						<a href={env.url}>{t("settingsPage.mobile.open")}</a>
					</Button>}
					<Button type="button" variant="outline" disabled={!env} onClick={() => env && void navigator.clipboard.writeText(env.url).then(() => setCopied(true))}>
						<Copy className="size-4" aria-hidden />
						{copied ? t("settingsPage.mobile.copied") : t("settingsPage.mobile.copy")}
					</Button>
				</div>
			</div>
			{qr && <figure className="flex flex-col items-center gap-2">
				{/* eslint-disable-next-line @next/next/no-img-element -- a data: URL drawn in the browser */}
				<img src={qr} alt={t("settingsPage.mobile.qrAlt")} width={176} height={176} className="rounded-xl border border-neutral-200" />
				<figcaption className="text-xs text-neutral-500">{t("settingsPage.mobile.qrHint")}</figcaption>
			</figure>}
		</div>
		<div className="grid gap-4 md:grid-cols-2">
			{guides.map((guide) => <section key={guide.os} className="rounded-3xl bg-white p-4 sm:p-6">
				<h2 className="flex flex-wrap items-center gap-2 font-semibold text-neutral-900">
					{t(guide.title)}
					{guide.os === os && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-normal text-blue-700">{t("settingsPage.mobile.thisPhone")}</span>}
				</h2>
				<ol className="mt-4 space-y-4">
					{guide.steps.map((step, index) => <li key={step.key} className="flex gap-3 text-sm text-neutral-700">
						<span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#034fbc] text-xs font-semibold text-white">{index + 1}</span>
						<span className="min-w-0 flex-1 pt-0.5">{t(step.key)}</span>
						<span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-blue-50/60 text-[#034fbc]"><step.icon /></span>
					</li>)}
				</ol>
			</section>)}
		</div>
		<div className="rounded-3xl bg-white p-4 sm:p-6">
			<h2 className="text-sm font-semibold text-neutral-900">{t("settingsPage.mobile.tipsTitle")}</h2>
			<ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-600">
				{TIPS.map((key) => <li key={key}>{t(key)}</li>)}
			</ul>
		</div>
	</div>;
}
