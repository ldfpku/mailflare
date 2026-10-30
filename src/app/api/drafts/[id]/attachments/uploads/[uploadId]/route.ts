import { getCurrentUser } from "@/lib/auth/cookies";
import { hasValidSessionMutationOrigin } from "@/lib/auth/origin";
import { getEnv } from "@/lib/cloudflare";
import { cancelMailAttachmentUpload, completeMailAttachmentUpload, MailUploadError, uploadMailAttachmentPart } from "@/lib/email/attachment-uploads";

type Params = { params: Promise<{ id: string; uploadId: string }> };

async function handle(request: Request, params: Params["params"], action: "part" | "complete" | "cancel") {
	const { id, uploadId } = await params;
	const env = getEnv();
	const user = await getCurrentUser(env, request);
	if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
	if (!hasValidSessionMutationOrigin(request)) return Response.json({ error: "Invalid origin" }, { status: 403 });
	try {
		if (action === "part") await uploadMailAttachmentPart(env, user.id, id, uploadId, request);
		else if (action === "complete") return Response.json({ attachment: await completeMailAttachmentUpload(env, user.id, id, uploadId) });
		else await cancelMailAttachmentUpload(env, user.id, id, uploadId);
		return Response.json({ ok: true });
	} catch (error) {
		if (error instanceof MailUploadError) return Response.json({ error: error.message }, { status: error.status });
		console.error("Attachment upload failed", error);
		return Response.json({ error: "Attachment upload failed" }, { status: 500 });
	}
}

export const PUT = (request: Request, { params }: Params) => handle(request, params, "part");
export const POST = (request: Request, { params }: Params) => handle(request, params, "complete");
export const DELETE = (request: Request, { params }: Params) => handle(request, params, "cancel");
