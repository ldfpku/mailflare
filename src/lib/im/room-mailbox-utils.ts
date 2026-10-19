/**
 * Pure helpers for group mail addresses. A group's address is a shared mailbox
 * whose mail is posted into the group as mail cards instead of notifying the
 * mailbox owner.
 */

const LOCAL_PART = /^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$/;

/** A lower-cased local part, or null when it is not one a group address may use. */
export function parseRoomMailboxLocalPart(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const localPart = value.trim().toLowerCase();
	if (!LOCAL_PART.test(localPart) || /[._-]{2}/.test(localPart)) return null;
	return localPart;
}

/** The address offered before the manager picks one. */
export function suggestRoomMailboxLocalPart(roomId: string): string {
	return `group-${roomId}`;
}

export interface RoomMailboxState {
	/** The group's address, or null when it never had one. */
	address: string | null;
	enabled: boolean;
	/** Owners and admins may turn the address on and off. */
	canManage: boolean;
	/** Offered when there is no address yet. */
	suggestedLocalPart: string;
	/** The domain a new address is created on, or null when the caller has none. */
	domain: string | null;
}
