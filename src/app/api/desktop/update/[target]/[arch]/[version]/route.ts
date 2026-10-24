import { NextResponse } from "next/server";
import { getEnv } from "@/lib/cloudflare";
import { resolveDesktopUpdate } from "@/lib/desktop/release-utils";
import { desktopOrigin, readDesktopManifest } from "@/lib/desktop/service";

/**
 * Tauri updater endpoint for the SMJ desktop app (HuLa src-tauri/tauri.conf.json `plugins.updater.endpoints`).
 * Public: the app asks before anyone signs in. 204 means "no update".
 */
export async function GET(
	request: Request,
	{ params }: { params: Promise<{ target: string; arch: string; version: string }> },
) {
	const { target, arch, version } = await params;
	const env = getEnv();
	const manifest = await readDesktopManifest(env);
	const update = manifest && resolveDesktopUpdate(manifest, target, arch, version, desktopOrigin(env, request));
	if (!update) return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
	return NextResponse.json(update, { headers: { "Cache-Control": "no-store" } });
}
