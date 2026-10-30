import { getDb } from "@/db";
import { getDriveItem, getDriveRole } from "@/lib/drive/access";
import { newId } from "@/lib/ids";
import { ImChatError } from "./chat-utils";
import { IM_FILE_LIMIT_BYTES } from "./files-utils";
import { requireTodoAccess, requireTodoId } from "./todo-workspace";

type Env = CloudflareEnv;
type AttachmentRow = { id: string; todo_id: string; drive_item_id: string | null; created_at: number };

async function attachmentDto(env: Env, userId: string, row: AttachmentRow) {
	const db = getDb(env);
	const file = row.drive_item_id ? await getDriveItem(db, row.drive_item_id) : null;
	const role = file ? await getDriveRole(db, userId, file) : null;
	if (!file || !role || file.kind !== "file" || file.uploadId) {
		return { id: row.id, todoId: row.todo_id, available: false, name: null, size: null, path: null, createdAt: row.created_at };
	}
	return {
		id: row.id,
		todoId: row.todo_id,
		available: true,
		name: file.name,
		size: file.size,
		path: `/api/drive/items/${encodeURIComponent(file.id)}/content?download=1`,
		createdAt: row.created_at,
	};
}

export async function listTodoAttachments(env: Env, userId: string, value: unknown) {
	const todoId = requireTodoId(value);
	await requireTodoAccess(env, userId, todoId);
	const rows = await env.DB.prepare(
		`SELECT id, todo_id, drive_item_id, created_at FROM im_todo_attachments
		WHERE todo_id = ? AND EXISTS (SELECT 1 FROM im_todos WHERE id = im_todo_attachments.todo_id AND (user_id = ? OR assignee_id = ?))
		ORDER BY created_at, id`,
	).bind(todoId, userId, userId).all<AttachmentRow>();
	const result = await Promise.all(rows.results.map((row) => attachmentDto(env, userId, row)));
	await requireTodoAccess(env, userId, todoId);
	return result;
}

export async function createTodoAttachment(env: Env, userId: string, input: Record<string, unknown>) {
	const todoId = requireTodoId(input.todoId);
	const driveItemId = requireTodoId(input.driveItemId);
	const access = await requireTodoAccess(env, userId, todoId);
	if (access.user_id !== userId) throw new ImChatError(403, "只有任务所有者可以添加附件");
	const db = getDb(env);
	const file = await getDriveItem(db, driveItemId);
	const role = file ? await getDriveRole(db, userId, file) : null;
	if (!file || !role || file.kind !== "file" || file.uploadId) throw new ImChatError(404, "网盘文件不存在或无权访问");
	if (file.size > IM_FILE_LIMIT_BYTES) throw new ImChatError(400, "附件不能超过500MB");
	const row = await env.DB.prepare(
		`INSERT OR IGNORE INTO im_todo_attachments (id, todo_id, drive_item_id, created_at)
		SELECT ?, ?, ?, ? WHERE
		EXISTS (SELECT 1 FROM im_todos WHERE id = ? AND user_id = ?)
		AND EXISTS (SELECT 1 FROM drive_items WHERE id = ? AND kind = 'file' AND upload_id IS NULL AND trashed_at IS NULL)
		AND (SELECT COUNT(*) FROM im_todo_attachments WHERE todo_id = ?) < 20
		RETURNING id, todo_id, drive_item_id, created_at`,
	).bind(newId("todo_attachment"), todoId, driveItemId, Date.now(), todoId, userId, driveItemId, todoId).first<AttachmentRow>();
	if (!row) {
		await requireTodoAccess(env, userId, todoId);
		const duplicate = await env.DB.prepare("SELECT id FROM im_todo_attachments WHERE todo_id = ? AND drive_item_id = ?").bind(todoId, driveItemId).first<{ id: string }>();
		if (duplicate) throw new ImChatError(409, "文件已添加到任务");
		const current = await getDriveItem(db, driveItemId);
		if (!current || !(await getDriveRole(db, userId, current)) || current.uploadId) throw new ImChatError(404, "网盘文件不存在或无权访问");
		throw new ImChatError(400, "任务附件数量已达上限");
	}
	return attachmentDto(env, userId, row);
}

export async function deleteTodoAttachment(env: Env, userId: string, input: Record<string, unknown>) {
	const todoId = requireTodoId(input.todoId);
	const attachmentId = requireTodoId(input.id);
	const access = await requireTodoAccess(env, userId, todoId);
	if (access.user_id !== userId) throw new ImChatError(403, "只有任务所有者可以移除附件");
	const result = await env.DB.prepare(
		`DELETE FROM im_todo_attachments WHERE id = ? AND todo_id = ?
		AND EXISTS (SELECT 1 FROM im_todos WHERE id = im_todo_attachments.todo_id AND user_id = ?)`,
	).bind(attachmentId, todoId, userId).run();
	if (!result.meta.changes) throw new ImChatError(404, "附件不存在");
}
