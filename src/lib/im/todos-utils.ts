import { IM_TODO_NOTES_LIMIT, IM_TODO_TITLE_LIMIT } from "./ai-utils";

/** A person keeps at most this many to-dos; finished ones count too until they are deleted. */
export const IM_TODO_LIMIT = 1_000;
export const IM_TODO_PAGE_LIMIT = 200;

export interface ImTodoRow {
	id: string;
	user_id: string;
	title: string;
	notes: string;
	due_at: number | null;
	done: number;
	done_at: number | null;
	source_type: "manual" | "mail";
	source_id: string | null;
	source_title: string;
	created_at: number;
	updated_at: number;
}

export function toImTodo(row: ImTodoRow) {
	return {
		id: row.id,
		title: row.title,
		notes: row.notes,
		dueAt: row.due_at,
		done: Boolean(row.done),
		doneAt: row.done_at,
		sourceType: row.source_type,
		sourceId: row.source_id,
		sourceTitle: row.source_title,
		// The mail web app's page for the mail; HuLa opens it through the mail sign-in link.
		sourcePath: row.source_type === "mail" && row.source_id ? `/inbox/${encodeURIComponent(row.source_id)}` : null,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

export type ImTodo = ReturnType<typeof toImTodo>;

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
