import { asc } from "drizzle-orm";
import { getDb } from "@/db";
import { domains } from "@/db/schema";
import { completeLoginEmail } from "./login-domain-utils";

/**
 * The domain a bare sign-in name is completed with: `LOGIN_DOMAIN` when set,
 * otherwise the first domain added to the install. Null before setup.
 */
export async function getLoginDomain(env: CloudflareEnv): Promise<string | null> {
	const configured = env.LOGIN_DOMAIN?.trim().replace(/^@/, "").toLowerCase();
	if (configured) return configured;
	const [row] = await getDb(env).select({ hostname: domains.hostname }).from(domains).orderBy(asc(domains.createdAt)).limit(1);
	return row?.hostname ?? null;
}

/** The address a sign-in request names, with the login domain added to a bare name. */
export async function resolveLoginEmail(env: CloudflareEnv, input: string): Promise<string> {
	const value = input.trim();
	return value.includes("@") ? value : completeLoginEmail(value, await getLoginDomain(env));
}
