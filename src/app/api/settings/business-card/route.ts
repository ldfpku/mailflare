import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/api/auth";
import { parseBusinessCardInput } from "@/lib/business-card/card-utils";
import { businessCardOrigin, getBusinessCardSettings, saveBusinessCard } from "@/lib/business-card/service";
import { getEnv } from "@/lib/cloudflare";

export async function GET(request: Request) {
	const env = getEnv();
	const { user, error } = await requireSessionUser(env, request);
	if (error) return error;
	const settings = await getBusinessCardSettings(env, user.id, businessCardOrigin(env, request));
	if (!settings) return NextResponse.json({ error: "Account not found" }, { status: 404 });
	return NextResponse.json(settings);
}

export async function PUT(request: Request) {
	const env = getEnv();
	const { user, error } = await requireSessionUser(env, request);
	if (error) return error;
	const parsed = parseBusinessCardInput(await request.json().catch(() => null));
	if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
	const origin = businessCardOrigin(env, request);
	await saveBusinessCard(env, user.id, parsed.fields, origin);
	return NextResponse.json(await getBusinessCardSettings(env, user.id, origin));
}
