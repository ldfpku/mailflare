/** Where HuLa's web build is served; `scripts/build-im-web.mjs` copies it to `public/im`. */
export const IM_WEB_APP_PATH = "/im";
/** Fetched through the assets binding, whose default HTML handling serves `index.html` for a directory. */
export const IM_WEB_APP_INDEX = "/im/";

export function isImWebAppPath(pathname: string): boolean {
	return pathname === IM_WEB_APP_PATH || pathname.startsWith(`${IM_WEB_APP_PATH}/`);
}
