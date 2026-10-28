import type { ImSocketEvent } from "./hub-utils";

/** Pushes one event to every open HuLa client of each user. A no-op where there is no hub (Node runtime). */
export async function notifyImUsers(env: CloudflareEnv, userIds: string[], event: ImSocketEvent): Promise<void> {
	const hubs = env.IM_HUB;
	if (!hubs) return;
	const body = JSON.stringify(event);
	const results = await Promise.allSettled(
		[...new Set(userIds)].map(async (userId) => {
			const response = await hubs.getByName(userId).fetch("https://mailflare-im/notify", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body,
			});
			if (!response.ok) throw new Error(`IM notification delivery returned ${response.status}`);
		}),
	);
	for (const result of results) {
		if (result.status === "rejected") console.error("IM notification delivery failed:", result.reason);
	}
}

/** Closes every HuLa connection of a user, e.g. after their sessions were revoked. */
export async function disconnectImUser(env: CloudflareEnv, userId: string): Promise<void> {
	await env.IM_HUB?.getByName(userId).fetch("https://mailflare-im/disconnect", { method: "POST" });
}
