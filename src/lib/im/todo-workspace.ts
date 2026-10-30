import { newId } from "@/lib/ids";
import { ImChatError } from "./chat-utils";
import { parseTodoDay, parseTodoTitle, parseTodoVersion } from "./todos-utils";

type Env = CloudflareEnv;
type ListRow = { id: string; user_id: string; name: string; position: number; created_at: number; updated_at: number };
type StepRow = { id: string; todo_id: string; title: string; done: number; position: number; version: number; created_at: number; updated_at: number };
type Access = { user_id: string; assignee_id: string | null };
const LIST_COLUMNS = "id, user_id, name, position, created_at, updated_at";
const STEP_COLUMNS = "id, todo_id, title, done, position, version, created_at, updated_at";
const toList = (row: ListRow) => ({ id: row.id, name: row.name, position: row.position, createdAt: row.created_at, updatedAt: row.updated_at });
const toStep = (row: StepRow) => ({ id: row.id, todoId: row.todo_id, title: row.title, done: Boolean(row.done), position: row.position, version: row.version, createdAt: row.created_at, updatedAt: row.updated_at });

export function requireTodoId(value: unknown): string {
	if (typeof value !== "string" || !value || value.length > 256) throw new ImChatError(400, "标识无效");
	return value;
}

function version(value: unknown): number {
	const result = parseTodoVersion(value);
	if (result === undefined) throw new ImChatError(400, "版本无效，请刷新后重试");
	return result;
}

async function findList(env: Env, userId: string, value: unknown): Promise<ListRow> {
	const row = await env.DB.prepare(`SELECT ${LIST_COLUMNS} FROM im_todo_lists WHERE id = ? AND user_id = ?`).bind(requireTodoId(value), userId).first<ListRow>();
	if (!row) throw new ImChatError(404, "列表不存在");
	return row;
}

export async function requireTodoAccess(env: Env, userId: string, value: unknown): Promise<Access> {
	const row = await env.DB.prepare("SELECT user_id, assignee_id FROM im_todos WHERE id = ? AND (user_id = ? OR assignee_id = ?)").bind(requireTodoId(value), userId, userId).first<Access>();
	if (!row) throw new ImChatError(404, "待办不存在");
	return row;
}

async function findStep(env: Env, userId: string, stepId: unknown, todoId: unknown): Promise<StepRow> {
	const row = await env.DB.prepare(
		`SELECT ${STEP_COLUMNS} FROM im_todo_steps WHERE id = ? AND todo_id = ? AND EXISTS
		(SELECT 1 FROM im_todos WHERE id = im_todo_steps.todo_id AND (user_id = ? OR assignee_id = ?))`,
	).bind(requireTodoId(stepId), requireTodoId(todoId), userId, userId).first<StepRow>();
	if (!row) throw new ImChatError(404, "步骤不存在");
	return row;
}

export async function listTodoLists(env: Env, userId: string) {
	const result = await env.DB.prepare(`SELECT ${LIST_COLUMNS} FROM im_todo_lists WHERE user_id = ? ORDER BY position, id`).bind(userId).all<ListRow>();
	return result.results.map(toList);
}

export async function createTodoList(env: Env, userId: string, input: Record<string, unknown>) {
	const name = parseTodoTitle(input.name);
	if (!name) throw new ImChatError(400, "请填写列表名称");
	const now = Date.now();
	const row = await env.DB.prepare(
		`INSERT INTO im_todo_lists (id, user_id, name, position, created_at, updated_at)
		SELECT ?, ?, ?, COALESCE(MAX(position), -1) + 1, ?, ? FROM im_todo_lists WHERE user_id = ?
		HAVING COUNT(*) < 100 RETURNING ${LIST_COLUMNS}`,
	).bind(newId("todo_list"), userId, name, now, now, userId).first<ListRow>();
	if (!row) throw new ImChatError(400, "列表数量已达上限");
	return toList(row);
}

