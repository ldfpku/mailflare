import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/api/auth";
import { isPrimaryAdmin } from "@/lib/auth/admin";
import { getEnv } from "@/lib/cloudflare";
import { readJsonBody } from "@/lib/http/request";
import { previewImPurge, runImPurge } from "@/lib/im/purge";
import { IM_PURGE_CONFIRM_TEXT, IM_PURGE_DEFAULT_REAL_EMAILS, parseImPurgeCategories, parseImPurgeEmails } from "@/lib/im/purge-utils";

/** What "清理聊天测试数据" would remove, per category; `real` lists the real colleagues' addresses. */
export async function GET(request: Request) {
	const env = getEnv();
	const auth = await requireSessionUser(env, request);
	if (auth.error) return auth.error;
	if (!isPrimaryAdmin(auth.user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	const real = new URL(request.url).searchParams.get("real");
	const emails = real === null ? IM_PURGE_DEFAULT_REAL_EMAILS : parseImPurgeEmails(real);
	return NextResponse.json(await previewImPurge(env, auth.user.id, emails));
}

/** Removes the chosen categories; the body must carry the confirmation text typed by the admin. */
export async function POST(request: Request) {
	const env = getEnv();
	const auth = await requireSessionUser(env, request);
	if (auth.error) return auth.error;
	if (!isPrimaryAdmin(auth.user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	let body: { categories?: unknown; realEmails?: unknown; confirm?: unknown };
	try {
		body = await readJsonBody(request, 16 * 1024);
	} catch {
		return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
	}
	if (body.confirm !== IM_PURGE_CONFIRM_TEXT) return NextResponse.json({ error: `请输入“${IM_PURGE_CONFIRM_TEXT}”` }, { status: 400 });
	const categories = parseImPurgeCategories(body.categories);
	if (!categories.length) return NextResponse.json({ error: "请至少勾选一类" }, { status: 400 });
	const result = await runImPurge(env, auth.user.id, body.realEmails === undefined ? IM_PURGE_DEFAULT_REAL_EMAILS : parseImPurgeEmails(body.realEmails), categories);
	return NextResponse.json(result);
}
