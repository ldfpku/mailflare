export type ImRouteHandler<C> = (context: C, params: Record<string, string>) => Response | Promise<Response>;

/** Keys are `"<METHOD> <path>"`; a `:name` segment captures one path segment into `params`. */
export type ImRouteTable<C> = Record<string, ImRouteHandler<C>>;

const API_PREFIX = "/api/im/";

/** The path below `/api/im/`, without a trailing slash, or null outside the IM API. */
export function imApiPath(pathname: string): string | null {
	if (!pathname.startsWith(API_PREFIX)) return null;
	return pathname.slice(API_PREFIX.length).replace(/\/+$/, "");
}

export function findImRoute<C>(
	table: ImRouteTable<C>,
	method: string,
	path: string,
): { handler: ImRouteHandler<C>; params: Record<string, string> } | null {
	const exact = table[`${method} ${path}`];
	if (exact) return { handler: exact, params: {} };
	const segments = path.split("/");
	for (const [key, handler] of Object.entries(table)) {
		const [routeMethod, routePath] = key.split(" ");
		if (routeMethod !== method || !routePath.includes(":")) continue;
		const routeSegments = routePath.split("/");
		if (routeSegments.length !== segments.length) continue;
		const params: Record<string, string> = {};
		const matches = routeSegments.every((segment, index) => {
			if (segment.startsWith(":")) {
				if (!segments[index]) return false;
				try {
					params[segment.slice(1)] = decodeURIComponent(segments[index]);
				} catch {
					return false;
				}
				return true;
			}
			return segment === segments[index];
		});
		if (matches) return { handler, params };
	}
	return null;
}
