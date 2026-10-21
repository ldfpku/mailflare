/** Pure helpers for group announcements (`announcements.ts`). */

export const IM_ANNOUNCEMENT_LIMIT = 2000;
/** At most this many announcements per page of HuLa's announcement list. */
export const IM_ANNOUNCEMENT_PAGE_LIMIT = 50;

export interface ImAnnouncementRow {
	id: number;
	room_id: string;
	uid: string;
	content: string;
	top: number;
	created_at: number;
	updated_at: number;
	user_name?: string | null;
	user_email?: string | null;
}

/** The text of a new or edited announcement: trimmed, never empty, within the limit. */
export function parseAnnouncementContent(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const content = value.replace(/\r\n?/g, "\n").trim();
	return content && content.length <= IM_ANNOUNCEMENT_LIMIT ? content : null;
}

/** Page and size of HuLa's `current`/`size` paging, kept in range. */
export function parseAnnouncementPage(current: unknown, size: unknown): { page: number; size: number } {
	const page = Math.max(Math.trunc(Number(current)) || 1, 1);
	const pageSize = Math.min(Math.max(Math.trunc(Number(size)) || 10, 1), IM_ANNOUNCEMENT_PAGE_LIMIT);
	return { page, size: pageSize };
}

/** HuLa's announcement record, as its list window and announcement card read it. */
export function toImAnnouncement(row: ImAnnouncementRow) {
	return {
		id: String(row.id),
		roomId: row.room_id,
		uid: row.uid,
		userName: row.user_name || row.user_email || "",
		content: row.content,
		top: Boolean(row.top),
		createTime: row.created_at,
		updateTime: row.updated_at,
	};
}
