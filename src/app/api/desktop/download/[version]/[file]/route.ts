import { getEnv } from "@/lib/cloudflare";
import { desktopFileContentType, desktopReleaseObjectKey, isDesktopReleaseFile } from "@/lib/desktop/release-utils";
import { desktopBucket } from "@/lib/desktop/service";

/** Installer and update bundle downloads. Public, because the updater cannot send the session cookie. */
async function serve(request: Request, params: Promise<{ version: string; file: string }>, head: boolean) {
	const { version, file } = await params;
	const name = decodeURIComponent(file);
	const releaseFile = `${version}/${name}`;
	const bucket = desktopBucket(getEnv());
	if (!bucket || !isDesktopReleaseFile(releaseFile)) return new Response("Not found", { status: 404 });
	const key = desktopReleaseObjectKey(releaseFile);
	const object = head ? await bucket.head(key) : await bucket.get(key);
	if (!object) return new Response("Not found", { status: 404 });
	const headers = new Headers({
		"Content-Type": desktopFileContentType(name),
		"Content-Length": String(object.size),
		"Content-Disposition": `attachment; filename="${name}"`,
		// A version's files never change once uploaded
		"Cache-Control": "public, max-age=86400, immutable",
		ETag: object.httpEtag,
		"X-Robots-Tag": "noindex",
	});
	return new Response(head || !("body" in object) ? null : (object as R2ObjectBody).body, { headers });
}

export function GET(request: Request, { params }: { params: Promise<{ version: string; file: string }> }) {
	return serve(request, params, false);
}

export function HEAD(request: Request, { params }: { params: Promise<{ version: string; file: string }> }) {
	return serve(request, params, true);
}
