"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Copy, Download, ExternalLink, RefreshCw } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { BUSINESS_CARD_LIMITS, buildBusinessCardSignatureHtml } from "@/lib/business-card/card-utils";
import type { BusinessCardFields, BusinessCardSettings } from "@/lib/business-card/card-types";
import type { TranslationKey } from "@/lib/i18n/types";
import { cn } from "@/lib/utils";
import { dispatchMailboxSignaturesChanged } from "@/lib/business-card/signature-client";
import { BusinessCardBack, BusinessCardFront } from "./business-card-faces";
import {
	fieldsOf,
	loadBusinessCardSettings,
	resetBusinessCardLink,
	sameFields,
	saveBusinessCardFields,
	setBusinessCardSignatureOn,
} from "./business-card-editor-utils";

type TextField = Exclude<keyof BusinessCardFields, "placement" | "published">;

const TEXT_FIELDS: { key: TextField; labelKey: TranslationKey; placeholderKey: TranslationKey; type?: string; autoComplete?: string }[] = [
	{ key: "title", labelKey: "businessCard.field.title", placeholderKey: "businessCard.field.titlePlaceholder", autoComplete: "organization-title" },
	{ key: "department", labelKey: "businessCard.field.department", placeholderKey: "businessCard.field.departmentPlaceholder" },
	{ key: "nameEn", labelKey: "businessCard.field.nameEn", placeholderKey: "businessCard.field.nameEnPlaceholder" },
	{ key: "titleEn", labelKey: "businessCard.field.titleEn", placeholderKey: "businessCard.field.titleEnPlaceholder" },
	{ key: "mobile", labelKey: "businessCard.field.mobile", placeholderKey: "businessCard.field.mobilePlaceholder", type: "tel", autoComplete: "tel" },
	{ key: "phone", labelKey: "businessCard.field.phone", placeholderKey: "businessCard.field.phonePlaceholder", type: "tel" },
];

/**
 * The brand business card: a live preview of both printed faces, the fields behind it, and for one's own card the
 * shareable e-card (link, QR code, vCard) and the email signature. Admins get the preview and the fields for any account.
 */
