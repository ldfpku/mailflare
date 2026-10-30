import { newId } from "@/lib/ids";
import { ImChatError } from "./chat-utils";
import { findReadableMail } from "./ai";
import { isMailShareId } from "./mail-share-utils";
import { dateOnlyDeadline, makeTodoRepeat, nextTodoOccurrence, todoDayInTimeZone, type TodoRepeatRule } from "./todo-repeat";
import {
	IM_TODO_LIMIT,
	IM_TODO_PAGE_LIMIT,
	parseTodoDue,
	parseTodoDay,
	parseTodoNotes,
	parseTodoStatus,
	parseTodoTitle,
	parseTodoVersion,
	toImTodo,
	type ImTodo,
	type ImTodoRow,
} from "./todos-utils";
import type { ImUser } from "./tokens";

/**
 * "我的待办": a person's own to-dos, kept in `im_todos` (migration 0076). Every
 * query is scoped to the caller, so ids from other people are simply not found.
 * A to-do made from a mail records the mail, and the caller must be able to
 * read that mail (its mailbox, or a chat it was shared into) when it is made.
 */
type Env = CloudflareEnv;

const COLUMNS = "id, user_id, title, notes, due_at, due_date, due_timezone, done, done_at, source_type, source_id, source_title, source_share_id, list_id, assignee_id, important, version, remind_at, reminder_revision, repeat_kind, repeat_timezone, repeat_time, repeat_anchor_day, repeat_anchor_month, next_occurrence_id, created_at, updated_at";

type Deadline = { dueAt: number | null; dueDate: string | null; dueTimeZone: string | null };

function todoQuota(env: Env): number {
	const raw = env.IM_TODO_LIMIT;
	if (raw === undefined) return IM_TODO_LIMIT;
	const value = Number(raw);
	if (!/^\d+$/.test(raw) || !Number.isSafeInteger(value) || value < 1 || value > 1_000_000) {
		throw new Error("IM_TODO_LIMIT must be an integer from 1 to 1000000");
	}
	return value;
}

function deadlineInput(input: Record<string, unknown>, previous: Deadline): Deadline {
	if (input.dueDate !== undefined && input.dueDate !== null && input.dueDate !== "") {
		const day = parseTodoDay(input.dueDate);
		if (!day || typeof input.dueTimeZone !== "string" || !input.dueTimeZone || input.dueTimeZone.length > 128 || (input.dueAt !== undefined && input.dueAt !== null)) {
			throw new ImChatError(400, "截止日期或时区无效");
		}
		const result = dateOnlyDeadline(day, input.dueTimeZone);
		if (!result || parseTodoDue(result.dueAt) === undefined) throw new ImChatError(400, "截止日期或时区无效");
		return { dueAt: result.dueAt, dueDate: day, dueTimeZone: result.timeZone };
	}
	if (input.dueTimeZone !== undefined && input.dueTimeZone !== null) throw new ImChatError(400, "截止日期或时区无效");
	if (input.dueAt !== undefined || input.dueDate !== undefined) {
		const dueAt = parseTodoDue(input.dueAt ?? null);
		if (dueAt === undefined) throw new ImChatError(400, "截止时间无效");
		return { dueAt, dueDate: null, dueTimeZone: null };
	}
	return previous;
}

function repeatInput(value: unknown, deadline: Deadline): TodoRepeatRule | null {
	if (value === null || value === undefined) return null;
	if (typeof value !== "object" || Array.isArray(value) || !("kind" in value) || !("timeZone" in value)) {
		throw new ImChatError(400, "重复规则无效");
	}
	const rule = makeTodoRepeat(value.kind, value.timeZone, deadline.dueAt, deadline.dueDate);
	if (!rule) throw new ImChatError(400, "重复任务需要有效的截止时间和时区");
	if (deadline.dueDate && rule.timeZone !== deadline.dueTimeZone) throw new ImChatError(400, "重复时区必须与截止日期时区一致");
	return rule;
}

