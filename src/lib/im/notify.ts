import type { ImSocketEvent } from "./hub-utils";

/** Pushes one event to every open HuLa client of each user. A no-op where there is no hub (Node runtime). */
export async function notifyImUsers(
	env: CloudflareEnv,
	userIds: string[],
	event: ImSocketEvent,
	options?: { requireDelivery?: boolean },
): Promise<void> {
	const hubs = env.IM_HUB;
	if (!hubs) {
		if (options?.requireDelivery) throw new Error("IM notification hub is unavailable");
		return;
	}
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
	const failures: unknown[] = [];
	for (const result of results) {
		if (result.status === "rejected") {
			console.error("IM notification delivery failed:", result.reason);
			failures.push(result.reason);
		}
	}
	if (failures.length && options?.requireDelivery) throw new AggregateError(failures, "IM notification delivery failed");
}

/** Closes every HuLa connection of a user, e.g. after their sessions were revoked. */
export async function disconnectImUser(env: CloudflareEnv, userId: string): Promise<void> {
	await env.IM_HUB?.getByName(userId).fetch("https://mailflare-im/disconnect", { method: "POST" });
}
