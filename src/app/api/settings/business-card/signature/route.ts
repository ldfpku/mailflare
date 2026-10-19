import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/api/auth";
import { businessCardOrigin, getBusinessCardSettings, setBusinessCardSignature } from "@/lib/business-card/service";
import { getEnv } from "@/lib/cloudflare";

/** `{ enabled, mailboxIds? }`: put the card signature on the caller's own mailboxes, or take it off. */
export async function PUT(request: Request) {
	const env = getEnv();
	const { user, error } = await requireSessionUser(env, request);
	if (error) return error;
	const body = await request.json().catch(() => null) as { enabled?: unknown; mailboxIds?: unknown } | null;
	if (typeof body?.enabled !== "boolean") return NextResponse.json({ error: "enabled must be a boolean" }, { status: 400 });
	const mailboxIds = Array.isArray(body.mailboxIds) ? body.mailboxIds.filter((id): id is string => typeof id === "string") : [];
	const origin = businessCardOrigin(env, request);
	await setBusinessCardSignature(env, user.id, body.enabled, mailboxIds, origin);
	return NextResponse.json(await getBusinessCardSettings(env, user.id, origin));
}