function applyRepeat(row: ImTodoRow, rule: TodoRepeatRule | null) {
	row.repeat_kind = rule?.kind ?? null;
	row.repeat_timezone = rule?.timeZone ?? null;
	row.repeat_time = rule?.time ?? null;
	row.repeat_anchor_day = rule?.anchorDay ?? null;
	row.repeat_anchor_month = rule?.anchorMonth ?? null;
}

function storedRepeat(row: ImTodoRow): TodoRepeatRule | null {
	if (!row.repeat_kind) return null;
	if (!row.repeat_timezone || !row.repeat_time || !row.repeat_anchor_day || !row.repeat_anchor_month) throw new Error("Stored to-do repeat rule is incomplete");
	return { kind: row.repeat_kind, timeZone: row.repeat_timezone, time: row.repeat_time, anchorDay: row.repeat_anchor_day, anchorMonth: row.repeat_anchor_month };
}

async function visibleTodos(env: Env, userId: string, rows: ImTodoRow[]): Promise<ImTodo[]> {
	const days = new Map<string, string>();
	for (let index = 0; index < rows.length; index += 80) {
		const chunk = rows.slice(index, index + 80).map((row) => row.id);
		const result = await env.DB.prepare(
			`SELECT todo_id, day FROM im_todo_day_entries WHERE user_id = ? AND todo_id IN (${chunk.map(() => "?").join(",")})`,
		).bind(userId, ...chunk).all<{ todo_id: string; day: string }>();
		for (const item of result.results) days.set(item.todo_id, item.day);
	}
	const ids = [...new Set(rows.flatMap((row) => row.source_type === "mail" && row.source_id ? [row.source_id] : []))];
	const shares = [...new Set(rows.flatMap((row) => row.source_share_id ? [row.source_share_id] : []))];
	const readable = new Set<string>();
	const readableShares = new Map<string, string>();
	for (let index = 0; index < ids.length; index += 80) {
		const chunk = ids.slice(index, index + 80);
		const result = await env.DB.prepare(
			`SELECT m.id FROM messages m JOIN mailboxes b ON b.id = m.mailbox_id
			WHERE m.id IN (${chunk.map(() => "?").join(",")}) AND b.disabled = 0
			AND (b.user_id = ? OR (b.type = 'shared' AND EXISTS
				(SELECT 1 FROM mailbox_access a WHERE a.mailbox_id = b.id AND a.user_id = ? AND a.permission IN ('read_only', 'send_on_behalf', 'send_as', 'full_access'))))`,
		).bind(...chunk, userId, userId).all<{ id: string }>();
		for (const item of result.results) readable.add(item.id);
	}
	for (let index = 0; index < shares.length; index += 80) {
		const chunk = shares.slice(index, index + 80);
		const result = await env.DB.prepare(
			`SELECT s.id, s.message_id FROM im_mail_shares s JOIN im_room_members m ON m.room_id = s.room_id
			JOIN messages msg ON msg.id = s.message_id WHERE s.id IN (${chunk.map(() => "?").join(",")}) AND m.user_id = ?`,
		).bind(...chunk, userId).all<{ id: string; message_id: string }>();
		for (const item of result.results) readableShares.set(item.id, item.message_id);
	}
	return rows.map((row) => {
		const todo = toImTodo(row, days.get(row.id) ?? null);
		if (row.source_type !== "mail" || !row.source_id) return todo;
		if (readable.has(row.source_id)) return todo;
		if (row.source_share_id && readableShares.get(row.source_share_id) === row.source_id) {
			return { ...todo, sourcePath: `/api/im/mail/share/${encodeURIComponent(row.source_share_id)}` };
		}
		return { ...todo, sourceId: null, sourceTitle: "", sourcePath: null };
	});
}

