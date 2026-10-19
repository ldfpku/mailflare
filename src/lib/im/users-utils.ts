/** The HuLa online states. HuLa-Server served these from a table; here they are fixed. */
export const IM_USER_STATES = [
	{ id: "1", title: "在线", url: "", bgColor: "#13987f" },
	{ id: "2", title: "忙碌", url: "", bgColor: "#d5304f" },
	{ id: "3", title: "离开", url: "", bgColor: "#f0a020" },
	{ id: "4", title: "请勿打扰", url: "", bgColor: "#909090" },
] as const;

export const IM_DEFAULT_USER_STATE_ID = "1";

export interface ImUserSource {
	id: string;
	email: string;
	name: string;
	role: "admin" | "user";
	avatarKey: string | null;
}

/** HuLa's `UserInfoType`. The account a person types to sign in is their mailflare email. */
export function toImUserInfo(user: ImUserSource, origin: string) {
	return {
		uid: user.id,
		account: user.email,
		email: user.email,
		name: user.name,
		avatar: imAvatarUrl(user, origin),
		modifyNameChance: 0,
		sex: 1,
		power: user.role === "admin" ? 1 : 0,
		itemIds: [] as string[],
		userStateId: IM_DEFAULT_USER_STATE_ID,
		avatarUpdateTime: 0,
		resume: "",
		oauthProviders: [] as string[],
	};
}

/**
 * HuLa renders avatars in plain `<img>` tags that cannot carry the token
 * header, so `/api/im/avatar/<uid>` serves a user's own avatar without
 * authentication, the way a mail client shows a sender's picture. Without an
 * upload it serves a generated one (`default-avatar-utils.ts`), so every
 * account has a URL.
 */
export function imAvatarUrl(user: Pick<ImUserSource, "id">, origin: string): string {
	return `${origin}/api/im/avatar/${encodeURIComponent(user.id)}`;
}

/** A group's own picture, or the generated one for its room id. */
export function imRoomAvatarUrl(room: { id: string; avatar: string }, origin: string): string {
	return room.avatar || `${origin}/api/im/room-avatar/${encodeURIComponent(room.id)}`;
}
