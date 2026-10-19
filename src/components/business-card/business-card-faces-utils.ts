/**
 * Rough advance widths, in em, for fitting a line on the card. Han characters are square; Barlow averages a little
 * over half an em and IBM Plex Mono is exactly 0.6. Good enough to decide when a long title has to be condensed.
 */
export function estimateTextWidth(text: string, fontSize: number, kind: "sans" | "mono"): number {
	let width = 0;
	for (const char of text) {
		if (/[⺀-鿿＀-￯　-〿]/.test(char)) width += 1;
		else if (kind === "mono") width += 0.6;
		else if (char === " ") width += 0.25;
		else width += /[A-Z0-9@]/.test(char) ? 0.6 : 0.5;
	}
	return width * fontSize;
}

/** `textLength` for a line that would run past `maxWidth`, so it is condensed instead of crossing the edge or the symbol. */
export function fitTextLength(text: string, fontSize: number, maxWidth: number, kind: "sans" | "mono" = "sans"): number | undefined {
	return estimateTextWidth(text, fontSize, kind) > maxWidth ? maxWidth : undefined;
}