export async function listTodos(env: Env, userId: string, status: string | null): Promise<ImTodo[]> {
	const which = parseTodoStatus(status);
	const where = which === "open" ? "AND done = 0" : which === "done" ? "AND done = 1" : "";
	// Open items by deadline (none last), then newest; finished ones most recently finished first.
	const order = which === "done" ? "done_at DESC" : "done, due_at IS NULL, due_at, created_at DESC";
	const result = await env.DB.prepare(`SELECT ${COLUMNS} FROM im_todos WHERE user_id = ? ${where} ORDER BY ${order} LIMIT ?`)
		.bind(userId, IM_TODO_PAGE_LIMIT)
		.all<ImTodoRow>();
	return visibleTodos(env, userId, result.results);
}

export async function pageTodos(env: Env, userId: string, params: URLSearchParams) {
	const status = params.get("status") ?? "open";
	if (status !== "open" && status !== "done" && status !== "all") throw new ImChatError(400, "待办状态无效");
	const view = params.get("view") ?? "tasks";
	if (!["all", "owned", "tasks", "important", "planned", "day", "assigned", "list"].includes(view)) throw new ImChatError(400, "待办视图无效");
	const listId = view === "list" ? params.get("listId") : null;
	if (view === "list") {
		if (!listId || listId.length > 256) throw new ImChatError(400, "列表标识无效");
		const list = await env.DB.prepare("SELECT id FROM im_todo_lists WHERE id = ? AND user_id = ?").bind(listId, userId).first<{ id: string }>();
		if (!list) throw new ImChatError(404, "列表不存在");
	}
	const day = view === "day" ? parseTodoDay(params.get("day")) : null;
	if (view === "day" && !day) throw new ImChatError(400, "日期无效");
	const query = params.get("q")?.trim() ?? "";
	if (query.length > 100) throw new ImChatError(400, "搜索内容过长");
	const sort = params.get("sort") ?? "created";
	if (sort !== "created" && sort !== "due" && sort !== "title") throw new ImChatError(400, "排序方式无效");
	const sizeParam = params.get("pageSize");
	const size = sizeParam === null ? 50 : Number(sizeParam);
	if (!Number.isInteger(size) || size < 1 || size > IM_TODO_PAGE_LIMIT) throw new ImChatError(400, "待办分页大小无效");

	const cursor = params.get("cursor");
	let before: { createdAt: number; id: string; key: number | string | null } | null = null;
	if (cursor !== null) {
		if (cursor.length > 1024) throw new ImChatError(400, "待办分页游标无效");
		let decoded: unknown;
		try {
			decoded = JSON.parse(cursor);
		} catch {
			throw new ImChatError(400, "待办分页游标无效");
		}
		if (
			!Array.isArray(decoded) || decoded.length !== 10 || decoded[0] !== 3 || decoded[1] !== status
			|| decoded[2] !== view || decoded[3] !== listId || decoded[4] !== day || decoded[5] !== query
			|| decoded[6] !== sort
			|| (sort === "created" && decoded[7] !== null)
			|| (sort === "due" && decoded[7] !== null && (!Number.isSafeInteger(decoded[7]) || decoded[7] < 0))
			|| (sort === "title" && (typeof decoded[7] !== "string" || decoded[7].length > 100))
			|| !Number.isSafeInteger(decoded[8]) || decoded[8] < 0
			|| typeof decoded[9] !== "string" || !decoded[9] || decoded[9].length > 256
		) throw new ImChatError(400, "待办分页游标无效");
		before = { createdAt: decoded[8], id: decoded[9], key: decoded[7] };
	}

	const sharedView = view === "all" || view === "day";
	const where = [view === "assigned" ? "assignee_id = ?" : sharedView ? "(user_id = ? OR assignee_id = ?)" : "user_id = ?"];
	const values: (string | number)[] = sharedView ? [userId, userId] : [userId];
	if (status !== "all") where.push(status === "open" ? "done = 0" : "done = 1");
	if (view === "tasks") where.push("list_id IS NULL");
	if (view === "important") where.push("important = 1");
	if (view === "planned") where.push("due_at IS NOT NULL");
	if (view === "list" && listId) { where.push("list_id = ?"); values.push(listId); }
	if (view === "day" && day) {
		where.push("EXISTS (SELECT 1 FROM im_todo_day_entries d WHERE d.todo_id = im_todos.id AND d.user_id = ? AND d.day = ?)");
		values.push(userId, day);
	}
	if (query) {
		const pattern = `%${query.replace(/[\\%_]/g, "\\$&")}%`;
		where.push("(title LIKE ? ESCAPE '\\' OR notes LIKE ? ESCAPE '\\')");
		values.push(pattern, pattern);
	}
	if (before) {
		if (sort === "title" && typeof before.key === "string") {
			where.push("(title COLLATE NOCASE > ? COLLATE NOCASE OR (title COLLATE NOCASE = ? COLLATE NOCASE AND (created_at, id) < (?, ?)))");
			values.push(before.key, before.key, before.createdAt, before.id);
		} else if (sort === "due" && typeof before.key === "number") {
			where.push("(due_at IS NULL OR due_at > ? OR (due_at = ? AND (created_at, id) < (?, ?)))");
			values.push(before.key, before.key, before.createdAt, before.id);
		} else if (sort === "due") {
			where.push("(due_at IS NULL AND (created_at, id) < (?, ?))");
			values.push(before.createdAt, before.id);
		} else {
			where.push("(created_at, id) < (?, ?)");
			values.push(before.createdAt, before.id);
		}
	}
	values.push(size + 1);
	const order = sort === "title" ? "title COLLATE NOCASE, created_at DESC, id DESC"
		: sort === "due" ? "(due_at IS NULL), due_at, created_at DESC, id DESC" : "created_at DESC, id DESC";
	const result = await env.DB.prepare(
		`SELECT ${COLUMNS} FROM im_todos WHERE ${where.join(" AND ")} ORDER BY ${order} LIMIT ?`,
	).bind(...values).all<ImTodoRow>();
	const rows = result.results.slice(0, size);
	const hasMore = result.results.length > size;
	const last = rows.at(-1);
	return {
		items: await visibleTodos(env, userId, rows),
		hasMore,
		nextCursor: hasMore && last ? JSON.stringify([3, status, view, listId, day, query, sort, sort === "due" ? last.due_at : sort === "title" ? last.title : null, last.created_at, last.id]) : null,
	};
}

