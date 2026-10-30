import { getCurrentUser } from "@/lib/auth/cookies";
import { hasValidSessionMutationOrigin } from "@/lib/auth/origin";
import { getEnv } from "@/lib/cloudflare";
import { MailUploadError, startMailAttachmentUpload } from "@/lib/email/attachment-uploads";
import type { DraftAttachmentUploadParams } from "../types";

async function readUploadMetadata(request: Request) {
	const limit = 16 * 1024;
	const length = Number(request.headers.get("content-length") ?? 0);
	if (length > limit) throw new MailUploadError("Attachment request is too large", 413);
	const reader = request.body?.getReader();
	if (!reader) throw new MailUploadError("Invalid attachment request", 400);
	const chunks: Uint8Array[] = [];
	let total = 0;
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		total += value.byteLength;
		if (total > limit) {
			await reader.cancel();
			throw new MailUploadError("Attachment request is too large", 413);
		}
		chunks.push(value);
	}
	const bytes = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
	try {
		const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid metadata");
		return parsed as { name?: unknown; size?: unknown; contentType?: unknown; fingerprint?: unknown };
	} catch {
		throw new MailUploadError("Invalid attachment request", 400);
	}
}

export async function POST(request: Request, { params }: DraftAttachmentUploadParams) {
	const { id } = await params;
	const env = getEnv();
	const user = await getCurrentUser(env, request);
	if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
	if (!hasValidSessionMutationOrigin(request)) return Response.json({ error: "Invalid origin" }, { status: 403 });
	try {
		const input = await readUploadMetadata(request);
		return Response.json(await startMailAttachmentUpload(env, user.id, id, input));
	} catch (error) {
		if (error instanceof MailUploadError) return Response.json({ error: error.message }, { status: error.status });
		console.error("Could not start attachment upload", error);
		return Response.json({ error: "Could not start attachment upload" }, { status: 500 });
	}
}
