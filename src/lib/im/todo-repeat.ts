import { Temporal } from "@js-temporal/polyfill";

export type TodoRepeatKind = "daily" | "weekly" | "monthly" | "yearly";
export type TodoRepeatRule = {
	kind: TodoRepeatKind;
	timeZone: string;
	time: string;
	anchorDay: number;
	anchorMonth: number;
};

/** Repeated tasks keep the original wall-clock time, including after a daylight-saving gap. */
export function makeTodoRepeat(kind: unknown, timeZone: unknown, dueAt: number | null, dueDate: string | null = null): TodoRepeatRule | null {
	if (kind !== "daily" && kind !== "weekly" && kind !== "monthly" && kind !== "yearly") return null;
	if (typeof timeZone !== "string" || !timeZone || timeZone.length > 128 || dueAt === null) return null;
	try {
		const zoned = Temporal.Instant.fromEpochMilliseconds(dueAt).toZonedDateTimeISO(timeZone);
		const date = dueDate ? Temporal.PlainDate.from(dueDate) : zoned.toPlainDate();
		return {
			kind,
			timeZone: zoned.timeZoneId,
			time: dueDate ? "00:00:00.000" : zoned.toPlainTime().toString({ smallestUnit: "millisecond" }),
			anchorDay: date.day,
			anchorMonth: date.month,
		};
	} catch (error) {
		if (error instanceof RangeError) return null;
		throw error;
	}
}

export function dateOnlyDeadline(day: string, timeZone: string): { dueAt: number; timeZone: string } | null {
	try {
		const zoned = Temporal.PlainDate.from(day).toZonedDateTime({ timeZone, plainTime: "00:00" });
		return { dueAt: zoned.epochMilliseconds, timeZone: zoned.timeZoneId };
	} catch (error) {
		if (error instanceof RangeError) return null;
		throw error;
	}
}

export function todoDayInTimeZone(at: number, timeZone: string): string {
	return Temporal.Instant.fromEpochMilliseconds(at).toZonedDateTimeISO(timeZone).toPlainDate().toString();
}

export function nextTodoOccurrence(dueAt: number, rule: TodoRepeatRule): number {
	const zoned = Temporal.Instant.fromEpochMilliseconds(dueAt).toZonedDateTimeISO(rule.timeZone);
	const date = zoned.toPlainDate();
	let next: Temporal.PlainDate;
	if (rule.kind === "daily" || rule.kind === "weekly") {
		next = date.add({ days: rule.kind === "daily" ? 1 : 7 });
	} else if (rule.kind === "monthly") {
		const month = date.toPlainYearMonth().add({ months: 1 });
		next = month.toPlainDate({ day: Math.min(rule.anchorDay, month.daysInMonth) });
	} else {
		const month = Temporal.PlainYearMonth.from({ year: date.year + 1, month: rule.anchorMonth });
		next = month.toPlainDate({ day: Math.min(rule.anchorDay, month.daysInMonth) });
	}
	return next.toPlainDateTime(Temporal.PlainTime.from(rule.time)).toZonedDateTime(rule.timeZone, { disambiguation: "compatible" }).epochMilliseconds;
}
