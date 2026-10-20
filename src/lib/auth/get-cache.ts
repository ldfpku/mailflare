"use client";

// Short-lived cache for the GETs behind the settings pages. Each of those pages loads its own data on
// mount, so switching between them waited on a server round trip every time; with this the answer from
// a visit (or from the warm-up the settings menu starts) is reused for a minute. Any write made through
// authFetch, and any sign-in change, empties it, so a page never shows its own stale save.

const TTL_MS = 60_000;
const CACHEABLE_PATHS = [
	/^\/api\/auth\/me$/,
	/^\/api\/settings\/[a-z-]+$/,
	/^\/api\/api-keys$/,
	/^\/api\/devices$/,
	/^\/api\/desktop\/latest$/,
	/^\/api\/push\/config$/,
	/^\/api\/routing-rules$/,
];

const entries = new Map<string, { at: number; response: Promise<Response> }>();

/** The cache key for a same-origin GET the settings pages make, or null when it is not cached. */
export function cachedGetKey(input: RequestInfo | URL, method: string | undefined): string | null {
	if (typeof window === "undefined" || (method && method.toUpperCase() !== "GET")) return null;
	if (typeof input !== "string" && !(input instanceof URL)) return null;
	const url = new URL(input, window.location.href);
	if (url.origin !== window.location.origin) return null;
	return CACHEABLE_PATHS.some((pattern) => pattern.test(url.pathname)) ? url.pathname + url.search : null;
}

export function readCachedGet(key: string, load: () => Promise<Response>): Promise<Response> {
	const now = Date.now();
	let entry = entries.get(key);
	if (!entry || now - entry.at > TTL_MS) {
		const response = load();
		entry = { at: now, response };
		entries.set(key, entry);
		// Only successful answers are reused.
		response.then((result) => {
			if (!result.ok && entries.get(key)?.response === response) entries.delete(key);
		}, () => {
			if (entries.get(key)?.response === response) entries.delete(key);
		});
	}
	return entry.response.then((result) => result.clone());
}

export function clearCachedGets(): void {
	entries.clear();
}
