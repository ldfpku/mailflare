"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { prefetchAuthGets } from "@/lib/auth/client";
import { useLanguage } from "@/components/language-provider";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useSelectedMailbox } from "@/components/mailbox-provider";
import { cn } from "@/lib/utils";
import { SectionNavSheet } from "../section-nav-sheet";
import { isActiveSettingsPath, settingsNavSections, settingsWarmUpUrls } from "./settings-nav-utils";

export function SettingsNav() {
	const { t } = useLanguage();
	const pathname = usePathname();
	const user = useCurrentUser();
	const { selectedMailbox } = useSelectedMailbox();
	const mailboxId = selectedMailbox?.id;
	const canManageMailboxes = user?.canManageMailboxes === true;
	const sections = settingsNavSections.map((section) => ({
		...section,
		items: section.items.filter((item) => !item.requiresMailboxAccess || canManageMailboxes),
	}));
	const currentItem = sections.flatMap((section) => section.items).find((item) => isActiveSettingsPath(pathname, item.href));
	const currentLabel = t(currentItem?.labelKey ?? "settings.nav.settings");

	// Once the open page has asked for its own data, fetch what the other pages need.
	useEffect(() => {
		const timer = window.setTimeout(() => prefetchAuthGets(settingsWarmUpUrls), 400);
		return () => window.clearTimeout(timer);
	}, []);
	useEffect(() => {
		if (!mailboxId) return;
		const timer = window.setTimeout(() => prefetchAuthGets([`/api/routing-rules?${new URLSearchParams({ mailboxId })}`]), 400);
		return () => window.clearTimeout(timer);
	}, [mailboxId]);

	return (
		<SectionNavSheet title={t("settings.nav.menu")} label={currentLabel} className="w-full px-4 py-4 md:min-h-full md:w-64 md:border-r md:border-blue-100/70 md:py-10">
			<div className="sticky top-6 space-y-7">
				{sections.map((section) => (
					<div key={section.labelKey} className="space-y-3">
						<h2 className="px-4 text-xs font-semibold uppercase tracking-wide text-neutral-500">
							{t(section.labelKey)}
						</h2>
						<nav aria-label={t(section.labelKey)} className="space-y-px">
							{section.items.map((item) => {
								const active = isActiveSettingsPath(pathname, item.href);
								return (
									<Link
										key={item.href}
										href={item.href}
										// Full prefetch: the page is ready before the click instead of a server round trip after it.
										prefetch
										className={cn(
											"block rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
											active
												? "bg-blue-100 text-blue-900"
												: "text-neutral-600 hover:bg-white/70 hover:text-neutral-900",
										)}
									>
										{t(item.labelKey)}
									</Link>
								);
							})}
						</nav>
					</div>
				))}
			</div>
		</SectionNavSheet>
	);
}