async function findTodo(env: Env, userId: string, id: unknown): Promise<ImTodoRow> {
	const row = typeof id === "string" && id
		? await env.DB.prepare(`SELECT ${COLUMNS} FROM im_todos WHERE id = ? AND (user_id = ? OR assignee_id = ?)`).bind(id, userId, userId).first<ImTodoRow>()
		: null;
	if (!row) throw new ImChatError(404, "待办不存在");
	return row;
}

export async function getTodoDetail(env: Env, userId: string, value: unknown) {
	if (typeof value !== "string" || !value || value.length > 256) throw new ImChatError(400, "待办标识无效");
	const row = await env.DB.prepare(`SELECT ${COLUMNS} FROM im_todos WHERE id = ? AND (user_id = ? OR assignee_id = ?)`)
		.bind(value, userId, userId).first<ImTodoRow>();
	if (!row) return { available: false as const, item: null };
	return { available: true as const, item: (await visibleTodos(env, userId, [row]))[0] };
}

export async function countDueTodos(env: Env, userId: string, params: URLSearchParams) {
	const day = parseTodoDay(params.get("day"));
	const endAt = parseTodoDue(params.get("endAt"));
	if (!day || endAt === undefined || endAt === null) throw new ImChatError(400, "日期无效");
	const row = await env.DB.prepare(
		`SELECT COUNT(*) AS count FROM im_todos WHERE (user_id = ? OR assignee_id = ?) AND done = 0
		AND ((due_date IS NOT NULL AND due_date <= ?) OR (due_date IS NULL AND due_at IS NOT NULL AND due_at <= ?))`,
	).bind(userId, userId, day, endAt).first<{ count: number }>();
	if (!row) throw new Error("Unable to count due to-dos");
	return { due: row.count };
}

