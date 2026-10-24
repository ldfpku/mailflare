import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { mailboxes } from "@/db/schema";
import { newId } from "@/lib/ids";
import { ensureMailboxDomainRouting, removeMailboxDomainRouting } from "@/lib/mailboxes/domain-addresses";
import { requireGroupRole } from "./chat";
import { ImChatError } from "./chat-utils";
import { parseRoomMailboxLocalPart, suggestRoomMailboxLocalPart, type RoomMailboxState } from "./room-mailbox-utils";

/**
 * Group mail addresses. Turning one on creates a shared mailbox owned by the
 * manager who did it; mail delivered there is posted into the group as a mail
 * card (`postRoomMailCard` in `mail-share.ts`) instead of notifying the owner.
 * Turning it off disables the mailbox and removes its Cloudflare route, so the
 * address and the mail it already received come back when it is turned on again.
 */
type Env = CloudflareEnv;

interface LinkedMailbox {
	mailbox_id: string;
	domain_id: string;
	local_part: string;
	use_all_domains: number;
	disabled: number;
	hostname: string;
}

async function findLinkedMailbox(env: Env, roomId: string): Promise<LinkedMailbox | null> {
	return env.DB.prepare(
		`SELECT l.mailbox_id, m.domain_id, m.local_part, m.use_all_domains, m.disabled, d.hostname
		FROM im_room_mailboxes l JOIN mailboxes m ON m.id = l.mailbox_id JOIN domains d ON d.id = m.domain_id
		WHERE l.room_id = ?`,
	)
		.bind(roomId)
		.first<LinkedMailbox>();
}

/** The domain a user's new group address goes on: the one their own mailbox is on. */
async function findUserDomain(env: Env, userId: string): Promise<{ id: string; hostname: string } | null> {
	return env.DB.prepare(
		`SELECT d.id, d.hostname FROM mailboxes m JOIN domains d ON d.id = m.domain_id
		WHERE m.user_id = ? AND m.type = 'personal' AND m.disabled = 0 AND d.receiving_provider <> 'none'
		ORDER BY m.created_at LIMIT 1`,
	)
		.bind(userId)
		.first<{ id: string; hostname: string }>();
}

function routingInput(linked: LinkedMailbox) {
	return { id: linked.mailbox_id, domainId: linked.domain_id, localPart: linked.local_part, useAllDomains: Boolean(linked.use_all_domains) };
}

export async function getRoomMailbox(env: Env, userId: string, roomId: unknown): Promise<RoomMailboxState> {
	const role = await requireGroupRole(env, roomId, userId);
	const linked = await findLinkedMailbox(env, role.roomId);
	const domain = linked ? { hostname: linked.hostname } : await findUserDomain(env, userId);
	return {
		address: linked ? `${linked.local_part}@${linked.hostname}` : null,
		enabled: linked ? !linked.disabled : false,
		canManage: role.manager,
		suggestedLocalPart: linked?.local_part ?? suggestRoomMailboxLocalPart(role.roomId),
		domain: domain?.hostname ?? null,
	};
}

/** Turns the group's address on, creating it with `localPart` the first time. */
export async function enableRoomMailbox(
	env: Env,
	userId: string,
	input: { roomId?: unknown; localPart?: unknown },
	origin: string,
): Promise<RoomMailboxState> {
	const role = await requireGroupRole(env, input.roomId, userId);
	if (!role.manager) throw new ImChatError(403, "只有群主和管理员可以设置群邮箱");
	const db = getDb(env);
	const linked = await findLinkedMailbox(env, role.roomId);
	if (linked) {
		if (linked.disabled) {
			await ensureMailboxDomainRouting(env, db, routingInput(linked));
			await db.update(mailboxes).set({ disabled: false }).where(eq(mailboxes.id, linked.mailbox_id));
		}
		return getRoomMailbox(env, userId, role.roomId);
	}

	const localPart = parseRoomMailboxLocalPart(input.localPart);
	if (!localPart) throw new ImChatError(400, "邮箱名只能用小写字母、数字和 . _ -，且不能以符号开头或结尾");
	const domain = await findUserDomain(env, userId);
	if (!domain) throw new ImChatError(400, "你的账号没有可收信的邮箱域名，无法创建群邮箱");
	const taken = await env.DB.prepare(
		`SELECT 1 FROM mailboxes WHERE domain_id = ? AND local_part = ?
		UNION ALL SELECT 1 FROM mailbox_aliases WHERE domain_id = ? AND local_part = ? LIMIT 1`,
	)
		.bind(domain.id, localPart, domain.id, localPart)
		.first();
	if (taken) throw new ImChatError(400, `${localPart}@${domain.hostname} 已被占用，请换一个`);

	const room = await env.DB.prepare("SELECT name FROM im_rooms WHERE id = ?").bind(role.roomId).first<{ name: string }>();
	const mailboxId = newId("mbx");
	await db.insert(mailboxes).values({
		id: mailboxId,
		userId,
		domainId: domain.id,
		localPart,
		displayName: room?.name || null,
		type: "shared",
		useAllDomains: false,
	});
	try {
		await ensureMailboxDomainRouting(env, db, { id: mailboxId, domainId: domain.id, localPart, useAllDomains: false });
		await env.DB.prepare("INSERT INTO im_room_mailboxes (room_id, mailbox_id, enabled_by, origin, created_at) VALUES (?, ?, ?, ?, ?)")
			.bind(role.roomId, mailboxId, userId, origin, Date.now())
			.run();
	} catch (error) {
		await db.delete(mailboxes).where(eq(mailboxes.id, mailboxId));
		console.error("Group mailbox setup failed", error);
		throw new ImChatError(400, "创建群邮箱失败，请稍后再试");
	}
	return getRoomMailbox(env, userId, role.roomId);
}

/** Turns the group's address off; the mailbox and its mail are kept. */
export async function disableRoomMailbox(env: Env, userId: string, roomId: unknown): Promise<RoomMailboxState> {
	const role = await requireGroupRole(env, roomId, userId);
	if (!role.manager) throw new ImChatError(403, "只有群主和管理员可以设置群邮箱");
	const linked = await findLinkedMailbox(env, role.roomId);
	if (linked && !linked.disabled) {
		await getDb(env).update(mailboxes).set({ disabled: true }).where(eq(mailboxes.id, linked.mailbox_id));
		try {
			await removeMailboxDomainRouting(env, getDb(env), routingInput(linked));
		} catch (error) {
			// The disabled mailbox already refuses the mail; a stale route only reaches the Worker.
			console.error("Group mailbox route removal failed", error);
		}
	}
	return getRoomMailbox(env, userId, role.roomId);
}

/** The group a mailbox delivers into, if it is a group address. */
export async function findMailboxRoom(env: Env, mailboxId: string): Promise<{ roomId: string; enabledBy: string; origin: string } | null> {
	const row = await env.DB.prepare("SELECT room_id, enabled_by, origin FROM im_room_mailboxes WHERE mailbox_id = ?")
		.bind(mailboxId)
		.first<{ room_id: string; enabled_by: string; origin: string }>();
	return row ? { roomId: row.room_id, enabledBy: row.enabled_by, origin: row.origin } : null;
}
