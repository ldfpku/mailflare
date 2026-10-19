import QRCode from "qrcode";
import { nanoid } from "nanoid";
import { BUSINESS_CARD_COLORS } from "./company";
import {
	buildBusinessCardSignatureHtml,
	businessCardPageUrl,
	businessCardVcfUrl,
	EMPTY_BUSINESS_CARD_FIELDS,
} from "./card-utils";
import type { BusinessCardData, BusinessCardFields, BusinessCardSettings, PublicBusinessCard } from "./card-types";

type Env = CloudflareEnv;

/** Links and the signature image point at APP_URL when set (as chat and meeting links do), else at the request's origin. */
export function businessCardOrigin(env: Env, request: Request): string {
	return env.APP_URL?.trim().replace(/\/+$/, "") || new URL(request.url).origin;
}

interface CardRow {
	user_id: string;
	name: string;
	email: string;
	token: string | null;
	title: string | null;
	department: string | null;
	name_en: string | null;
	title_en: string | null;
	mobile: string | null;
	phone: string | null;
	placement: string | null;
	published: number | null;
}

const CARD_SELECT = `SELECT u.id AS user_id, u.name, u.email, c.token, c.title, c.department, c.name_en, c.title_en, c.mobile,
	c.phone, c.placement, c.published
	FROM users u LEFT JOIN business_cards c ON c.user_id = u.id`;

function toCardData(row: CardRow): BusinessCardData {
	return {
		name: row.name,
		email: row.email,
		title: row.title ?? "",
		department: row.department ?? "",
		nameEn: row.name_en ?? "",
		titleEn: row.title_en ?? "",
		mobile: row.mobile ?? "",
		phone: row.phone ?? "",
		placement: row.placement === "field" ? "field" : "hq",
		published: row.published === null ? EMPTY_BUSINESS_CARD_FIELDS.published : !!row.published,
	};
}

/** The account's card, creating its row (and so its public link) on first use. Null when the account does not exist. */
export async function loadBusinessCard(env: Env, userId: string): Promise<{ card: BusinessCardData; token: string } | null> {
	const row = await env.DB.prepare(`${CARD_SELECT} WHERE u.id = ? AND u.deleted_at IS NULL`).bind(userId).first<CardRow>();
	if (!row) return null;
	if (row.token) return { card: toCardData(row), token: row.token };
	const token = nanoid();
	await env.DB.prepare("INSERT INTO business_cards (user_id, token, updated_at) VALUES (?, ?, ?) ON CONFLICT (user_id) DO NOTHING")
		.bind(userId, token, Date.now())
		.run();
	const created = await env.DB.prepare("SELECT token FROM business_cards WHERE user_id = ?").bind(userId).first<{ token: string }>();
	return { card: toCardData({ ...row, token: created!.token }), token: created!.token };
}

function signatureFor(card: BusinessCardData, token: string, origin: string): string {
	return buildBusinessCardSignatureHtml(card, origin, businessCardPageUrl(origin, token));
}

interface MailboxRow {
	id: string;
	local_part: string;
	hostname: string;
	signature: string | null;
}

/** The person's own mailboxes: the card signature belongs on these, not on shared or group addresses. */
async function listOwnMailboxes(env: Env, userId: string): Promise<MailboxRow[]> {
	const result = await env.DB.prepare(
		`SELECT m.id, m.local_part, d.hostname, m.signature FROM mailboxes m JOIN domains d ON d.id = m.domain_id
		WHERE m.user_id = ? AND m.type = 'personal' AND m.disabled = 0 ORDER BY m.created_at`,
	).bind(userId).all<MailboxRow>();
	return result.results ?? [];
}

/**
 * Mailboxes still carrying the card signature as it was before an edit get the new one, so turning the
 * signature on once keeps it current; a signature the person wrote themselves is left alone.
 */
async function replaceCardSignature(env: Env, userId: string, previous: string, next: string) {
	if (previous === next) return;
	await env.DB.prepare("UPDATE mailboxes SET signature = ? WHERE user_id = ? AND type = 'personal' AND signature = ?")
		.bind(next, userId, previous)
		.run();
}

export async function saveBusinessCard(env: Env, userId: string, fields: BusinessCardFields, origin: string) {
	const current = await loadBusinessCard(env, userId);
	if (!current) return null;
	await env.DB.prepare(
		`UPDATE business_cards SET title = ?, department = ?, name_en = ?, title_en = ?, mobile = ?, phone = ?, placement = ?,
		published = ?, updated_at = ? WHERE user_id = ?`,
	).bind(fields.title, fields.department, fields.nameEn, fields.titleEn, fields.mobile, fields.phone, fields.placement,
		fields.published ? 1 : 0, Date.now(), userId).run();
	const next = { ...current.card, ...fields };
	await replaceCardSignature(env, userId, signatureFor(current.card, current.token, origin), signatureFor(next, current.token, origin));
	return { card: next, token: current.token };
}

