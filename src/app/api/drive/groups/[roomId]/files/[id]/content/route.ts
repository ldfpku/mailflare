import { getEnv } from "@/lib/cloudflare";
import { requireSessionUser } from "@/lib/api/auth";
import { serveRoomFileForDrive } from "@/lib/im/room-files";

type Params = { params: Promise<{ roomId: string; id: string }> };

/** Streams a group chat's file for Drive's Group files view; only current members of the group get it. */
export async function GET(request: Request, { params }: Params) {
	const { roomId, id } = await params;
	const env = getEnv();
	const { user, error } = await requireSessionUser(env, request);
	if (error) return error;
	return serveRoomFileForDrive(env, request, user.id, roomId, id);
}

