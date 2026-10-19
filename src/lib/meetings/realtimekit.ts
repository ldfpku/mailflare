/**
 * The few Cloudflare RealtimeKit REST calls meetings need: create a meeting and
 * add a participant, whose auth token the browser hands to the UI Kit. The
 * API token stays on the server.
 */
export class RealtimeKitNotConfiguredError extends Error {
	constructor() {
		super("视频会议尚未配置（缺少 RealtimeKit 应用或 API 令牌）");
	}
}

export interface RealtimeKitConfig {
	accountId: string;
	appId: string;
	apiToken: string;
	hostPreset: string;
	participantPreset: string;
}

export function getRealtimeKitConfig(env: CloudflareEnv): RealtimeKitConfig | null {
	const accountId = (env.REALTIMEKIT_ACCOUNT_ID || env.CF_ACCOUNT_ID)?.trim();
	const appId = env.REALTIMEKIT_APP_ID?.trim();
	const apiToken = env.REALTIMEKIT_API_TOKEN?.trim();
	if (!accountId || !appId || !apiToken) return null;
	return {
		accountId,
		appId,
		apiToken,
		hostPreset: env.REALTIMEKIT_HOST_PRESET?.trim() || "group_call_host",
		participantPreset: env.REALTIMEKIT_PARTICIPANT_PRESET?.trim() || "group_call_participant",
	};
}

export function requireRealtimeKitConfig(env: CloudflareEnv): RealtimeKitConfig {
	const config = getRealtimeKitConfig(env);
	if (!config) throw new RealtimeKitNotConfiguredError();
	return config;
}

async function call<T>(config: RealtimeKitConfig, path: string, body: unknown): Promise<T> {
	const response = await fetch(
		`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(config.accountId)}/realtime/kit/${encodeURIComponent(config.appId)}${path}`,
		{
			method: "POST",
			headers: { Authorization: `Bearer ${config.apiToken}`, "Content-Type": "application/json" },
			body: JSON.stringify(body),
		},
	);
	const json = (await response.json().catch(() => null)) as
		| { success?: boolean; data?: T; result?: T; errors?: { message?: string }[]; error?: { message?: string } | string }
		| null;
	const data = json?.data ?? json?.result;
	if (!response.ok || json?.success === false || !data) {
		const detail =
			json?.errors?.[0]?.message ?? (typeof json?.error === "string" ? json.error : json?.error?.message) ?? `HTTP ${response.status}`;
		throw new Error(`RealtimeKit: ${detail}`);
	}
	return data;
}

export async function createRealtimeKitMeeting(config: RealtimeKitConfig, title: string): Promise<string> {
	const data = await call<{ id?: string }>(config, "/meetings", { title });
	if (!data.id) throw new Error("RealtimeKit: meeting id missing");
	return data.id;
}

export async function addRealtimeKitParticipant(
	config: RealtimeKitConfig,
	meetingId: string,
	participant: { userId: string; name: string; picture?: string | null; host: boolean },
): Promise<{ id: string; token: string }> {
	const data = await call<{ id?: string; token?: string; authToken?: string }>(
		config,
		`/meetings/${encodeURIComponent(meetingId)}/participants`,
		{
			name: participant.name,
			...(participant.picture ? { picture: participant.picture } : {}),
			preset_name: participant.host ? config.hostPreset : config.participantPreset,
			custom_participant_id: participant.userId,
		},
	);
	const token = data.token ?? data.authToken;
	if (!data.id || !token) throw new Error("RealtimeKit: participant token missing");
	return { id: data.id, token };
}
