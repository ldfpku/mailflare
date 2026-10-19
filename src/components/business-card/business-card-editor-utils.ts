import { authFetch } from "@/lib/auth/client";
import type { BusinessCardFields, BusinessCardSettings } from "@/lib/business-card/card-types";

/** `/api/settings/business-card` for one's own card, `/api/accounts/<id>/business-card` for an admin. */
export function businessCardEndpoint(accountId?: string): string {
	return accountId ? `/api/accounts/${encodeURIComponent(accountId)}/business-card` : "/api/settings/business-card";
}

async function readSettings(response: Response, fallback: string): Promise<BusinessCardSettings> {
	const data = (await response.json().catch(() => null)) as (BusinessCardSettings & { error?: unknown }) | null;
	if (!response.ok || !data) throw new Error(typeof data?.error === "string" ? data.error : fallback);
	return data;
}

export async function loadBusinessCardSettings(accountId?: string): Promise<BusinessCardSettings> {
	return readSettings(await authFetch(businessCardEndpoint(accountId)), "Could not load the card");
}

export async function saveBusinessCardFields(fields: BusinessCardFields, accountId?: string): Promise<BusinessCardSettings> {
	return readSettings(await authFetch(businessCardEndpoint(accountId), {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(fields),
	}), "Could not save the card");
}

export async function resetBusinessCardLink(): Promise<BusinessCardSettings> {
	return readSettings(await authFetch("/api/settings/business-card/reset-link", { method: "POST" }), "Could not change the link");
}

export async function setBusinessCardSignatureOn(mailboxId: string, enabled: boolean): Promise<BusinessCardSettings> {
	return readSettings(await authFetch("/api/settings/business-card/signature", {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ enabled, mailboxIds: [mailboxId] }),
	}), "Could not change the signature");
}

export function fieldsOf(settings: BusinessCardSettings): BusinessCardFields {
	const { title, department, nameEn, titleEn, mobile, phone, placement, published } = settings.card;
	return { title, department, nameEn, titleEn, mobile, phone, placement, published };
}

export function sameFields(a: BusinessCardFields, b: BusinessCardFields): boolean {
	return (Object.keys(a) as (keyof BusinessCardFields)[]).every((key) => a[key] === b[key]);
}
