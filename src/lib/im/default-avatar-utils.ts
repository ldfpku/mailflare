import { createAvatar } from "@dicebear/core";
import * as notionists from "@dicebear/notionists";
import * as shapes from "@dicebear/shapes";

/**
 * Accounts and groups without an uploaded picture get a generated one from
 * DiceBear's open avatar sets, drawn here rather than fetched from its API:
 * Notionists (by Zoish, CC0 1.0) for people and Shapes (CC0 1.0) in the SMJ
 * blues for groups. The seed is the account or room id, so a person looks the
 * same everywhere.
 * Bump the version when the styles change, so clients refetch.
 */
export const DEFAULT_AVATAR_VERSION = "1";

const PERSON_BACKGROUNDS = ["d2dff6", "e9edf5", "c9d8f2", "dce1ea"];
const GROUP_COLORS = {
	backgroundColor: ["034fbc", "4170cb", "0a1f54"],
	shape1Color: ["d2dff6", "ffffff", "7a9fe2"],
	shape2Color: ["b7becb", "d2dff6", "7a9fe2"],
	shape3Color: ["ffffff", "4170cb", "e9edf5"],
};

export function defaultPersonAvatarSvg(seed: string): string {
	return createAvatar(notionists, { seed, backgroundColor: PERSON_BACKGROUNDS, backgroundType: ["solid"] }).toString();
}

export function defaultGroupAvatarSvg(seed: string): string {
	return createAvatar(shapes, { seed, ...GROUP_COLORS }).toString();
}

export function defaultAvatarResponse(request: Request, svg: string, seed: string): Response {
	const etag = `"dicebear-${DEFAULT_AVATAR_VERSION}-${encodeURIComponent(seed)}"`;
	const headers = new Headers({
		"Content-Type": "image/svg+xml",
		"X-Content-Type-Options": "nosniff",
		"Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
		// Revalidated so an upload made later replaces the generated picture at the same URL.
		"Cache-Control": "private, no-cache",
		ETag: etag,
	});
	if (request.headers.get("If-None-Match") === etag) return new Response(null, { status: 304, headers });
	return new Response(svg, { headers });
}
