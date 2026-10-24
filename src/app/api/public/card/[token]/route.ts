import { NextResponse } from "next/server";
import { businessCardOrigin, getPublicBusinessCard } from "@/lib/business-card/service";
import { getEnv } from "@/lib/cloudflare";

/** The public business card behind `/card/<token>`. Only published cards of active accounts answer. */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
	const { token } = await params;
	const env = getEnv();
	const card = await getPublicBusinessCard(env, token, businessCardOrigin(env, request));
	if (!card) return NextResponse.json({ error: "Card not found" }, { status: 404 });
	return NextResponse.json(card, { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
}
