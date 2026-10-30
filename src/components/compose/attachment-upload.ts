import { authFetch } from "@/lib/auth/client";
import type { ComposeStoredAttachment } from "./types";

type Session = { id: string; partSize: number; parts: number; uploaded: Set<number> };
export type AttachmentUploadSessions = Map<string, Session>;
const RETRIES = 3;

async function responseError(response: Response) {
	const payload = await response.json().catch(() => null) as { error?: string } | null;
	return new Error(payload?.error ?? `Upload failed (${response.status})`);
}

function assertActive(active: () => boolean) {
	if (!active()) throw new Error("The account or draft changed during upload");
}

export async function uploadLargeDraftAttachment(
	draftId: string, file: File, fingerprint: string, sessions: AttachmentUploadSessions,
	onProgress: (percentage: number) => void, active: () => boolean,
): Promise<ComposeStoredAttachment> {
	const base = `/api/drafts/${encodeURIComponent(draftId)}/attachments/uploads`;
	assertActive(active);
	let session = sessions.get(fingerprint);
	if (!session) {
		const response = await authFetch(base, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type, fingerprint }),
		});
		if (!response.ok) throw await responseError(response);
		assertActive(active);
		const data = await response.json() as { id?: unknown; partSize?: unknown; parts?: unknown; uploaded?: unknown };
		const { id, partSize, parts, uploaded } = data;
		if (typeof id !== "string" || typeof partSize !== "number" || !Number.isSafeInteger(partSize) ||
			partSize <= 0 || typeof parts !== "number" || !Number.isSafeInteger(parts) ||
			parts !== Math.ceil(file.size / partSize) || !Array.isArray(uploaded) ||
			uploaded.some((part) => !Number.isInteger(part) || part < 1 || part > parts)) {
			throw new Error("Invalid upload session");
		}
		session = { id, partSize, parts, uploaded: new Set(uploaded) };
		sessions.set(fingerprint, session);
	}
	const target = `${base}/${encodeURIComponent(session.id)}`;
	const partBytes = (part: number) => Math.min(session.partSize, file.size - (part - 1) * session.partSize);
	let sent = [...session.uploaded].reduce((total, part) => total + partBytes(part), 0);
	onProgress(Math.min(99, Math.floor(sent * 100 / file.size)));
	for (let part = 1; part <= session.parts; part++) {
		if (session.uploaded.has(part)) continue;
		assertActive(active);
		const blob = file.slice((part - 1) * session.partSize, part * session.partSize);
		for (let attempt = 1; ; attempt++) {
			try {
				const response = await authFetch(`${target}?part=${part}`, {
					method: "PUT", headers: { "Content-Type": "application/octet-stream" }, body: blob,
				});
				if (!response.ok) throw await responseError(response);
				assertActive(active);
				break;
			} catch (error) {
				assertActive(active);
				if (attempt >= RETRIES) throw error;
			}
		}
		session.uploaded.add(part);
		sent += blob.size;
		onProgress(Math.min(99, Math.floor(sent * 100 / file.size)));
	}
	assertActive(active);
	const finish = await authFetch(target, { method: "POST" });
	if (!finish.ok) throw await responseError(finish);
	assertActive(active);
	const data = await finish.json() as { attachment?: ComposeStoredAttachment };
	if (!data.attachment || data.attachment.id !== session.id || data.attachment.size !== file.size) {
		throw new Error("Invalid completed attachment");
	}
	sessions.delete(fingerprint);
	onProgress(100);
	return data.attachment;
}

export async function cancelLargeDraftAttachment(draftId: string, fingerprint: string, sessions: AttachmentUploadSessions) {
	const session = sessions.get(fingerprint);
	if (!session) return;
	const response = await authFetch(`/api/drafts/${encodeURIComponent(draftId)}/attachments/uploads/${encodeURIComponent(session.id)}`, { method: "DELETE" });
	if (response.status === 404) {
		const attachment = await authFetch(`/api/drafts/${encodeURIComponent(draftId)}/attachments/${encodeURIComponent(session.id)}`, { method: "DELETE" });
		if (!attachment.ok && attachment.status !== 404) throw await responseError(attachment);
	} else if (!response.ok) throw await responseError(response);
	sessions.delete(fingerprint);
}
