import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/api/auth";
import { hasValidSessionMutationOrigin } from "@/lib/auth/origin";
import { getEnv } from "@/lib/cloudflare";
import { readJsonBody } from "@/lib/http/request";
import { ImChatError } from "@/lib/im/chat-utils";
import { listShareTargets, shareMailToChats } from "@/lib/im/mail-share";

type ChatShareRouteParams = { params: Promise<{ messageId: string }> };

function appOrigin(env: CloudflareEnv, request: Request): string {
	return env.APP_URL?.trim().replace(/\/+$/, "") || new URL(request.url).origin;
}

/** The chats the signed-in user can share this message into. */
export async function GET(request: Request) {
	const env = getEnv();
	const { user, error } = await requireSessionUser(env, request);
	if (error) return error;
	return NextResponse.json({ targets: await listShareTargets(env, user.id, appOrigin(env, request)) });
}

/** Posts the message as a mail card into the chats named by `roomIds`. */
export async function POST(request: Request, { params }: ChatShareRouteParams) {
	const env = getEnv();
	const { user, error } = await requireSessionUser(env, request);
	if (error) return error;
	if (!hasValidSessionMutationOrigin(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
	const { messageId } = await params;
	let body: { roomIds?: unknown };
	try {
		body = await readJsonBody(request, 16 * 1024);
	} catch {
		return NextResponse.json({ error: "Invalid request" }, { status: 400 });
	}
	try {
		return NextResponse.json(await shareMailToChats(env, user, messageId, body?.roomIds, appOrigin(env, request)));
	} catch (shareError) {
		if (shareError instanceof ImChatError) return NextResponse.json({ error: shareError.message }, { status: shareError.status });
		throw shareError;
	}
}
