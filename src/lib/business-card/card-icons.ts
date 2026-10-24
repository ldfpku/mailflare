/**
 * Contact icons for the card back and the email signature, in place of M / T / E / W letters. Drawn on a 24-unit grid as
 * BIS B21 line icons: one stroke weight, square caps, mitred corners, no fill. The signature cannot use inline SVG (Gmail
 * strips it), so the same shapes are rendered once to 2x PNGs under /brand/, which `CARD_ICON_FILES` names; rerender
 * them with `node scripts/render-business-card-icons.mjs` after changing a shape here.
 */
export type CardIcon = "mobile" | "phone" | "email" | "website";

export const CARD_ICON_SHAPES: Record<CardIcon, string> = {
	mobile: '<rect x="6" y="2" width="12" height="20"/><path d="M11 18h2"/>',
	phone: '<path d="M4 3h5l2 5-3 2c1.2 2.6 3.4 4.8 6 6l2-3 5 2v5c-9.4 0-17-7.6-17-17Z"/>',
	email: '<rect x="2" y="5" width="20" height="14"/><path d="M2 5l10 8 10-8"/>',
	website: '<circle cx="12" cy="12" r="10"/><ellipse cx="12" cy="12" rx="4" ry="10"/><path d="M2 12h20"/>',
};

export const CARD_ICON_LABELS: Record<CardIcon, string> = { mobile: "手机", phone: "座机", email: "邮箱", website: "网站" };

export const CARD_ICON_FILES: Record<CardIcon, string> = {
	mobile: "/brand/smj-card-icon-mobile-2x.png",
	phone: "/brand/smj-card-icon-phone-2x.png",
	email: "/brand/smj-card-icon-email-2x.png",
	website: "/brand/smj-card-icon-website-2x.png",
};

/** One icon as a standalone SVG in the given colour, for rendering the PNGs. */
export function cardIconSvg(icon: CardIcon, color: string, size = 24): string {
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">${CARD_ICON_SHAPES[icon]}</svg>`;
}
