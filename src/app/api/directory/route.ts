import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/api/auth";
import { getEnv } from "@/lib/cloudflare";
import { searchDirectory } from "@/lib/im/chat";

/** Colleagues for the composer's recipient suggestions: every active account, matched like the chat search box. */
export async function GET(request: Request) {
	const env = getEnv();
	const { error } = await requireSessionUser(env, request);
	if (error) return error;
	const rows = await searchDirectory(env, new URL(request.url).searchParams.get("q"), { limit: 8 });
	return NextResponse.json({
		people: rows.map((row) => ({ name: row.name || "", email: row.email, department: row.department ?? "", title: row.title ?? "" })),
	});
}
