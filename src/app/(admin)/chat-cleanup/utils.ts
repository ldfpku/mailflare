import type { ChatCleanupPreview, ChatCleanupRun } from "./types";

const ENDPOINT = "/api/admin/im-purge";

async function readError(response: Response): Promise<Error> {
	const body = (await response.json().catch(() => null)) as { error?: string } | null;
	return new Error(body?.error || `请求失败（${response.status}）`);
}

/** `realEmails` null asks for the server's default list of real colleagues. */
export async function fetchChatCleanupPreview(realEmails: string | null): Promise<ChatCleanupPreview> {
	const query = realEmails === null ? "" : `?real=${encodeURIComponent(realEmails)}`;
	const response = await fetch(`${ENDPOINT}${query}`, { cache: "no-store" });
	if (!response.ok) throw await readError(response);
	return response.json();
}

export async function runChatCleanup(input: { categories: string[]; realEmails: string[]; confirm: string }): Promise<ChatCleanupRun> {
	const response = await fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
	if (!response.ok) throw await readError(response);
	return response.json();
}

export function splitEmails(value: string): string[] {
	return [...new Set(value.split(/[\s,，;；]+/).map((item) => item.trim().toLowerCase()).filter((item) => item.includes("@")))];
}

export function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function formatTime(value: number | null): string {
	if (!value) return "-";
	return new Date(value).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false });
}

export const CATEGORY_NAMES: Record<string, string> = { test: "测试账号之间", admin: "我本人与测试账号", colleague: "涉及真实同事" };
