import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/api/auth";
import { businessCardOrigin, getBusinessCardSettings, resetBusinessCardToken } from "@/lib/business-card/service";
import { getEnv } from "@/lib/cloudflare";

/** Retire the current card link (and its QR code) and issue a new one. */
export async function POST(request: Request) {
	const env = getEnv();
	const { user, error } = await requireSessionUser(env, request);
	if (error) return error;
	const origin = businessCardOrigin(env, request);
	await resetBusinessCardToken(env, user.id, origin);
	return NextResponse.json(await getBusinessCardSettings(env, user.id, origin));
}
