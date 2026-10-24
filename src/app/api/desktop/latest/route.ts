import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/api/auth";
import { getEnv } from "@/lib/cloudflare";
import { desktopReleaseInfo } from "@/lib/desktop/release-utils";
import { desktopOrigin, readDesktopManifest } from "@/lib/desktop/service";

/** The current desktop release for Settings > Desktop app; `release` is null until the first upload. */
export async function GET(request: Request) {
	const env = getEnv();
	const { error } = await requireSessionUser(env, request);
	if (error) return error;
	const manifest = await readDesktopManifest(env);
	return NextResponse.json({ release: manifest ? desktopReleaseInfo(manifest, desktopOrigin(env, request)) : null });
}
