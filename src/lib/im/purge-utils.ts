import { IM_FILES_PATH } from "./files-utils";

/**
 * Sorting chat data for the admin "清理聊天测试数据" tool. Every item is filed by the people it involves: anything
 * that touches a real colleague, then anything that touches the admin running the tool, then the rest, which are
 * test accounts talking among themselves. The all-staff group itself stays (it is the organisation directory), so
 * its messages are filed one by one by sender; other rooms go as a whole.
 */
export const IM_PURGE_CATEGORIES = ["test", "admin", "colleague"] as const;
export type ImPurgeCategory = (typeof IM_PURGE_CATEGORIES)[number];

export const IM_PURGE_CATEGORY_LABELS: Record<ImPurgeCategory, string> = {
	test: "测试账号之间的聊天",
	admin: "我本人与测试账号的聊天",
	colleague: "涉及真实同事的聊天",
};

/** Real colleagues may have said something worth keeping, so their category starts unticked. */
export const IM_PURGE_DEFAULT_CATEGORIES: ImPurgeCategory[] = ["test", "admin"];

/** Accounts of real people whose chats are not test data unless the admin says so; editable on the page. */
export const IM_PURGE_DEFAULT_REAL_EMAILS = ["ninggd@smjtools.com", "yangzf@smjtools.com", "zhangzy@smjtools.com"];

export const IM_PURGE_CONFIRM_TEXT = "确认清理";

/** The audit log action of a run; clients read these rows to drop what they still hold locally. */
export const IM_PURGE_AUDIT_ACTION = "im.chat_purge";

/** The all-staff group, which `ensureAllStaffRoom` recreates and the directory depends on. */
export const IM_ALL_STAFF_ROOM_ID = "1";

/** Uploads newer than this may still be on their way into a message. */
export const IM_PURGE_UPLOAD_GRACE_MS = 10 * 60 * 1000;

export type ImPurgeRoom = { id: string; type: number; name: string; memberIds: string[] };
export type ImPurgeMessage = { id: number; roomId: string; fromUid: string; body: string; createdAt: number };
export type ImPurgeFile = { id: string; uploaderId: string; size: number; createdAt: number };
export type ImPurgeMeeting = { id: string; hostId: string; inviteeIds: string[]; createdAt: number };
export type ImPurgeTodo = { id: string; userId: string; createdAt: number };

export type ImPurgeData = {
	rooms: ImPurgeRoom[];
	messages: ImPurgeMessage[];
	files: ImPurgeFile[];
	meetings: ImPurgeMeeting[];
	todos: ImPurgeTodo[];
	/** Chat files a room avatar points at; kept while their room is. */
	roomAvatars: { roomId: string; fileId: string }[];
};

/** One conversation, or the share one sender has in the all-staff group. */
export type ImPurgeUnit = {
	key: string;
	category: ImPurgeCategory;
	roomId: string;
	/** True when the whole room goes; false for one sender's messages in the all-staff group. */
	wholeRoom: boolean;
	senderId: string | null;
	peopleIds: string[];
	messageIds: number[];
	firstAt: number | null;
	lastAt: number | null;
};

export type ImPurgePlan = {
	units: ImPurgeUnit[];
	/** Rooms deleted outright. */
	roomIds: string[];
	/** Messages deleted, whole rooms included. */
	messageIds: number[];
	/** Chat files no remaining message or avatar points at once the messages are gone. */
	fileIds: string[];
	fileBytes: number;
	meetingIds: string[];
	todoIds: string[];
	/** Everyone who was in a touched room, to tell their clients. */
	affectedUserIds: string[];
};

export function categorizePeople(peopleIds: Iterable<string>, adminId: string, realIds: ReadonlySet<string>): ImPurgeCategory {
	let admin = false;
	for (const id of peopleIds) {
		if (realIds.has(id)) return "colleague";
		if (id === adminId) admin = true;
	}
	return admin ? "admin" : "test";
}

/** The chat file ids a stored message body points at (`/api/im/files/<id>/<name>`). */
export function imFileIdsInBody(body: string): string[] {
	const ids = new Set<string>();
	let at = body.indexOf(IM_FILES_PATH);
	while (at !== -1) {
		const start = at + IM_FILES_PATH.length;
		const end = body.indexOf("/", start);
		if (end > start) ids.add(body.slice(start, end));
		at = body.indexOf(IM_FILES_PATH, start);
	}
	return [...ids];
}

/** Splits the chat data into units; nothing is chosen yet. */
export function buildImPurgeUnits(data: ImPurgeData, adminId: string, realIds: ReadonlySet<string>): ImPurgeUnit[] {
	const byRoom = new Map<string, ImPurgeMessage[]>();
	for (const message of data.messages) {
		const list = byRoom.get(message.roomId) ?? [];
		list.push(message);
		byRoom.set(message.roomId, list);
	}
	const span = (messages: ImPurgeMessage[]) => ({
		messageIds: messages.map((message) => message.id),
		firstAt: messages.length ? Math.min(...messages.map((message) => message.createdAt)) : null,
		lastAt: messages.length ? Math.max(...messages.map((message) => message.createdAt)) : null,
	});
	const units: ImPurgeUnit[] = [];
	for (const room of data.rooms) {
		const messages = byRoom.get(room.id) ?? [];
		if (room.id === IM_ALL_STAFF_ROOM_ID) {
			const bySender = new Map<string, ImPurgeMessage[]>();
			for (const message of messages) bySender.set(message.fromUid, [...(bySender.get(message.fromUid) ?? []), message]);
			for (const [senderId, sent] of bySender) {
				units.push({
					key: `${room.id}:${senderId}`,
					category: categorizePeople([senderId], adminId, realIds),
					roomId: room.id,
					wholeRoom: false,
					senderId,
					peopleIds: [senderId],
					...span(sent),
				});
			}
			continue;
		}
		const peopleIds = [...new Set([...room.memberIds, ...messages.map((message) => message.fromUid)])];
		units.push({
			key: room.id,
			category: categorizePeople(peopleIds, adminId, realIds),
			roomId: room.id,
			wholeRoom: true,
			senderId: null,
			peopleIds,
			...span(messages),
		});
	}
	return units;
}

