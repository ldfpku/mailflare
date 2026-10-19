import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/api/auth";
import { hasValidSessionMutationOrigin } from "@/lib/auth/origin";
import { getEnv } from "@/lib/cloudflare";
import { readJsonBody } from "@/lib/http/request";
import { draftMailTodo } from "@/lib/im/ai";
import { ImChatError } from "@/lib/im/chat-utils";
import { createTodo } from "@/lib/im/todos";

type MailTodoRouteParams = { params: Promise<{ messageId: string }> };

/**
 * "转为待办" in the mail reader. `{ draft: true }` asks Workers AI for a draft
 * (title, deadline, points) that the reader shows for editing; any other body
 * saves `{ title, notes, dueAt }` to the user's 我的待办 in chat.
 */
export async function POST(request: Request, { params }: MailTodoRouteParams) {
	const env = getEnv();
	const { user, error } = await requireSessionUser(env, request);
	if (error) return error;
	if (!hasValidSessionMutationOrigin(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
	const { messageId } = await params;
	let body: Record<string, unknown>;
	try {
		body = (await readJsonBody<Record<string, unknown>>(request, 16 * 1024)) ?? {};
	} catch {
		return NextResponse.json({ error: "Invalid request" }, { status: 400 });
	}
	try {
		if (body.draft === true) return NextResponse.json({ draft: await draftMailTodo(env, user, { mailId: messageId }) });
		return NextResponse.json({ todo: await createTodo(env, user, { title: body.title, notes: body.notes, dueAt: body.dueAt, mailId: messageId }) });
	} catch (todoError) {
		if (todoError instanceof ImChatError) return NextResponse.json({ error: todoError.message }, { status: todoError.status });
		throw todoError;
	}
}
