import { BUSINESS_CARD_COLORS, BUSINESS_CARD_COMPANY, businessCardAccent } from "./company";
import type { BusinessCardData, BusinessCardFields, BusinessCardPlacement } from "./card-types";

export const BUSINESS_CARD_LIMITS = { title: 40, department: 40, nameEn: 60, titleEn: 60, mobile: 30, phone: 30 } as const;

export const EMPTY_BUSINESS_CARD_FIELDS: BusinessCardFields = {
	title: "",
	department: "",
	nameEn: "",
	titleEn: "",
	mobile: "",
	phone: "",
	placement: "hq",
	published: true,
};

const PHONE_PATTERN = /^\+?[0-9][0-9 ()\-]*(?:(?:ext\.?|转|#)\s*[0-9]+)?$/i;

/** Validate an edit. Strings are trimmed with inner whitespace collapsed; phone numbers keep only digits, + - ( ) and spaces. */
export function parseBusinessCardInput(input: unknown): { fields: BusinessCardFields } | { error: string } {
	if (!input || typeof input !== "object") return { error: "Expected a JSON object" };
	const value = input as Record<string, unknown>;
	const fields = { ...EMPTY_BUSINESS_CARD_FIELDS };
	for (const key of ["title", "department", "nameEn", "titleEn", "mobile", "phone"] as const) {
		const raw = value[key];
		if (raw !== undefined && raw !== null && typeof raw !== "string") return { error: `${key} must be a string` };
		const text = (raw ?? "").replace(/\s+/g, " ").trim();
		if (text.length > BUSINESS_CARD_LIMITS[key]) return { error: `${key} is too long` };
		fields[key] = text;
	}
	for (const key of ["mobile", "phone"] as const) {
		if (fields[key] && !PHONE_PATTERN.test(fields[key])) return { error: `${key} is not a phone number` };
	}
	if (value.placement !== undefined) {
		if (value.placement !== "hq" && value.placement !== "field") return { error: "placement must be hq or field" };
		fields.placement = value.placement as BusinessCardPlacement;
	}
	if (value.published !== undefined) {
		if (typeof value.published !== "boolean") return { error: "published must be a boolean" };
		fields.published = value.published;
	}
	return { fields };
}

/** A mainland mobile number reads 133-4788-0755 as on the BIS letterhead; anything else is shown as typed. */
export function formatCardPhone(value: string): string {
	const digits = value.replace(/[\s-]/g, "");
	const mainland = /^(\+86)?(1\d{2})(\d{4})(\d{4})$/.exec(digits);
	if (mainland) return `${mainland[1] ? "+86 " : ""}${mainland[2]}-${mainland[3]}-${mainland[4]}`;
	return value;
}

/** The `tel:` target: digits and a leading +, extension after a comma (a dialler pause). */
export function cardTelHref(value: string): string {
	const [main, extension] = value.split(/\s*(?:ext\.?|转|#)\s*/i);
	const number = main.replace(/[^0-9+]/g, "");
	return `tel:${number}${extension ? `,${extension.replace(/\D/g, "")}` : ""}`;
}

/** 职务 · 部门, with whichever part is filled in. */
export function cardTitleLine(card: Pick<BusinessCardData, "title" | "department">): string {
	return [card.title, card.department].filter(Boolean).join(" · ");
}

/** Name Surname · Title, the optional English line on the back. */
export function cardEnglishLine(card: Pick<BusinessCardData, "nameEn" | "titleEn">): string {
	return [card.nameEn, card.titleEn].filter(Boolean).join(" · ");
}

const COMPOUND_SURNAMES = new Set([
	"欧阳", "司马", "上官", "诸葛", "东方", "皇甫", "尉迟", "公孙", "慕容", "长孙", "令狐", "夏侯", "轩辕", "宇文",
	"司徒", "端木", "南宫", "西门", "独孤", "澹台", "申屠", "太史", "闻人", "钟离", "呼延", "百里", "东郭", "万俟",
]);

/** Family and given name for the vCard N property. Chinese names put the surname first; others put it last. */
export function splitPersonName(name: string): { family: string; given: string } {
	const value = name.trim();
	if (/^[\u3400-\u9fff\u{20000}-\u{2ffff}·]+$/u.test(value)) {
		const chars = Array.from(value);
		if (chars.length <= 1) return { family: value, given: "" };
		const surnameLength = chars.length > 2 && COMPOUND_SURNAMES.has(chars.slice(0, 2).join("")) ? 2 : 1;
		return { family: chars.slice(0, surnameLength).join(""), given: chars.slice(surnameLength).join("") };
	}
	const parts = value.split(/\s+/);
	if (parts.length < 2) return { family: "", given: value };
	return { family: parts.at(-1)!, given: parts.slice(0, -1).join(" ") };
}

function escapeVcard(value: string): string {
	return value.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

/** RFC 6350 §3.2: lines longer than 75 octets continue on the next line after a space, never inside a UTF-8 sequence. */
function foldVcardLine(line: string): string {
	const encoder = new TextEncoder();
	const out: string[] = [];
	let current = "";
	let size = 0;
	for (const char of line) {
		const bytes = encoder.encode(char).length;
		const limit = out.length === 0 ? 75 : 74;
		if (size + bytes > limit) {
			out.push(current);
			current = "";
			size = 0;
		}
		current += char;
		size += bytes;
	}
	out.push(current);
	return out.join("\r\n ");
}

/**
 * A vCard 3.0, which every phone address book imports. It carries one mobile and one email as BIS C1 asks,
 * the desk phone when there is one, the company, and a link back to the card page.
 */
export function buildBusinessCardVcf(card: BusinessCardData, pageUrl?: string, now = new Date()): string {
	const { family, given } = splitPersonName(card.name);
	const english = cardEnglishLine(card);
	const lines = [
		"BEGIN:VCARD",
		"VERSION:3.0",
		`N:${escapeVcard(family)};${escapeVcard(given)};;;`,
		`FN:${escapeVcard(card.name)}`,
		`ORG:${escapeVcard(BUSINESS_CARD_COMPANY.name)}${card.department ? `;${escapeVcard(card.department)}` : ""}`,
		...(card.title ? [`TITLE:${escapeVcard(card.title)}`] : []),
		...(card.mobile ? [`TEL;TYPE=CELL,VOICE:${escapeVcard(card.mobile)}`] : []),
		...(card.phone ? [`TEL;TYPE=WORK,VOICE:${escapeVcard(card.phone)}`] : []),
		`EMAIL;TYPE=INTERNET,WORK:${escapeVcard(card.email)}`,
		`URL;TYPE=WORK:${BUSINESS_CARD_COMPANY.websiteUrl}`,
		...(pageUrl ? [`URL:${pageUrl}`] : []),
		`ADR;TYPE=WORK:;;${escapeVcard(BUSINESS_CARD_COMPANY.address)};;;;${escapeVcard(BUSINESS_CARD_COMPANY.country)}`,
		...(english ? [`NOTE:${escapeVcard(`${english} · ${BUSINESS_CARD_COMPANY.nameEn}`)}`] : []),
		`REV:${now.toISOString().replace(/\.\d{3}Z$/, "Z")}`,
		"END:VCARD",
	];
	return `${lines.map(foldVcardLine).join("\r\n")}\r\n`;
}

/** `Content-Disposition` for the .vcf, with the person's name kept for browsers that read `filename*`. */
export function businessCardVcfDisposition(name: string): string {
	const safe = name.replace(/[\\/:*?"<>|\r\n]+/g, "").trim() || "card";
	return `attachment; filename="card.vcf"; filename*=UTF-8''${encodeURIComponent(`${safe}.vcf`)}`;
}

function escapeHtml(value: string): string {
	return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * The BIS C3 email signature: the two-colour symbol, a 2px rule in the person's scene colour, name and title,
 * contact line, website and "Built for impact." Inline styles and table layout so mail clients keep it; the symbol
 * is a 2x PNG on our own origin. The fonts are the template's system fonts because mail clients cannot load ours.
 */
export function buildBusinessCardSignatureHtml(card: BusinessCardData, origin: string, pageUrl?: string): string {
	const { navy, blue, orange, graphite } = BUSINESS_CARD_COLORS;
	const heading = [card.name, card.title].filter(Boolean).map(escapeHtml).join(" · ");
	const contact = [
		card.mobile ? `M ${escapeHtml(formatCardPhone(card.mobile))}` : "",
		card.phone ? `T ${escapeHtml(card.phone)}` : "",
		`E <a href="mailto:${escapeHtml(card.email)}" style="color:${blue};text-decoration:none">${escapeHtml(card.email)}</a>`,
	].filter(Boolean).join(" · ");
	const website = `<a href="${BUSINESS_CARD_COMPANY.websiteUrl}" style="color:${blue};text-decoration:none">${BUSINESS_CARD_COMPANY.website}</a>`;
	const cardLink = card.published && pageUrl ? ` · <a href="${escapeHtml(pageUrl)}" style="color:${blue};text-decoration:none">电子名片</a>` : "";
	const department = card.department ? `<div style="font-size:12px;line-height:18px;color:${graphite}">${escapeHtml(card.department)} · ${BUSINESS_CARD_COMPANY.name}</div>` : `<div style="font-size:12px;line-height:18px;color:${graphite}">${BUSINESS_CARD_COMPANY.name}</div>`;
	return [
		`<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="font-family:Arial,'Microsoft YaHei',sans-serif;color:${navy};border-collapse:collapse">`,
		"<tbody><tr>",
		`<td style="padding:0 14px 0 0;vertical-align:middle"><img src="${escapeHtml(origin)}/brand/smj-symbol-email@2x.png" width="36" height="41" alt="SMJ" style="display:block;border:0;width:36px;height:41px"></td>`,
		`<td style="border-left:2px solid ${businessCardAccent(card.placement)};padding:0 0 0 14px;vertical-align:middle">`,
		`<div style="font-size:14px;font-weight:bold;line-height:20px;color:${navy}">${heading}</div>`,
		department,
		`<div style="font-size:12px;line-height:18px;color:${graphite}">${contact}</div>`,
		`<div style="font-size:12px;line-height:18px;color:${graphite}">${website}${cardLink}</div>`,
		`<div style="font-size:12px;font-weight:bold;line-height:20px;color:${navy}">${BUSINESS_CARD_COMPANY.signOff}<span style="color:${orange}">.</span></div>`,
		"</td>",
		"</tr></tbody>",
		"</table>",
	].join("");
}

export function businessCardPageUrl(origin: string, token: string): string {
	return `${origin}/card/${encodeURIComponent(token)}`;
}

export function businessCardVcfUrl(origin: string, token: string): string {
	return `${origin}/api/public/card/${encodeURIComponent(token)}/vcf`;
}
