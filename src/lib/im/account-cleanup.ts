import { ensureAllStaffRoom } from "./chat";
import { IM_ROLE, IM_ROOM_TYPE } from "./chat-utils";
import { disconnectImUser } from "./notify";

/**
 * Takes deleted accounts out of chat right away: their HuLa sockets close, they leave the all-staff group and
 * show as offline. Their rooms and messages stay, so a restored account finds its chats again.
 */
export async function suspendImUsers(env: CloudflareEnv, userIds: string[]): Promise<void> {
	if (!userIds.length) return;
	await Promise.allSettled(userIds.map((userId) => disconnectImUser(env, userId)));
	await env.DB.batch(userIds.map((userId) => env.DB.prepare("UPDATE im_presence SET online = 0 WHERE user_id = ?").bind(userId)));
	await ensureAllStaffRoom(env);
}

/**
 * Removes an account's chat data before the account row is purged. One-to-one rooms go with their messages, since
 * the other side could no longer reply; groups it owned pass to the longest-standing admin, else member, and a group
 * left empty is deleted. Membership and presence rows then cascade with the user.
 */
export async function purgeImUser(env: CloudflareEnv, userId: string): Promise<void> {
	const db = env.DB;
	await db
		.prepare("DELETE FROM im_rooms WHERE type = ? AND id IN (SELECT room_id FROM im_room_members WHERE user_id = ?)")
		.bind(IM_ROOM_TYPE.SINGLE, userId)
		.run();
	const owned = await db.prepare("SELECT id FROM im_rooms WHERE type = ? AND owner_id = ?").bind(IM_ROOM_TYPE.GROUP, userId).all<{ id: string }>();
	for (const room of owned.results) {
		const successor = await db
			.prepare("SELECT user_id FROM im_room_members WHERE room_id = ? AND user_id <> ? ORDER BY role, created_at LIMIT 1")
			.bind(room.id, userId)
			.first<{ user_id: string }>();
		if (!successor) {
			await db.prepare("DELETE FROM im_rooms WHERE id = ?").bind(room.id).run();
			continue;
		}
		await db.batch([
			db.prepare("UPDATE im_room_members SET role = ? WHERE room_id = ? AND user_id = ?").bind(IM_ROLE.OWNER, room.id, successor.user_id),
			db.prepare("UPDATE im_rooms SET owner_id = ? WHERE id = ?").bind(successor.user_id, room.id),
		]);
	}
}
