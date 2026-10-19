import { getEnv } from "@/lib/cloudflare";
import { handleImRequest } from "@/lib/im/handler";

async function handle(request: Request) {
	return handleImRequest(request, getEnv());
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const DELETE = handle;
export const HEAD = handle;
export const dynamic = "force-dynamic";
