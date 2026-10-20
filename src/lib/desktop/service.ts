import { parseDesktopManifest } from "./release-utils";
import type { DesktopManifest } from "./release-types";

/** Desktop installers and update bundles live in their own bucket so the CI upload token never reaches mail. */
export function desktopBucket(env: CloudflareEnv): R2Bucket | null {
	return env.DESKTOP_BUCKET ?? null;
}

export async function readDesktopManifest(env: CloudflareEnv): Promise<DesktopManifest | null> {
	const bucket = desktopBucket(env);
	if (!bucket) return null;
	const object = await bucket.get("latest.json");
	if (!object) return null;
	return parseDesktopManifest(await object.json().catch(() => null));
}

export function desktopOrigin(env: CloudflareEnv, request: Request): string {
	return env.APP_URL?.trim().replace(/\/+$/, "") || new URL(request.url).origin;
}
