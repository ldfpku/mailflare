import { buildBusinessCardVcf, businessCardPageUrl, businessCardVcfDisposition } from "@/lib/business-card/card-utils";
import { businessCardOrigin, findPublicBusinessCard } from "@/lib/business-card/service";
import { getEnv } from "@/lib/cloudflare";

/** The card as a vCard, which phones import straight into their contacts. */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
	const { token } = await params;
	const env = getEnv();
	const card = await findPublicBusinessCard(env, token);
	if (!card) return new Response("Card not found", { status: 404 });
	return new Response(buildBusinessCardVcf(card, businessCardPageUrl(businessCardOrigin(env, request), token)), {
		headers: {
			"Content-Type": "text/vcard; charset=utf-8",
			"Content-Disposition": businessCardVcfDisposition(card.name),
			"Cache-Control": "no-store",
			"X-Robots-Tag": "noindex",
		},
	});
}
