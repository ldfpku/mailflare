import { newId } from "@/lib/ids";
import { ImChatError } from "./chat-utils";
import { findReadableMail } from "./ai";
import {
	IM_TODO_LIMIT,
	IM_TODO_PAGE_LIMIT,
	parseTodoDue,
	parseTodoNotes,
	parseTodoStatus,
	parseTodoTitle,
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

const COLUMNS = "id, user_id, title, notes, due_at, done, done_at, source_type, source_id, source_title, created_at, updated_at";

export async function listTodos(env: Env, userId: string, status: string | null): Promise<ImTodo[]> {
	const which = parseTodoStatus(status);
	const where = which === "open" ? "AND done = 0" : which === "done" ? "AND done = 1" : "";
	// Open items by deadline (none last), then newest; finished ones most recently finished first.
	const order = which === "done" ? "done_at DESC" : "done, due_at IS NULL, due_at, created_at DESC";
	const result = await env.DB.prepare(`SELECT ${COLUMNS} FROM im_todos WHERE user_id = ? ${where} ORDER BY ${order} LIMIT ?`)
		.bind(userId, IM_TODO_PAGE_LIMIT)
		.all<ImTodoRow>();
	return result.results.map(toImTodo);
}

async function findTodo(env: Env, userId: string, id: unknown): Promise<ImTodoRow> {
	const row = typeof id === "string" && id ? await env.DB.prepare(`SELECT ${COLUMNS} FROM im_todos WHERE id = ? AND user_id = ?`).bind(id, userId).first<ImTodoRow>() : null;
	if (!row) throw new ImChatError(404, "待办不存在");
	return row;
}

export async function createTodo(env: Env, user: Pick<ImUser, "id" | "role">, input: Record<string, unknown>): Promise<ImTodo> {
	const title = parseTodoTitle(input.title);
	if (!title) throw new ImChatError(400, "请填写待办内容");
	const dueAt = parseTodoDue(input.dueAt ?? null);
	if (dueAt === undefined) throw new ImChatError(400, "截止时间无效");
	let source: { type: "manual" | "mail"; id: string | null; title: string } = { type: "manual", id: null, title: "" };
	if (input.mailId !== undefined || input.shareId !== undefined) {
		const mail = await findReadableMail(env, user, { mailId: input.mailId, shareId: input.shareId });
		source = { type: "mail", id: mail.id, title: mail.subject?.trim().slice(0, 200) || "(无主题)" };
	}
	const count = await env.DB.prepare("SELECT COUNT(*) AS count FROM im_todos WHERE user_id = ?").bind(user.id).first<{ count: number }>();
	if ((count?.count ?? 0) >= IM_TODO_LIMIT) throw new ImChatError(400, "待办太多了，请先删除一些已完成的待办");
	const now = Date.now();
	const row = await env.DB.prepare(
		`INSERT INTO im_todos (id, user_id, title, notes, due_at, done, source_type, source_id, source_title, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?) RETURNING ${COLUMNS}`,
	)
		.bind(newId("todo"), user.id, title, parseTodoNotes(input.notes), dueAt, source.type, source.id, source.title, now, now)
		.first<ImTodoRow>();
	if (!row) throw new ImChatError(400, "待办保存失败");
	return toImTodo(row);
}

/** Changes the fields present in `input`: `title`, `notes`, `dueAt` and `done`. */
export async function updateTodo(env: Env, userId: string, input: Record<string, unknown>): Promise<ImTodo> {
	const row = await findTodo(env, userId, input.id);
	const next = { ...row };
	if (input.title !== undefined) {
		const title = parseTodoTitle(input.title);
		if (!title) throw new ImChatError(400, "请填写待办内容");
		next.title = title;
	}
	if (input.notes !== undefined) next.notes = parseTodoNotes(input.notes);
	if (input.dueAt !== undefined) {
		const dueAt = parseTodoDue(input.dueAt);
		if (dueAt === undefined) throw new ImChatError(400, "截止时间无效");
		next.due_at = dueAt;
	}
	const now = Date.now();
	if (input.done !== undefined) {
		const done = Boolean(input.done);
		if (done !== Boolean(row.done)) next.done_at = done ? now : null;
		next.done = Number(done);
	}
	const updated = await env.DB.prepare(
		`UPDATE im_todos SET title = ?, notes = ?, due_at = ?, done = ?, done_at = ?, updated_at = ? WHERE id = ? AND user_id = ? RETURNING ${COLUMNS}`,
	)
		.bind(next.title, next.notes, next.due_at, next.done, next.done_at, now, row.id, userId)
		.first<ImTodoRow>();
	if (!updated) throw new ImChatError(404, "待办不存在");
	return toImTodo(updated);
}

export async function deleteTodo(env: Env, userId: string, id: unknown): Promise<void> {
	const row = await findTodo(env, userId, id);
	await env.DB.prepare("DELETE FROM im_todos WHERE id = ? AND user_id = ?").bind(row.id, userId).run();
}
