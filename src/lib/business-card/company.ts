/**
 * What every SMJ business card prints besides the person (BIS C1, page 52). BIS notes that the address and the legal
 * name follow the company website once it is final, so they live here in one place.
 */
export const BUSINESS_CARD_COMPANY = {
	name: "江苏斯米伽石油装备有限公司",
	nameEn: "Jiangsu SMJ Oil Equipment Co., Ltd.",
	address: "河北省石家庄市正定新区青海大道 1 号",
	country: "中国",
	website: "www.smjtools.com",
	websiteUrl: "https://www.smjtools.com",
	/** The only line on the front of a domestic card. */
	tagline: "向深处，也向世界",
	/** Closes the email signature (BIS C3). */
	signOff: "Built for impact",
} as const;

/** BIS palette as used on cards and signatures. */
export const BUSINESS_CARD_COLORS = {
	navy: "#0A1F54",
	blue: "#034FBC",
	orange: "#FA8C1F",
	graphite: "#2B3752",
	steelGray: "#636C7E",
	rule: "#D5DAE3",
	white: "#FFFFFF",
} as const;

/** BIS B9: headquarters roles carry Smijia blue, field roles signal orange, on the card edge and the signature rule. */
export function businessCardAccent(placement: "hq" | "field"): string {
	return placement === "field" ? BUSINESS_CARD_COLORS.orange : BUSINESS_CARD_COLORS.blue;
}