export function BusinessCardEditor({ accountId, editable = true }: { accountId?: string; editable?: boolean }) {
	const { t } = useLanguage();
	const own = !accountId;
	const [settings, setSettings] = useState<BusinessCardSettings | null>(null);
	const [fields, setFields] = useState<BusinessCardFields | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [status, setStatus] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [copied, setCopied] = useState(false);

	useEffect(() => {
		let cancelled = false;
		loadBusinessCardSettings(accountId)
			.then((next) => {
				if (cancelled) return;
				setSettings(next);
				setFields(fieldsOf(next));
			})
			.catch((err) => !cancelled && setError(err instanceof Error ? err.message : t("businessCard.loadFailed")));
		return () => {
			cancelled = true;
		};
	}, [accountId, t]);

	const preview = useMemo(() => (settings && fields ? { ...settings.card, ...fields } : null), [settings, fields]);
	const signatureHtml = useMemo(() => {
		if (!preview || !settings) return "";
		return buildBusinessCardSignatureHtml(preview, new URL(settings.pageUrl).origin, settings.pageUrl);
	}, [preview, settings]);

	if (error) return <p role="alert" className="py-8 text-sm text-red-600">{error}</p>;
	if (!settings || !fields || !preview) {
		return (
			<div className="space-y-6 py-4">
				<Skeleton className="h-9 w-40" />
				<Skeleton className="h-72 w-full rounded-3xl" />
			</div>
		);
	}

	const dirty = !sameFields(fields, fieldsOf(settings));

	async function run(action: () => Promise<BusinessCardSettings>, done?: string) {
		setBusy(true);
		setStatus(null);
		try {
			const next = await action();
			dispatchMailboxSignaturesChanged();
			setSettings(next);
			setFields(fieldsOf(next));
			if (done) setStatus(done);
		} catch (err) {
			setStatus(err instanceof Error ? err.message : t("businessCard.saveFailed"));
		} finally {
			setBusy(false);
		}
	}

	async function copyLink() {
		try {
			await navigator.clipboard.writeText(settings!.pageUrl);
			setCopied(true);
			window.setTimeout(() => setCopied(false), 2000);
		} catch {
			setStatus(settings!.pageUrl);
		}
	}

	function resetLink() {
		if (!window.confirm(t("businessCard.share.resetConfirm"))) return;
		void run(resetBusinessCardLink, t("businessCard.share.resetDone"));
	}

	return (
		<div className="space-y-8 py-4">
			<section className="space-y-4">
				<div>
					<h2 className="text-xl font-semibold text-neutral-900">{t("businessCard.preview")}</h2>
					<p className="mt-1 text-sm text-neutral-500">{t("businessCard.previewDescription")}</p>
				</div>
				<div className="grid gap-4 rounded-3xl bg-white p-6 sm:grid-cols-2">
					<figure className="space-y-2">
						<BusinessCardFront className="ring-1 ring-black/5 dark:ring-[rgba(255,255,255,0.24)]" />
						<figcaption className="font-mono text-[11px] uppercase tracking-[0.12em] text-neutral-500">{t("businessCard.front")}</figcaption>
					</figure>
					<figure className="space-y-2">
						<BusinessCardBack card={preview} className="ring-1 ring-[#d5dae3]" />
						<figcaption className="font-mono text-[11px] uppercase tracking-[0.12em] text-neutral-500">{t("businessCard.back")}</figcaption>
					</figure>
				</div>
			</section>

			<section className="space-y-4">
				<div>
					<h2 className="text-xl font-semibold text-neutral-900">{t("businessCard.details")}</h2>
					<p className="mt-1 text-sm text-neutral-500">{own ? t("businessCard.detailsDescription") : t("businessCard.adminDescription")}</p>
				</div>
				<form
					className="space-y-5 rounded-3xl bg-white p-6"
					onSubmit={(event) => {
						event.preventDefault();
						void run(() => saveBusinessCardFields(fields, accountId), t("businessCard.saved"));
					}}
				>
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="space-y-2">
							<Label htmlFor="card-name">{t("common.name")}</Label>
							<Input id="card-name" value={preview.name} readOnly className="bg-neutral-50 text-neutral-500" />
						</div>
						<div className="space-y-2">
							<Label htmlFor="card-email">{t("auth.email")}</Label>
							<Input id="card-email" value={preview.email} readOnly className="bg-neutral-50 text-neutral-500" />
						</div>
						{TEXT_FIELDS.map((field) => (
							<div key={field.key} className="space-y-2">
								<Label htmlFor={`card-${field.key}`}>{t(field.labelKey)}</Label>
								<Input
									id={`card-${field.key}`}
									type={field.type ?? "text"}
									inputMode={field.type === "tel" ? "tel" : undefined}
									autoComplete={field.autoComplete ?? "off"}
									value={fields[field.key]}
									maxLength={BUSINESS_CARD_LIMITS[field.key]}
									placeholder={t(field.placeholderKey)}
									disabled={!editable || busy}
									onChange={(event) => setFields({ ...fields, [field.key]: event.target.value })}
								/>
							</div>
						))}
					</div>
					<p className="text-xs leading-5 text-neutral-500">{t("businessCard.nameHint")} {t("businessCard.field.phoneHint")}</p>
					<fieldset className="space-y-2">
						<legend className="text-sm font-medium text-neutral-900">{t("businessCard.field.placement")}</legend>
						<div className="flex flex-wrap gap-2">
							{(["hq", "field"] as const).map((placement) => (
								<button
									key={placement}
									type="button"
									aria-pressed={fields.placement === placement}
									disabled={!editable || busy}
									onClick={() => setFields({ ...fields, placement })}
									className={cn(
										"inline-flex h-9 items-center gap-2 rounded-[2px] border px-3 text-sm transition-colors disabled:opacity-50",
										fields.placement === placement ? "border-blue-600 bg-blue-50 text-neutral-900" : "border-neutral-200 text-neutral-600 hover:bg-neutral-50",
									)}
								>
									<span aria-hidden className="h-4 w-1" style={{ background: placement === "field" ? "#FA8C1F" : "#034FBC" }} />
									{t(`businessCard.placement.${placement}` as TranslationKey)}
								</button>
							))}
						</div>
						<p className="text-xs leading-5 text-neutral-500">{t("businessCard.placement.hint")}</p>
					</fieldset>
					{editable && (
						<div className="flex flex-wrap items-center gap-3">
							<Button type="submit" disabled={busy || !dirty}>{busy ? t("common.saving") : t("businessCard.save")}</Button>
							{dirty && <Button type="button" variant="ghost" disabled={busy} onClick={() => setFields(fieldsOf(settings))}>{t("businessCard.discard")}</Button>}
						</div>
					)}
				</form>
			</section>

			<section className="space-y-4">
				<div>
					<h2 className="text-xl font-semibold text-neutral-900">{t("businessCard.share.title")}</h2>
					<p className="mt-1 text-sm text-neutral-500">{t("businessCard.share.description")}</p>
				</div>
				<div className="space-y-5 rounded-3xl bg-white p-6">
					<div className="flex items-center justify-between gap-4">
						<div className="space-y-1">
							<Label htmlFor="card-published" className="font-semibold text-neutral-900">{t("businessCard.share.published")}</Label>
							<p className="text-xs leading-5 text-neutral-500">{t("businessCard.share.publishedHint")}</p>
						</div>
						<Switch
							id="card-published"
							checked={settings.card.published}
							disabled={!editable || busy}
							onCheckedChange={(published) => void run(() => saveBusinessCardFields({ ...fieldsOf(settings), published }, accountId))}
						/>
					</div>
					{settings.card.published && (
						<div className="flex flex-col gap-5 sm:flex-row sm:items-start">
							{/* The QR code is drawn on its own white tile so phones read it in the dark theme too. */}
							<div className="w-36 shrink-0 rounded-[4px] p-3" style={{ background: "#FFFFFF" }} aria-label={t("businessCard.share.qr")} role="img" dangerouslySetInnerHTML={{ __html: settings.qrSvg }} />
							<div className="min-w-0 flex-1 space-y-3">
								<Input value={settings.pageUrl} readOnly className="font-mono text-xs" onFocus={(event) => event.currentTarget.select()} aria-label={t("businessCard.share.link")} />
								<div className="flex flex-wrap gap-2">
									<Button type="button" variant="outline" onClick={() => void copyLink()}>
										{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
										{copied ? t("businessCard.share.copied") : t("businessCard.share.copy")}
									</Button>
									<Button variant="outline" asChild>
										<a href={settings.pageUrl} target="_blank" rel="noopener"><ExternalLink className="h-4 w-4" />{t("businessCard.share.open")}</a>
									</Button>
									<Button variant="outline" asChild>
										<a href={settings.vcfUrl} download><Download className="h-4 w-4" />{t("businessCard.share.vcf")}</a>
									</Button>
									{own && (
										<Button type="button" variant="ghost" disabled={busy} onClick={resetLink}>
											<RefreshCw className="h-4 w-4" />{t("businessCard.share.reset")}
										</Button>
									)}
								</div>
							</div>
						</div>
					)}
				</div>
			</section>

			{own && (
				<section className="space-y-4">
					<div>
						<h2 className="text-xl font-semibold text-neutral-900">{t("businessCard.signature.title")}</h2>
						<p className="mt-1 text-sm text-neutral-500">{t("businessCard.signature.description")}</p>
					</div>
					<div className="space-y-5 rounded-3xl bg-white p-6">
						{/* Mail is read on white, so the signature is previewed on white in both themes. */}
						<div className="overflow-x-auto rounded-[4px] border border-[#d5dae3] p-5" style={{ background: "#FFFFFF" }}>
							<div dangerouslySetInnerHTML={{ __html: signatureHtml }} />
						</div>
						{dirty && <p className="text-xs leading-5 text-neutral-500">{t("businessCard.signature.unsaved")}</p>}
						{settings.mailboxes.length === 0 ? (
							<p className="text-sm text-neutral-500">{t("businessCard.signature.noMailbox")}</p>
						) : (
							<ul className="divide-y divide-neutral-100">
								{settings.mailboxes.map((mailbox) => (
									<li key={mailbox.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
										<div className="min-w-0 space-y-0.5">
											<p className="truncate text-sm font-medium text-neutral-900">{t("businessCard.signature.useOn", { address: mailbox.address })}</p>
											{mailbox.hasOtherSignature && <p className="text-xs leading-5 text-neutral-500">{t("businessCard.signature.replacesCustom")}</p>}
										</div>
										<Switch
											aria-label={t("businessCard.signature.useOn", { address: mailbox.address })}
											checked={mailbox.usesCardSignature}
											disabled={busy || dirty}
											onCheckedChange={(enabled) => void run(() => setBusinessCardSignatureOn(mailbox.id, enabled))}
										/>
									</li>
								))}
							</ul>
						)}
						<p className="text-xs leading-5 text-neutral-500">
							{t("businessCard.signature.editHint")} <Link href="/settings/account" className="text-blue-700 underline">{t("businessCard.signature.editLink")}</Link>
						</p>
					</div>
				</section>
			)}
			{status && <p role="status" className="text-sm text-neutral-500">{status}</p>}
		</div>
	);
}
