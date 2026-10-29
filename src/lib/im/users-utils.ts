/** The HuLa online states. HuLa-Server served these from a table; here they are fixed. */
export const IM_USER_STATES = [
	{ id: "1", title: "在线", url: "", bgColor: "#13987f" },
	{ id: "2", title: "忙碌", url: "", bgColor: "#d5304f" },
	{ id: "3", title: "离开", url: "", bgColor: "#f0a020" },
	{ id: "4", title: "请勿打扰", url: "", bgColor: "#909090" },
	{ id: "5", title: "隐身", url: "", bgColor: "#909090" },
] as const;

export const IM_DEFAULT_USER_STATE_ID = "1";
export const IM_INVISIBLE_USER_STATE_ID = "5";

export function parseImUserStateId(value: unknown): string | null {
	if (value === "0") return IM_DEFAULT_USER_STATE_ID;
	return typeof value === "string" && IM_USER_STATES.some((state) => state.id === value) ? value : null;
}

export interface ImUserSource {
	id: string;
	email: string;
	name: string;
	imDisplayName?: string | null;
	imAvatar?: string | null;
	imStateId?: string | null;
	role: "admin" | "user";
	avatarKey: string | null;
}

/** HuLa's `UserInfoType`. The account a person types to sign in is their mailflare email. */
export function toImUserInfo(user: ImUserSource, origin: string) {
	return {
		uid: user.id,
		account: user.email,
		email: user.email,
		name: user.imDisplayName || user.name,
		avatar: imAvatarUrl(user, origin),
		modifyNameChance: null,
		sex: 1,
		power: user.role === "admin" ? 1 : 0,
		itemIds: [] as string[],
		userStateId: user.imStateId ?? IM_DEFAULT_USER_STATE_ID,
		avatarUpdateTime: 0,
		resume: "",
		oauthProviders: [] as string[],
	};
}

/**
 * HuLa renders avatars in plain `<img>` tags without a token header. Presets
 * resolve locally; uploaded chat and existing mail avatars use a public,
 * versioned-or-revalidated image endpoint.
 */
export function defaultImAvatarForUser(uid: string): string {
	let hash = 2166136261;
	for (let index = 0; index < uid.length; index++) hash = Math.imul(hash ^ uid.charCodeAt(index), 16777619);
	return String(((hash >>> 0) % 22) + 1).padStart(3, "0");
}

export function imAvatarUrl(user: Pick<ImUserSource, "id" | "imAvatar"> & { avatarKey?: string | null }, origin: string): string {
	const avatar = user.imAvatar;
	if (avatar && /^preset:(00[1-9]|01[0-9]|02[0-2])$/.test(avatar)) return avatar.slice(7);
	const url = `${origin}/api/im/avatar/${encodeURIComponent(user.id)}`;
	if (!avatar) return user.avatarKey === null || user.avatarKey === "" ? defaultImAvatarForUser(user.id) : url;
	const match = /^im-avatars\/([a-f0-9]{32})$/.exec(avatar);
	if (!match) throw new Error("Invalid stored chat avatar");
	return `${url}?v=${match[1]}`;
}

/** A group's own picture, or the generated one for its room id. */
export function imRoomAvatarUrl(room: { id: string; avatar: string }, origin: string): string {
	return room.avatar || `${origin}/api/im/room-avatar/${encodeURIComponent(room.id)}`;
}
