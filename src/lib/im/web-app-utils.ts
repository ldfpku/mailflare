/** Where HuLa's web build is served; `scripts/build-im-web.mjs` copies it to `public/im`. */
export const IM_WEB_APP_PATH = "/im";
/** Fetched through the assets binding, whose default HTML handling serves `index.html` for a directory. */
export const IM_WEB_APP_INDEX = "/im/";

export function isImWebAppPath(pathname: string): boolean {
	return pathname === IM_WEB_APP_PATH || pathname.startsWith(`${IM_WEB_APP_PATH}/`);
}

/**
 * The web client may only reach this origin and Cloudflare's own Web Analytics
 * beacon (injected at the edge): no other third-party scripts, images,
 * fonts or requests. The same policy is set for the static files in
 * `public/_headers`; keep the two equal.
 */
export const IM_WEB_APP_CSP =
	"default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' data: blob: https://cloudflareinsights.com; worker-src 'self' blob: data:; frame-src 'self' blob:; object-src 'none'; base-uri 'self'";
