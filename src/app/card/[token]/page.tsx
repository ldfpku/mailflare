"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Download, Globe, Mail, MapPin, Phone, Smartphone } from "lucide-react";
import { BusinessCardBack, BusinessCardFront } from "@/components/business-card/business-card-faces";
import { useLanguage } from "@/components/language-provider";
import { BUSINESS_CARD_COMPANY } from "@/lib/business-card/company";
import { cardEnglishLine, cardTelHref, cardTitleLine, formatCardPhone } from "@/lib/business-card/card-utils";
import type { PublicBusinessCard } from "@/lib/business-card/card-types";
import { cn } from "@/lib/utils";

/**
 * The e-card a person hands out by link or QR code: the printed card (tap to turn it over), one tap to save the
 * contact as a vCard, and the details as links. Everything is served from this origin.
 */
export default function PublicBusinessCardPage() {
	const { t } = useLanguage();
	const { token } = useParams<{ token: string }>();
	const [card, setCard] = useState<PublicBusinessCard | null>(null);
	const [missing, setMissing] = useState(false);
	const [showFront, setShowFront] = useState(false);

	useEffect(() => {
		let active = true;
		void fetch(`/api/public/card/${encodeURIComponent(token)}`)
			.then(async (response) => {
				if (!response.ok) throw new Error();
				return response.json() as Promise<PublicBusinessCard>;
			})
			.then((data) => {
				if (!active) return;
				setCard(data);
				document.title = `${data.name} · ${BUSINESS_CARD_COMPANY.name}`;
			})
			.catch(() => active && setMissing(true));
		return () => {
			active = false;
		};
	}, [token]);

	type Row = { icon: typeof Mail; label: string; value: string; href: string | null; mono: boolean };
	const rows: Row[] = [];
	if (card) {
		if (card.mobile) rows.push({ icon: Smartphone, label: t("publicCard.mobile"), value: formatCardPhone(card.mobile), href: cardTelHref(card.mobile), mono: true });
		if (card.phone) rows.push({ icon: Phone, label: t("publicCard.phone"), value: card.phone, href: cardTelHref(card.phone), mono: true });
		rows.push(
			{ icon: Mail, label: t("publicCard.email"), value: card.email, href: `mailto:${card.email}`, mono: true },
			{ icon: Globe, label: t("publicCard.website"), value: BUSINESS_CARD_COMPANY.website, href: BUSINESS_CARD_COMPANY.websiteUrl, mono: true },
			{ icon: MapPin, label: t("publicCard.address"), value: BUSINESS_CARD_COMPANY.address, href: null, mono: false },
		);
	}

	return (
		<main className="flex min-h-dvh flex-col bg-[#f6f8fc] px-4 pb-8 pt-6 text-neutral-900 sm:pt-12">
			<div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6">
				<header className="flex items-center justify-between">
					<img src="/brand/smj-signature-color.svg" alt={BUSINESS_CARD_COMPANY.name} className="h-7 w-auto dark:hidden" />
					<img src="/brand/smj-signature-reverse.svg" alt={BUSINESS_CARD_COMPANY.name} className="hidden h-7 w-auto dark:block" />
				</header>

				{missing ? (
					<p className="rounded-[4px] bg-white p-6 text-sm text-neutral-600">{t("publicCard.notFound")}</p>
				) : !card ? (
					<div className="aspect-[90/54] w-full animate-pulse rounded-[4px] bg-white" />
				) : (
					<>
						<button
							type="button"
							onClick={() => setShowFront((value) => !value)}
							className="group w-full [perspective:1200px] focus-visible:outline-none"
							aria-label={t("publicCard.flip")}
						>
							<div className={cn("relative transition-transform duration-500 [transform-style:preserve-3d]", showFront && "[transform:rotateY(180deg)]")}>
								<div className="[backface-visibility:hidden]">
									<BusinessCardBack card={card} className="ring-1 ring-[#d5dae3] group-focus-visible:ring-2 group-focus-visible:ring-blue-600" />
								</div>
								<div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]">
									<BusinessCardFront className="dark:ring-1 dark:ring-[rgba(255,255,255,0.24)]" />
								</div>
							</div>
						</button>
						<p className="-mt-3 text-center font-mono text-[11px] uppercase tracking-[0.12em] text-neutral-500">{t("publicCard.flipHint")}</p>

						<section className="flex items-center gap-4">
							<img src={card.avatarUrl} alt="" className="h-14 w-14 shrink-0 rounded-full bg-neutral-100 object-cover" />
							<div className="min-w-0">
								<h1 className="truncate text-xl font-bold text-neutral-900">{card.name}</h1>
								{cardTitleLine(card) && <p className="truncate text-sm text-neutral-600">{cardTitleLine(card)}</p>}
								{cardEnglishLine(card) && <p className="truncate text-xs text-neutral-500">{cardEnglishLine(card)}</p>}
							</div>
						</section>

						<a
							href={card.vcfUrl}
							download
							className="inline-flex h-11 items-center justify-center gap-2 rounded-[2px] bg-[#034fbc] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#03419b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#034fbc]"
						>
							<Download className="h-4 w-4" />
							{t("publicCard.saveContact")}
						</a>

						<ul className="divide-y divide-neutral-100 rounded-[4px] bg-white">
							{rows.map((row) => {
								const Icon = row.icon;
								const body = (
									<>
										<Icon className="h-5 w-5 shrink-0 text-blue-700" strokeWidth={1.75} />
										<span className="min-w-0 flex-1">
											<span className="block text-xs text-neutral-500">{row.label}</span>
											<span className={cn("block break-words text-sm text-neutral-900", row.mono && "font-mono")}>{row.value}</span>
										</span>
									</>
								);
								return (
									<li key={row.label}>
										{row.href ? (
											<a href={row.href} className="flex items-center gap-4 px-4 py-3 hover:bg-neutral-50" {...(row.href.startsWith("http") ? { target: "_blank", rel: "noopener" } : {})}>{body}</a>
										) : (
											<div className="flex items-center gap-4 px-4 py-3">{body}</div>
										)}
									</li>
								);
							})}
						</ul>

						<section className="flex items-center gap-4 rounded-[4px] bg-white p-4">
							<div className="w-24 shrink-0 rounded-[2px] p-2" style={{ background: "#FFFFFF" }} role="img" aria-label={t("publicCard.scan")} dangerouslySetInnerHTML={{ __html: card.qrSvg }} />
							<p className="text-sm leading-6 text-neutral-600">{t("publicCard.scan")}</p>
						</section>
					</>
				)}

				<footer className="mt-auto pt-4 text-center text-xs text-neutral-500">
					{BUSINESS_CARD_COMPANY.name} · <span className="font-semibold text-neutral-700">{BUSINESS_CARD_COMPANY.signOff}<span className="text-[#fa8c1f]">.</span></span>
				</footer>
			</div>
		</main>
	);
}