export async function updateTodoList(env: Env, userId: string, input: Record<string, unknown>) {
	const existing = await findList(env, userId, input.id);
	const name = input.name === undefined ? existing.name : parseTodoTitle(input.name);
	if (!name) throw new ImChatError(400, "请填写列表名称");
	const position = input.position === undefined ? existing.position : input.position;
	if (typeof position !== "number" || !Number.isSafeInteger(position) || position < 0 || position > 1_000_000) throw new ImChatError(400, "列表顺序无效");
	const row = await env.DB.prepare(`UPDATE im_todo_lists SET name = ?, position = ?, updated_at = ? WHERE id = ? AND user_id = ? RETURNING ${LIST_COLUMNS}`)
		.bind(name, position, Date.now(), existing.id, userId).first<ListRow>();
	if (!row) throw new ImChatError(404, "列表不存在");
	return toList(row);
}

export async function reorderTodoLists(env: Env, userId: string, input: Record<string, unknown>) {
	if (!Array.isArray(input.ids) || input.ids.length > 100) throw new ImChatError(400, "列表顺序无效");
	const ids = input.ids.map(requireTodoId);
	if (new Set(ids).size !== ids.length) throw new ImChatError(400, "列表顺序无效");
	const existing = await listTodoLists(env, userId);
	if (existing.length !== ids.length || existing.some((list) => !ids.includes(list.id))) throw new ImChatError(409, "列表已更新，请刷新后重试");
	if (!ids.length) return [];
	const encoded = JSON.stringify(ids);
	const now = Date.now();
	const results = await env.DB.batch(ids.map((listId, position) => env.DB.prepare(
		`UPDATE im_todo_lists SET position = ?, updated_at = ? WHERE id = ? AND user_id = ?
		AND (SELECT COUNT(*) FROM im_todo_lists WHERE user_id = ?) = ?
		AND (SELECT COUNT(*) FROM im_todo_lists WHERE user_id = ? AND id IN (SELECT value FROM json_each(?))) = ?`,
	).bind(position, now, listId, userId, userId, ids.length, userId, encoded, ids.length)));
	if (results.some((result) => result.meta.changes !== 1)) throw new ImChatError(409, "列表已更新，请刷新后重试");
	return listTodoLists(env, userId);
}

export async function deleteTodoList(env: Env, userId: string, listId: unknown) {
	const existing = await findList(env, userId, listId);
	await env.DB.batch([
		env.DB.prepare("UPDATE im_todos SET list_id = NULL, version = version + 1, updated_at = ? WHERE list_id = ? AND user_id = ?")
			.bind(Date.now(), existing.id, userId),
		env.DB.prepare("DELETE FROM im_todo_lists WHERE id = ? AND user_id = ?").bind(existing.id, userId),
	]);
}

export async function listTodoSteps(env: Env, userId: string, todoId: unknown) {
	await requireTodoAccess(env, userId, todoId);
	const result = await env.DB.prepare(`SELECT ${STEP_COLUMNS} FROM im_todo_steps WHERE todo_id = ? ORDER BY position, id`)
		.bind(requireTodoId(todoId)).all<StepRow>();
	return result.results.map(toStep);
}

export async function setTodoDay(env: Env, userId: string, input: Record<string, unknown>) {
	const todoId = requireTodoId(input.todoId);
	const day = parseTodoDay(input.day);
	if (day === undefined) throw new ImChatError(400, "日期无效");
	await requireTodoAccess(env, userId, todoId);
	if (day === null) {
		await env.DB.prepare(
			`DELETE FROM im_todo_day_entries WHERE todo_id = ? AND user_id = ?
			AND EXISTS (SELECT 1 FROM im_todos WHERE id = im_todo_day_entries.todo_id AND (user_id = ? OR assignee_id = ?))`,
		).bind(todoId, userId, userId, userId).run();
	} else {
		const result = await env.DB.prepare(
			`INSERT INTO im_todo_day_entries (todo_id, user_id, day, updated_at)
			SELECT id, ?, ?, ? FROM im_todos WHERE id = ? AND (user_id = ? OR assignee_id = ?)
			ON CONFLICT (todo_id, user_id) DO UPDATE SET day = excluded.day, updated_at = excluded.updated_at`,
		).bind(userId, day, Date.now(), todoId, userId, userId).run();
		if (!result.meta.changes) throw new ImChatError(404, "待办不存在");
	}
	await requireTodoAccess(env, userId, todoId);
}

