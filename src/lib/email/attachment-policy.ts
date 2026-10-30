import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { appSettings } from "@/db/schema";

export const DEFAULT_OUTBOUND_ATTACHMENT_MAX_MB = 500;
export const MAX_OUTBOUND_ATTACHMENT_MAX_MB = 500;
export const CLOUD_ATTACHMENT_THRESHOLD_BYTES = 3_000_000;

export async function getOutboundAttachmentMaxMb(env: CloudflareEnv): Promise<number> {
	const [settings] = await getDb(env)
		.select({ maxMb: appSettings.outboundAttachmentMaxMb })
		.from(appSettings)
		.where(eq(appSettings.id, "default"))
		.limit(1);
	const maxMb = settings?.maxMb ?? DEFAULT_OUTBOUND_ATTACHMENT_MAX_MB;
	if (!Number.isInteger(maxMb) || maxMb < 1 || maxMb > MAX_OUTBOUND_ATTACHMENT_MAX_MB) {
		throw new Error("Invalid outgoing attachment limit");
	}
	return maxMb;
}