/** What a run with these categories removes. Pure, so the preview and the run cannot disagree. */
export function planImPurge(
	data: ImPurgeData,
	adminId: string,
	realIds: ReadonlySet<string>,
	categories: ReadonlySet<ImPurgeCategory>,
	now: number,
): ImPurgePlan {
	const units = buildImPurgeUnits(data, adminId, realIds).filter((unit) => categories.has(unit.category));
	const roomIds = new Set(units.filter((unit) => unit.wholeRoom).map((unit) => unit.roomId));
	const messageIds = new Set(units.flatMap((unit) => unit.messageIds));

	const referencedByKept = new Set(data.roomAvatars.filter((avatar) => !roomIds.has(avatar.roomId)).map((avatar) => avatar.fileId));
	const referencedByRemoved = new Set<string>();
	for (const message of data.messages) {
		const target = messageIds.has(message.id) ? referencedByRemoved : referencedByKept;
		for (const id of imFileIdsInBody(message.body)) target.add(id);
	}
	const files = data.files.filter((file) => {
		if (referencedByKept.has(file.id)) return false;
		if (referencedByRemoved.has(file.id)) return true;
		// An upload that never reached a message belongs to whoever uploaded it.
		return file.createdAt < now - IM_PURGE_UPLOAD_GRACE_MS && categories.has(categorizePeople([file.uploaderId], adminId, realIds));
	});
	const meetings = data.meetings.filter((meeting) => categories.has(categorizePeople([meeting.hostId, ...meeting.inviteeIds], adminId, realIds)));
	const todos = data.todos.filter((todo) => categories.has(categorizePeople([todo.userId], adminId, realIds)));

	const touchedRooms = new Set(units.map((unit) => unit.roomId));
	const affected = new Set<string>();
	for (const room of data.rooms) if (touchedRooms.has(room.id)) for (const id of room.memberIds) affected.add(id);

	return {
		units,
		roomIds: [...roomIds],
		messageIds: [...messageIds].sort((a, b) => a - b),
		fileIds: files.map((file) => file.id),
		fileBytes: files.reduce((total, file) => total + file.size, 0),
		meetingIds: meetings.map((meeting) => meeting.id),
		todoIds: todos.map((todo) => todo.id),
		affectedUserIds: [...affected],
	};
}

/** Reads the categories a request asked for; unknown names are dropped. */
export function parseImPurgeCategories(value: unknown): ImPurgeCategory[] {
	if (!Array.isArray(value)) return [];
	return IM_PURGE_CATEGORIES.filter((category) => value.includes(category));
}

/** Reads the list of real colleagues' addresses, lower-cased, without blanks or duplicates. */
export function parseImPurgeEmails(value: unknown): string[] {
	const raw = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[\s,，;；]+/) : [];
	return [...new Set(raw.filter((item): item is string => typeof item === "string").map((item) => item.trim().toLowerCase()).filter((item) => item.includes("@")))];
}

/** What a client must drop locally for one run: whole rooms, or single messages in rooms that stay. */
export type ImPurgeRoomChange = { roomId: string; all: boolean; msgIds: string[] };

export function imPurgeRoomChanges(plan: Pick<ImPurgePlan, "units">): ImPurgeRoomChange[] {
	const changes = new Map<string, ImPurgeRoomChange>();
	for (const unit of plan.units) {
		const change = changes.get(unit.roomId) ?? { roomId: unit.roomId, all: unit.wholeRoom, msgIds: [] };
		if (!unit.wholeRoom) change.msgIds.push(...unit.messageIds.map(String));
		changes.set(unit.roomId, change);
	}
	return [...changes.values()];
}

/** Merges the changes of every run after `since` (epoch ms) into one list for a client. */
export function mergeImPurgeRoomChanges(runs: { at: number; rooms: ImPurgeRoomChange[] }[], since: number): { epoch: number; rooms: ImPurgeRoomChange[] } {
	const merged = new Map<string, ImPurgeRoomChange>();
	let epoch = 0;
	for (const run of runs) {
		epoch = Math.max(epoch, run.at);
		if (run.at <= since) continue;
		for (const room of run.rooms) {
			const current = merged.get(room.roomId);
			if (!current) merged.set(room.roomId, { roomId: room.roomId, all: room.all, msgIds: room.all ? [] : [...room.msgIds] });
			else if (room.all || current.all) merged.set(room.roomId, { roomId: room.roomId, all: true, msgIds: [] });
			else current.msgIds.push(...room.msgIds);
		}
	}
	return { epoch, rooms: [...merged.values()] };
}
