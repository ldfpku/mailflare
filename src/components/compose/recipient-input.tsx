"use client";

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { X } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { Label } from "@/components/ui/label";
import { authFetch } from "@/lib/auth/client";
import { getEmailAddress } from "@/lib/email/address";
import { cn } from "@/lib/utils";
import type { DirectorySuggestion, RecipientInputProps } from "./recipient-input-types";
import {
	directorySuggestionEntries,
	getRecipientLabel,
	isValidRecipient,
	parseRecipientEntries,
	shouldSuggestRecipients,
} from "./recipient-utils";

/** Wait this long after the last keystroke before asking the directory. */
const SUGGEST_DELAY_MS = 200;

/**
 * A To/Cc/Bcc row. Addresses become chips as soon as the user types a comma,
 * presses Enter or Tab, pastes a list, or leaves the field; Backspace on an
 * empty field pulls the last chip back out for editing. While typing, colleagues
 * from the company directory are offered by name, mailbox or department.
 */
export function RecipientInput({
	id,
	label,
	value,
	onChange,
	placeholder,
	disabled,
	required,
	autoFocus,
	trailing,
}: RecipientInputProps) {
	const { t } = useLanguage();
	const [draft, setDraft] = useState("");
	const inputRef = useRef<HTMLInputElement | null>(null);
	// The directory's answer is kept with the term it answers, so an answer for older text never shows.
	const [found, setFound] = useState<{ term: string; people: DirectorySuggestion[] }>({ term: "", people: [] });
	const [highlight, setHighlight] = useState(0);
	const term = draft.trim();
	const suggestions = shouldSuggestRecipients(term) && found.term === term ? directorySuggestionEntries(found.people, value) : [];

	useEffect(() => {
		if (!shouldSuggestRecipients(term)) return;
		let cancelled = false;
		const timer = setTimeout(() => {
			void authFetch(`/api/directory?q=${encodeURIComponent(term)}`, { cache: "no-store" })
				.then(async (response) => (response.ok ? ((await response.json()) as { people: DirectorySuggestion[] }).people : []))
				.catch(() => [])
				.then((people) => {
					if (cancelled) return;
					setFound({ term, people });
					setHighlight(0);
				});
		}, SUGGEST_DELAY_MS);
		return () => {
			cancelled = true;
			clearTimeout(timer);
		};
	}, [term]);

	function commit(raw = draft) {
		const entries = parseRecipientEntries(raw, value);
		if (entries.length > 0) onChange([...value, ...entries]);
		setDraft("");
	}

	function pick(entry: string) {
		onChange([...value, entry]);
		setDraft("");
		inputRef.current?.focus();
	}

	function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
		if (suggestions.length > 0) {
			if (event.key === "ArrowDown" || event.key === "ArrowUp") {
				event.preventDefault();
				const step = event.key === "ArrowDown" ? 1 : -1;
				setHighlight((current) => (current + step + suggestions.length) % suggestions.length);
				return;
			}
			if (event.key === "Enter" || event.key === "Tab") {
				event.preventDefault();
				pick(suggestions[Math.min(highlight, suggestions.length - 1)].entry);
				return;
			}
			if (event.key === "Escape") {
				event.preventDefault();
				setFound({ term: "", people: [] });
				return;
			}
		}
		if (event.key === "," || event.key === ";" || event.key === "Enter" || (event.key === "Tab" && draft.trim())) {
			if (event.key !== "Tab") event.preventDefault();
			commit();
			return;
		}
		if (event.key === "Backspace" && !draft && value.length > 0) {
			event.preventDefault();
			const last = value[value.length - 1];
			onChange(value.slice(0, -1));
			setDraft(last);
		}
	}

	return (
		<div
			className="relative flex min-h-9 items-center gap-2 border-b border-neutral-100 px-4 py-1"
			onClick={() => inputRef.current?.focus()}
		>
			<Label htmlFor={id} className="w-8 shrink-0 text-sm text-neutral-500">
				{label}
			</Label>
			<div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
				{value.map((entry) => {
					const valid = isValidRecipient(entry);
					return (
						<span
							key={entry}
							title={getEmailAddress(entry)}
							className={cn(
								"inline-flex max-w-full items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs",
								valid
									? "border-neutral-200 bg-neutral-50 text-neutral-800"
									: "border-red-200 bg-red-50 text-red-700",
							)}
						>
							<span className="truncate">{getRecipientLabel(entry)}</span>
							{!disabled && (
								<button
									type="button"
									aria-label={t("recipient.remove", { address: getEmailAddress(entry) })} title={t("recipient.remove", { address: getEmailAddress(entry) })}
									className="rounded-full p-0.5 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-700"
									onClick={(event) => {
										event.stopPropagation();
										onChange(value.filter((item) => item !== entry));
									}}
								>
									<X className="h-3 w-3" />
								</button>
							)}
						</span>
					);
				})}
				<input
					ref={inputRef}
					id={id}
					value={draft}
					onChange={(event) => {
						// A pasted list should split immediately instead of waiting for a comma.
						if (/[,;]/.test(event.target.value) && event.target.value.length - draft.length > 1) {
							commit(event.target.value);
							return;
						}
						setDraft(event.target.value);
					}}
					onKeyDown={onKeyDown}
					onBlur={() => {
						commit();
						setFound({ term: "", people: [] });
					}}
					type="text"
					autoComplete="off"
					role="combobox"
					aria-expanded={suggestions.length > 0}
					aria-controls={`${id}-suggestions`}
					autoFocus={autoFocus}
					spellCheck={false}
					placeholder={value.length === 0 ? placeholder : undefined}
					disabled={disabled}
					// Native `required` would block submit while chips exist; the form checks itself.
					aria-required={required}
					className="h-7 min-w-32 flex-1 border-0 bg-transparent p-0 text-sm outline-none placeholder:text-neutral-400 disabled:cursor-not-allowed"
				/>
			</div>
			{suggestions.length > 0 && (
				<ul
					id={`${id}-suggestions`}
					role="listbox"
					className="absolute left-12 right-4 top-full z-50 mt-0.5 max-h-72 overflow-y-auto rounded-md border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
				>
					{suggestions.map(({ person, entry }, index) => (
						<li
							key={person.email}
							role="option"
							aria-selected={index === highlight}
							title={person.email}
							className={cn(
								"flex cursor-pointer items-baseline gap-2 px-3 py-1.5 text-sm",
								index === highlight ? "bg-neutral-100 dark:bg-neutral-800" : "hover:bg-neutral-50 dark:hover:bg-neutral-800/60",
							)}
							// mousedown, not click: the input's blur would otherwise commit the half-typed text first.
							onMouseDown={(event) => {
								event.preventDefault();
								pick(entry);
							}}
							onMouseEnter={() => setHighlight(index)}
						>
							<span className="shrink-0 font-medium text-neutral-900 dark:text-neutral-100">{person.name || person.email}</span>
							<span className="truncate text-xs text-neutral-500">
								{[person.email, person.department, person.title].filter(Boolean).join(" · ")}
							</span>
						</li>
					))}
				</ul>
			)}
			{trailing && (
				// Toggles live inside the clickable row; keep their clicks from refocusing this field.
				<div
					className="flex shrink-0 items-center gap-1 text-xs text-neutral-500"
					onClick={(event) => event.stopPropagation()}
				>
					{trailing}
				</div>
			)}
		</div>
	);
}
