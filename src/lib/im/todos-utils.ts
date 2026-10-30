import { IM_TODO_NOTES_LIMIT, IM_TODO_TITLE_LIMIT } from "./ai-utils";
import type { TodoRepeatKind } from "./todo-repeat";

/** A person keeps at most this many to-dos; finished ones count too until they are deleted. */
export const IM_TODO_LIMIT = 10_000;
export const IM_TODO_PAGE_LIMIT = 200;

export interface ImTodoRow {
	id: string;
	user_id: string;
	title: string;
	notes: string;
	due_at: number | null;
	due_date: string | null;
	due_timezone: string | null;
	done: number;
	done_at: number | null;
	source_type: "manual" | "mail";
	source_id: string | null;
	source_title: string;
	source_share_id: string | null;
	list_id: string | null;
	assignee_id: string | null;
	important: number;
	version: number;
	remind_at: number | null;
	reminder_revision: number;
	repeat_kind: TodoRepeatKind | null;
	repeat_timezone: string | null;
	repeat_time: string | null;
	repeat_anchor_day: number | null;
	repeat_anchor_month: number | null;
	next_occurrence_id: string | null;
	created_at: number;
	updated_at: number;
}

export function toImTodo(row: ImTodoRow, myDay: string | null) {
	if (row.repeat_kind && (!row.repeat_timezone || !row.repeat_time || !row.repeat_anchor_day || !row.repeat_anchor_month)) {
		throw new Error("Stored to-do repeat rule is incomplete");
	}
	return {
		id: row.id,
		title: row.title,
		notes: row.notes,
		dueAt: row.due_at,
		dueDate: row.due_date,
		dueTimeZone: row.due_timezone,
		done: Boolean(row.done),
		doneAt: row.done_at,
		sourceType: row.source_type,
		sourceId: row.source_id,
		sourceTitle: row.source_title,
		// The mail web app's page for the mail; HuLa opens it through the mail sign-in link.
		sourcePath: row.source_type === "mail" && row.source_id ? `/inbox/${encodeURIComponent(row.source_id)}` : null,
		ownerId: row.user_id,
		listId: row.list_id,
		assigneeId: row.assignee_id,
		important: Boolean(row.important),
		myDay,
		version: row.version,
		remindAt: row.remind_at,
		repeat: row.repeat_kind && row.repeat_timezone ? { kind: row.repeat_kind, timeZone: row.repeat_timezone } : null,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

export type ImTodo = ReturnType<typeof toImTodo>;

export function parseTodoVersion(value: unknown): number | undefined {
	return typeof value === "number" && Number.isSafeInteger(value) && value >= 1 ? value : undefined;
}

export function parseTodoDay(value: unknown): string | null | undefined {
	if (value === null || value === "") return null;
	if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
	const date = new Date(`${value}T00:00:00.000Z`);
	return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : undefined;
}

export function parseTodoTitle(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const title = value.replace(/\s+/g, " ").trim().slice(0, IM_TODO_TITLE_LIMIT);
	return title || null;
}

export function parseTodoNotes(value: unknown): string {
	return typeof value === "string" ? value.replace(/\r\n?/g, "\n").trim().slice(0, IM_TODO_NOTES_LIMIT) : "";
}

/** A deadline in epoch milliseconds between 2000 and 2100; null, "" and 0 clear it; anything else is undefined (invalid). */
export function parseTodoDue(value: unknown): number | null | undefined {
	if (value === null || value === "" || value === 0) return null;
	const number = typeof value === "string" ? Number(value) : value;
	if (typeof number !== "number" || !Number.isInteger(number)) return undefined;
	return number >= 946_684_800_000 && number < 4_102_444_800_000 ? number : undefined;
}

/** `open` (default), `done` or `all`. */
export function parseTodoStatus(value: string | null): "open" | "done" | "all" {
	return value === "done" || value === "all" ? value : "open";
}

/** Points from the draft as note lines. */
export function pointsToNotes(points: string[]): string {
	return points.map((point) => `· ${point}`).join("\n").slice(0, IM_TODO_NOTES_LIMIT);
}
