import { BUSINESS_CARD_COLORS, BUSINESS_CARD_COMPANY, businessCardAccent } from "@/lib/business-card/company";
import { cardEnglishLine, cardTitleLine, formatCardPhone } from "@/lib/business-card/card-utils";
import type { BusinessCardData } from "@/lib/business-card/card-types";
import { cn } from "@/lib/utils";
import { fitTextLength } from "./business-card-faces-utils";

type CardFaceData = Pick<BusinessCardData, "name" | "email" | "title" | "department" | "nameEn" | "titleEn" | "mobile" | "placement">;

const SANS = { fontFamily: "var(--font-brand)" };
const MONO = { fontFamily: "var(--font-data)" };
const { navy, blue, orange, graphite, steelGray, rule, white } = BUSINESS_CARD_COLORS;

/*
 * Both faces are drawn in millimetres on the 90 × 54 mm card of BIS C1 (page 52), with positions measured from its
 * sample at 300 dpi, so the screen card scales as one piece and matches the printed one.
 */

/** Front: Well Navy full bleed, the reversed wordmark, the Chinese brand line, and the large symbol bleeding off the right. */
export function BusinessCardFront({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 90 54" className={cn("block h-auto w-full overflow-hidden rounded-[4px]", className)} role="img" aria-label={`${BUSINESS_CARD_COMPANY.name} ${BUSINESS_CARD_COMPANY.tagline}`}>
			<rect width="90" height="54" fill={navy} />
			<g transform="translate(50 -12.1) scale(0.6458)">
				<path fill={orange} d="M108 0H35A35 35 0 0 0 0 35A35 35 0 0 0 35 70H50.5V46H35A11 11 0 0 1 24 35A11 11 0 0 1 35 24H108Z" />
				<path fill={blue} d="M0 124H73A35 35 0 0 0 108 89A35 35 0 0 0 73 54H57.5V78H73A11 11 0 0 1 84 89A11 11 0 0 1 73 100H0Z" />
			</g>
			<image href="/brand/smj-wordmark-reverse.svg" x="4.4" y="4.4" width="18.5" height="6.79" />
			<text x="4.5" y="46.4" fontSize="2.47" fill={white} style={SANS}>{BUSINESS_CARD_COMPANY.tagline}</text>
		</svg>
	);
}

/** Back: white, a 2 mm scene-colour edge on the right, name, title, the English line, M / E / W, address and company. */
export function BusinessCardBack({ card, className }: { card: CardFaceData; className?: string }) {
	const titleLine = cardTitleLine(card);
	const englishLine = cardEnglishLine(card);
	const contacts = [
		card.mobile ? `M ${formatCardPhone(card.mobile)}` : null,
		`E ${card.email}`,
		`W ${BUSINESS_CARD_COMPANY.website}`,
	].filter((line): line is string => !!line);
	return (
		<svg
			viewBox="0 0 90 54"
			className={cn("block h-auto w-full overflow-hidden rounded-[4px]", className)}
			role="img"
			aria-label={[card.name, titleLine, englishLine, ...contacts, BUSINESS_CARD_COMPANY.address, BUSINESS_CARD_COMPANY.name].filter(Boolean).join("，")}
		>
			<rect width="90" height="54" fill={white} />
			<rect x="88" width="2" height="54" fill={businessCardAccent(card.placement)} />
			<text x="5" y="11.6" fontSize="3.88" fontWeight="700" fill={navy} style={SANS} textLength={fitTextLength(card.name, 3.88, 78)} lengthAdjust="spacingAndGlyphs">{card.name}</text>
			{titleLine && <text x="5" y="15.9" fontSize="2.82" fill={steelGray} style={SANS} textLength={fitTextLength(titleLine, 2.82, 78)} lengthAdjust="spacingAndGlyphs">{titleLine}</text>}
			{englishLine && <text x="5" y="21" fontSize="2.47" fill={steelGray} style={SANS} textLength={fitTextLength(englishLine, 2.47, 78)} lengthAdjust="spacingAndGlyphs">{englishLine}</text>}
			<line x1="5" x2="85" y1="25" y2="25" stroke={rule} strokeWidth="0.25" />
			{contacts.map((line, index) => (
				<text key={line} x="5" y={29.7 + index * 3.7} fontSize="2.47" fill={navy} style={MONO} textLength={fitTextLength(line, 2.47, 78, "mono")} lengthAdjust="spacingAndGlyphs">{line}</text>
			))}
			<text x="5" y="42.7" fontSize="2.12" fill={graphite} style={SANS} textLength={fitTextLength(BUSINESS_CARD_COMPANY.address, 2.12, 66)} lengthAdjust="spacingAndGlyphs">{BUSINESS_CARD_COMPANY.address}</text>
			<text x="5" y="46.3" fontSize="2.12" fill={graphite} style={SANS}>{BUSINESS_CARD_COMPANY.name}</text>
			<image href="/brand/smj-symbol-color.svg" x="76.1" y="41.2" width="6.9" height="7.92" />
		</svg>
	);
}