/** A new public link; the old one stops working at once. */
export async function resetBusinessCardToken(env: Env, userId: string, origin: string) {
	const current = await loadBusinessCard(env, userId);
	if (!current) return null;
	const token = nanoid();
	await env.DB.prepare("UPDATE business_cards SET token = ?, updated_at = ? WHERE user_id = ?").bind(token, Date.now(), userId).run();
	await replaceCardSignature(env, userId, signatureFor(current.card, current.token, origin), signatureFor(current.card, token, origin));
	return { card: current.card, token };
}

/**
 * Put the card signature on the given own mailboxes, or take it off (only where it is still the card signature).
 * An empty list means every own mailbox.
 */
export async function setBusinessCardSignature(env: Env, userId: string, enabled: boolean, mailboxIds: string[], origin: string) {
	const current = await loadBusinessCard(env, userId);
	if (!current) return null;
	const signature = signatureFor(current.card, current.token, origin);
	const own = await listOwnMailboxes(env, userId);
	const targets = mailboxIds.length ? own.filter((mailbox) => mailboxIds.includes(mailbox.id)) : own;
	for (const mailbox of targets) {
		if (enabled) {
			await env.DB.prepare("UPDATE mailboxes SET signature = ? WHERE id = ?").bind(signature, mailbox.id).run();
		} else if (mailbox.signature === signature) {
			await env.DB.prepare("UPDATE mailboxes SET signature = NULL WHERE id = ?").bind(mailbox.id).run();
		}
	}
	return current;
}

export function businessCardQrSvg(url: string): Promise<string> {
	return QRCode.toString(url, {
		type: "svg",
		margin: 0,
		errorCorrectionLevel: "M",
		color: { dark: BUSINESS_CARD_COLORS.navy, light: "#FFFFFF" },
	});
}

function avatarUrl(origin: string, userId: string) {
	return `${origin}/api/im/avatar/${encodeURIComponent(userId)}`;
}

export async function getBusinessCardSettings(env: Env, userId: string, origin: string): Promise<BusinessCardSettings | null> {
	const current = await loadBusinessCard(env, userId);
	if (!current) return null;
	const pageUrl = businessCardPageUrl(origin, current.token);
	const signatureHtml = signatureFor(current.card, current.token, origin);
	const mailboxes = await listOwnMailboxes(env, userId);
	return {
		card: current.card,
		userId,
		pageUrl,
		vcfUrl: businessCardVcfUrl(origin, current.token),
		qrSvg: await businessCardQrSvg(pageUrl),
		avatarUrl: avatarUrl(origin, userId),
		signatureHtml,
		mailboxes: mailboxes.map((mailbox) => ({
			id: mailbox.id,
			address: `${mailbox.local_part}@${mailbox.hostname}`,
			usesCardSignature: mailbox.signature === signatureHtml,
			hasOtherSignature: !!mailbox.signature?.trim() && mailbox.signature !== signatureHtml,
		})),
	};
}

/** A published card of an active account, for the public page and the .vcf. */
export async function findPublicBusinessCard(env: Env, token: string): Promise<(BusinessCardData & { userId: string }) | null> {
	if (!token || token.length > 64) return null;
	const row = await env.DB.prepare(
		`${CARD_SELECT} WHERE c.token = ? AND c.published = 1 AND u.disabled = 0 AND u.deleted_at IS NULL`,
	).bind(token).first<CardRow>();
	return row ? { ...toCardData(row), userId: row.user_id } : null;
}

export async function getPublicBusinessCard(env: Env, token: string, origin: string): Promise<PublicBusinessCard | null> {
	const card = await findPublicBusinessCard(env, token);
	if (!card) return null;
	const pageUrl = businessCardPageUrl(origin, token);
	return {
		name: card.name,
		email: card.email,
		title: card.title,
		department: card.department,
		nameEn: card.nameEn,
		titleEn: card.titleEn,
		mobile: card.mobile,
		phone: card.phone,
		placement: card.placement,
		avatarUrl: avatarUrl(origin, card.userId),
		pageUrl,
		vcfUrl: businessCardVcfUrl(origin, token),
		qrSvg: await businessCardQrSvg(pageUrl),
	};
}