function requireVersion(value: unknown): number {
	const result = parseTodoVersion(value);
	if (result === undefined) throw new ImChatError(400, "版本无效，请刷新后重试");
	return result;
}

export async function createTodo(env: Env, user: Pick<ImUser, "id" | "role">, input: Record<string, unknown>): Promise<ImTodo> {
	const title = parseTodoTitle(input.title);
	if (!title) throw new ImChatError(400, "请填写待办内容");
	const deadline = deadlineInput(input, { dueAt: null, dueDate: null, dueTimeZone: null });
	const { dueAt, dueDate, dueTimeZone } = deadline;
	const remindAt = parseTodoDue(input.remindAt ?? null);
	if (remindAt === undefined) throw new ImChatError(400, "提醒时间无效");
	const repeat = repeatInput(input.repeat, deadline);
	if (input.notes !== undefined && typeof input.notes !== "string") throw new ImChatError(400, "备注无效");
	if (input.important !== undefined && typeof input.important !== "boolean") throw new ImChatError(400, "重要标记无效");
	const day = input.myDay === undefined ? null : parseTodoDay(input.myDay);
	if (day === undefined) throw new ImChatError(400, "日期无效");
	const listId = input.listId ?? null;
	if (listId !== null && (typeof listId !== "string" || !listId || listId.length > 256)) throw new ImChatError(400, "列表标识无效");
	if (listId) {
		const list = await env.DB.prepare("SELECT id FROM im_todo_lists WHERE id = ? AND user_id = ?").bind(listId, user.id).first<{ id: string }>();
		if (!list) throw new ImChatError(404, "列表不存在");
	}
	let source: { type: "manual" | "mail"; id: string | null; title: string; shareId: string | null } = { type: "manual", id: null, title: "", shareId: null };
	if (input.mailId !== undefined || input.shareId !== undefined) {
		const mail = await findReadableMail(env, user, { mailId: input.mailId, shareId: input.shareId });
		source = { type: "mail", id: mail.id, title: mail.subject?.trim().slice(0, 200) || "(无主题)", shareId: isMailShareId(input.shareId) ? input.shareId : null };
	}
	const now = Date.now();
	const quota = todoQuota(env);
	const todoId = newId("todo");
	const statement = env.DB.prepare(
		`INSERT INTO im_todos (id, user_id, title, notes, due_at, due_date, due_timezone, done, source_type, source_id, source_title, source_share_id, list_id, important, remind_at, repeat_kind, repeat_timezone, repeat_time, repeat_anchor_day, repeat_anchor_month, created_at, updated_at)
		SELECT ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
		WHERE (SELECT COUNT(*) FROM im_todos WHERE user_id = ?) < ?
		AND (? IS NULL OR EXISTS (SELECT 1 FROM im_todo_lists WHERE id = ? AND user_id = ?))
		RETURNING ${COLUMNS}`,
	)
		.bind(todoId, user.id, title, parseTodoNotes(input.notes), dueAt, dueDate, dueTimeZone, source.type, source.id, source.title, source.shareId, listId, Number(input.important === true), remindAt, repeat?.kind ?? null, repeat?.timeZone ?? null, repeat?.time ?? null, repeat?.anchorDay ?? null, repeat?.anchorMonth ?? null, now, now, user.id, quota, listId, listId, user.id);
	let row: ImTodoRow | null;
	if (day) {
		const results = await env.DB.batch<ImTodoRow>([
			statement,
			env.DB.prepare("INSERT INTO im_todo_day_entries (todo_id, user_id, day, updated_at) SELECT id, user_id, ?, ? FROM im_todos WHERE id = ? AND user_id = ?")
				.bind(day, now, todoId, user.id),
		]);
		row = results[0].results[0] ?? null;
	} else row = await statement.first<ImTodoRow>();
	if (!row) {
		if (listId) {
			const list = await env.DB.prepare("SELECT id FROM im_todo_lists WHERE id = ? AND user_id = ?").bind(listId, user.id).first<{ id: string }>();
			if (!list) throw new ImChatError(404, "列表不存在");
		}
		throw new ImChatError(400, "待办太多了，请先删除一些已完成的待办");
	}
	return (await visibleTodos(env, user.id, [row]))[0];
}

