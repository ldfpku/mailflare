import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { appSettings } from "@/db/schema";
import { APP_SETTINGS_ID } from "@/lib/branding/service";
import { getEnvAsync } from "@/lib/cloudflare";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Browsers ask for the favicon again on client-side navigations; without a cache lifetime each ask is a
// Worker request with a D1 query. A changed icon shows within an hour (in-app images add ?v=).
const ICON_CACHE_CONTROL = "public, max-age=3600";

async function getDefaultIcon(env: CloudflareEnv): Promise<Response> {
	const asset = await env.ASSETS.fetch("https://mailflare.local/icon-96.png");
	const headers = new Headers(asset.headers);
	if (asset.ok) headers.set("Cache-Control", ICON_CACHE_CONTROL);
	return new Response(asset.body, {
		status: asset.status,
		statusText: asset.statusText,
		headers,
	});
}

export async function GET() {
	const env = await getEnvAsync();
	try {
		const [settings] = await getDb(env)
			.select({ iconKey: appSettings.iconKey })
			.from(appSettings)
			.where(eq(appSettings.id, APP_SETTINGS_ID))
			.limit(1);
		if (settings?.iconKey) {
			const object = await env.BUCKET.get(settings.iconKey);
			if (object) {
				return new Response(object.body, {
					headers: {
						"Content-Type": object.httpMetadata?.contentType ?? "image/png",
						"Cache-Control": ICON_CACHE_CONTROL,
						"X-Content-Type-Options": "nosniff",
					},
				});
			}
		}
	} catch {
		// Use the packaged icon until the branding migration is available.
	}
	return getDefaultIcon(env);
}