export async function createTodoStep(env: Env, userId: string, input: Record<string, unknown>) {
	const todoId = requireTodoId(input.todoId);
	const access = await requireTodoAccess(env, userId, todoId);
	if (access.user_id !== userId) throw new ImChatError(403, "只有任务所有者可以添加步骤");
	const title = parseTodoTitle(input.title);
	if (!title) throw new ImChatError(400, "请填写步骤内容");
	const now = Date.now();
	const row = await env.DB.prepare(
		`INSERT INTO im_todo_steps (id, todo_id, title, done, position, version, created_at, updated_at)
		SELECT ?, ?, ?, 0, COALESCE(MAX(position), -1) + 1, 1, ?, ? FROM im_todo_steps WHERE todo_id = ?
		HAVING COUNT(*) < 100 AND EXISTS (SELECT 1 FROM im_todos WHERE id = ? AND user_id = ?)
		RETURNING ${STEP_COLUMNS}`,
	).bind(newId("todo_step"), todoId, title, now, now, todoId, todoId, userId).first<StepRow>();
	if (!row) {
		await requireTodoAccess(env, userId, todoId);
		throw new ImChatError(400, "步骤数量已达上限");
	}
	return toStep(row);
}

export async function updateTodoStep(env: Env, userId: string, input: Record<string, unknown>) {
	const todoId = requireTodoId(input.todoId);
	const access = await requireTodoAccess(env, userId, todoId);
	const existing = await findStep(env, userId, input.id, todoId);
	const expected = version(input.expectedVersion);
	if (access.user_id !== userId && (input.title !== undefined || input.position !== undefined)) throw new ImChatError(403, "只有任务所有者可以编辑步骤");
	const title = input.title === undefined ? existing.title : parseTodoTitle(input.title);
	if (!title) throw new ImChatError(400, "请填写步骤内容");
	const done = input.done === undefined ? Boolean(existing.done) : input.done;
	if (typeof done !== "boolean") throw new ImChatError(400, "步骤状态无效");
	const position = input.position === undefined ? existing.position : input.position;
	if (typeof position !== "number" || !Number.isSafeInteger(position) || position < 0 || position > 1_000_000) throw new ImChatError(400, "步骤顺序无效");
	const ownerOnly = input.title !== undefined || input.position !== undefined;
	const permission = ownerOnly ? "user_id = ?" : "(user_id = ? OR assignee_id = ?)";
	const params = ownerOnly ? [userId] : [userId, userId];
	const row = await env.DB.prepare(
		`UPDATE im_todo_steps SET title = ?, done = ?, position = ?, version = version + 1, updated_at = ?
		WHERE id = ? AND todo_id = ? AND version = ? AND EXISTS (SELECT 1 FROM im_todos WHERE id = im_todo_steps.todo_id AND ${permission})
		RETURNING ${STEP_COLUMNS}`,
	).bind(title, Number(done), position, Date.now(), existing.id, todoId, expected, ...params).first<StepRow>();
	if (!row) {
		await findStep(env, userId, existing.id, todoId);
		throw new ImChatError(409, "步骤已更新，请刷新后重试");
	}
	return toStep(row);
}

export async function deleteTodoStep(env: Env, userId: string, input: Record<string, unknown>) {
	const todoId = requireTodoId(input.todoId);
	const access = await requireTodoAccess(env, userId, todoId);
	if (access.user_id !== userId) throw new ImChatError(403, "只有任务所有者可以删除步骤");
	const existing = await findStep(env, userId, input.id, todoId);
	const result = await env.DB.prepare(
		"DELETE FROM im_todo_steps WHERE id = ? AND todo_id = ? AND version = ? AND EXISTS (SELECT 1 FROM im_todos WHERE id = im_todo_steps.todo_id AND user_id = ?)",
	).bind(existing.id, todoId, version(input.expectedVersion), userId).run();
	if (!result.meta.changes) {
		await findStep(env, userId, existing.id, todoId);
		throw new ImChatError(409, "步骤已更新，请刷新后重试");
	}
}