export async function updateTodo(env: Env, userId: string, input: Record<string, unknown>): Promise<ImTodo> {
	const row = await findTodo(env, userId, input.id);
	const expected = requireVersion(input.expectedVersion);
	const allowed = new Set(["id", "expectedVersion", "title", "notes", "dueAt", "dueDate", "dueTimeZone", "remindAt", "repeat", "done", "important", "listId", "assigneeId", "confirmShare"]);
	if (Object.keys(input).some((key) => !allowed.has(key))) throw new ImChatError(400, "待办字段无效");
	const ownerOnly = ["title", "notes", "dueAt", "dueDate", "dueTimeZone", "remindAt", "repeat", "important", "listId", "assigneeId"].some((key) => input[key] !== undefined);
	if (ownerOnly && row.user_id !== userId) throw new ImChatError(403, "只有任务所有者可以修改这些内容");
	const next = { ...row };
	if (input.title !== undefined) {
		const title = parseTodoTitle(input.title);
		if (!title) throw new ImChatError(400, "请填写待办内容");
		next.title = title;
	}
	if (input.notes !== undefined) {
		if (typeof input.notes !== "string") throw new ImChatError(400, "备注无效");
		next.notes = parseTodoNotes(input.notes);
	}
	const deadline = deadlineInput(input, { dueAt: row.due_at, dueDate: row.due_date, dueTimeZone: row.due_timezone });
	next.due_at = deadline.dueAt;
	next.due_date = deadline.dueDate;
	next.due_timezone = deadline.dueTimeZone;
	if (input.remindAt !== undefined) {
		const remindAt = parseTodoDue(input.remindAt);
		if (remindAt === undefined) throw new ImChatError(400, "提醒时间无效");
		next.remind_at = remindAt;
	}
	if (input.repeat !== undefined) {
		const supplied = repeatInput(input.repeat, deadline);
		if (!supplied || supplied.kind !== row.repeat_kind || supplied.timeZone !== row.repeat_timezone || next.due_at !== row.due_at || next.due_date !== row.due_date) {
			applyRepeat(next, supplied);
		}
	} else if (next.repeat_kind && (next.due_at !== row.due_at || next.due_date !== row.due_date)) {
		applyRepeat(next, repeatInput({ kind: next.repeat_kind, timeZone: next.due_timezone ?? next.repeat_timezone }, deadline));
	}
	const reminderBeforeCompletion = next.remind_at;
	const now = Date.now();
	if (input.done !== undefined) {
		if (typeof input.done !== "boolean") throw new ImChatError(400, "完成状态无效");
		const done = input.done;
		if (done !== Boolean(row.done)) next.done_at = done ? now : null;
		next.done = Number(done);
	}
	if (next.done && input.remindAt !== undefined && next.remind_at !== null) throw new ImChatError(400, "已完成的任务不能设置提醒");
	if (next.done && !row.done) next.remind_at = null;
	if (next.remind_at !== row.remind_at || (next.done && !row.done)) next.reminder_revision += 1;
	if (input.important !== undefined) {
		if (typeof input.important !== "boolean") throw new ImChatError(400, "重要标记无效");
		next.important = Number(input.important);
	}
	if (input.listId !== undefined) {
		if (input.listId !== null && (typeof input.listId !== "string" || !input.listId || input.listId.length > 256)) throw new ImChatError(400, "列表标识无效");
		next.list_id = input.listId;
		if (next.list_id) {
			const list = await env.DB.prepare("SELECT id FROM im_todo_lists WHERE id = ? AND user_id = ?").bind(next.list_id, userId).first<{ id: string }>();
			if (!list) throw new ImChatError(404, "列表不存在");
		}
	}
	if (input.assigneeId !== undefined) {
		if (input.assigneeId !== null && (typeof input.assigneeId !== "string" || !input.assigneeId || input.assigneeId.length > 256)) throw new ImChatError(400, "负责人无效");
		next.assignee_id = input.assigneeId;
		if (next.assignee_id && next.assignee_id !== row.assignee_id && next.assignee_id !== userId && input.confirmShare !== true) {
			throw new ImChatError(400, "请确认将任务内容分享给负责人");
		}
		if (next.assignee_id) {
			const assignee = await env.DB.prepare("SELECT id FROM users WHERE id = ? AND disabled = 0 AND deleted_at IS NULL").bind(next.assignee_id).first<{ id: string }>();
			if (!assignee) throw new ImChatError(404, "负责人不存在或已停用");
		}
	}
	const permission = ownerOnly ? "user_id = ?" : "(user_id = ? OR assignee_id = ?)";
	const permissionValues = ownerOnly ? [userId] : [userId, userId];
	const assigneeGuard = input.assigneeId !== undefined && next.assignee_id
		? "AND EXISTS (SELECT 1 FROM users WHERE id = ? AND disabled = 0 AND deleted_at IS NULL)"
		: "";
	const assigneeValues = assigneeGuard && next.assignee_id ? [next.assignee_id] : [];
	const listGuard = input.listId !== undefined && next.list_id
		? "AND EXISTS (SELECT 1 FROM im_todo_lists WHERE id = ? AND user_id = ?)"
		: "";
	const listValues = listGuard && next.list_id ? [next.list_id, userId] : [];
	const repeat = storedRepeat(next);
	let nextDue: number | null = null;
	let nextReminder: number | null = null;
	if (!row.done && next.done && !row.next_occurrence_id && repeat) {
		if (next.due_at === null) throw new ImChatError(400, "重复任务需要截止时间");
		nextDue = nextTodoOccurrence(next.due_at, repeat);
		if (parseTodoDue(nextDue) === undefined) throw new ImChatError(400, "下一次截止时间超出可用范围");
		if (reminderBeforeCompletion !== null) {
			nextReminder = nextDue - (next.due_at - reminderBeforeCompletion);
			if (parseTodoDue(nextReminder) === undefined) throw new ImChatError(400, "下一次提醒时间超出可用范围");
		}
		next.next_occurrence_id = newId("todo");
	}
	const quotaGuard = nextDue !== null ? "AND (SELECT COUNT(*) FROM im_todos WHERE user_id = ?) < ?" : "";
	const quota = nextDue !== null ? todoQuota(env) : null;
	const quotaValues = quota !== null ? [row.user_id, quota] : [];
	const statement = env.DB.prepare(
		`UPDATE im_todos SET title = ?, notes = ?, due_at = ?, due_date = ?, due_timezone = ?, done = ?, done_at = ?, important = ?,
		list_id = ?, assignee_id = ?, remind_at = ?, reminder_revision = ?, repeat_kind = ?, repeat_timezone = ?,
		repeat_time = ?, repeat_anchor_day = ?, repeat_anchor_month = ?, next_occurrence_id = ?,
		version = version + 1, updated_at = ?
		WHERE id = ? AND version = ? AND ${permission} ${assigneeGuard} ${listGuard} ${quotaGuard} RETURNING ${COLUMNS}`,
	)
		.bind(next.title, next.notes, next.due_at, next.due_date, next.due_timezone, next.done, next.done_at, next.important, next.list_id, next.assignee_id, next.remind_at, next.reminder_revision, next.repeat_kind, next.repeat_timezone, next.repeat_time, next.repeat_anchor_day, next.repeat_anchor_month, next.next_occurrence_id, now, row.id, expected, ...permissionValues, ...assigneeValues, ...listValues, ...quotaValues);
	let updated: ImTodoRow | null;
	if (nextDue !== null && next.next_occurrence_id) {
		const occurrenceId = next.next_occurrence_id;
		const results = await env.DB.batch<ImTodoRow>([
			statement,
			env.DB.prepare(
				`INSERT INTO im_todos (id, user_id, title, notes, due_at, due_date, due_timezone, done, source_type, source_id, source_title, source_share_id,
				list_id, assignee_id, important, remind_at, repeat_kind, repeat_timezone, repeat_time, repeat_anchor_day, repeat_anchor_month, created_at, updated_at)
				SELECT ?, user_id, title, notes, ?, ?, due_timezone, 0, source_type, source_id, source_title, source_share_id,
				list_id, assignee_id, important, ?, repeat_kind, repeat_timezone, repeat_time, repeat_anchor_day, repeat_anchor_month, ?, ?
				FROM im_todos WHERE id = ? AND next_occurrence_id = ? AND version = ? AND done = 1`,
			).bind(occurrenceId, nextDue, next.due_date && repeat ? todoDayInTimeZone(nextDue, repeat.timeZone) : null, nextReminder, now, now, row.id, occurrenceId, expected + 1),
			env.DB.prepare(
				`INSERT INTO im_todo_steps (id, todo_id, title, done, position, version, created_at, updated_at)
				SELECT lower(hex(randomblob(16))), ?, s.title, 0, s.position, 1, ?, ?
				FROM im_todo_steps s WHERE s.todo_id = ? AND EXISTS
				(SELECT 1 FROM im_todos WHERE id = ? AND next_occurrence_id = ? AND version = ? AND done = 1)`,
			).bind(occurrenceId, now, now, row.id, row.id, occurrenceId, expected + 1),
			env.DB.prepare(
				`INSERT INTO im_todo_attachments (id, todo_id, drive_item_id, created_at)
				SELECT lower(hex(randomblob(16))), ?, a.drive_item_id, ?
				FROM im_todo_attachments a WHERE a.todo_id = ? AND EXISTS
				(SELECT 1 FROM im_todos WHERE id = ? AND next_occurrence_id = ? AND version = ? AND done = 1)`,
			).bind(occurrenceId, now, row.id, row.id, occurrenceId, expected + 1),
		]);
		updated = results[0].results[0] ?? null;
	} else {
		updated = await statement.first<ImTodoRow>();
	}
	if (!updated) {
		const current = await findTodo(env, userId, row.id);
		if (current.version === expected && nextDue !== null) {
			const count = await env.DB.prepare("SELECT COUNT(*) AS count FROM im_todos WHERE user_id = ?").bind(row.user_id).first<{ count: number }>();
			if (count && quota !== null && count.count >= quota) throw new ImChatError(400, "待办太多了，无法创建下一次重复任务");
		}
		throw new ImChatError(409, "待办已更新，请刷新后重试");
	}
	return (await visibleTodos(env, userId, [updated]))[0];
}

export async function deleteTodo(env: Env, userId: string, input: Record<string, unknown>): Promise<void> {
	const row = await findTodo(env, userId, input.id);
	if (row.user_id !== userId) throw new ImChatError(403, "只有任务所有者可以删除待办");
	const result = await env.DB.prepare("DELETE FROM im_todos WHERE id = ? AND user_id = ? AND version = ?")
		.bind(row.id, userId, requireVersion(input.expectedVersion)).run();
	if (!result.meta.changes) {
		await findTodo(env, userId, row.id);
		throw new ImChatError(409, "待办已更新，请刷新后重试");
	}
}
