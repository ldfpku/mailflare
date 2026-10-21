export type MobileOs = "ios" | "android";

/** Phones and tablets; iPadOS 13+ reports itself as a Mac, so a Mac with a touch screen counts as iOS. */
export function detectMobileOs(userAgent: string, maxTouchPoints = 0): MobileOs | null {
	if (/Android/i.test(userAgent)) return "android";
	if (/iPhone|iPad|iPod/i.test(userAgent)) return "ios";
	if (/Macintosh/i.test(userAgent) && maxTouchPoints > 1) return "ios";
	return null;
}

/** The web IM the home screen app opens, on the same origin as the mail app. */
export function mobileAppUrl(origin: string): string {
	return `${origin.replace(/\/+$/, "")}/im/`;
}
