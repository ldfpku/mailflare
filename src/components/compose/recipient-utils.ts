import { formatEmailAddress, getEmailAddress, joinEmailAddressList, parseEmailAddressParts, splitEmailAddressList } from "@/lib/email/address";
import type { DirectorySuggestion } from "./recipient-input-types";

const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

export function isValidRecipient(entry: string): boolean {
	return EMAIL_RE.test(getEmailAddress(entry).trim());
}

/** Turn raw typed text into recipient entries, deduplicated by bare address. */
export function parseRecipientEntries(value: string, existing: string[] = []): string[] {
	const seen = new Set(existing.map((entry) => getEmailAddress(entry).toLowerCase()));
	const result: string[] = [];
	for (const entry of splitEmailAddressList(value)) {
		const key = getEmailAddress(entry).toLowerCase();
		if (!key || seen.has(key)) continue;
		seen.add(key);
		result.push(entry);
	}
	return result;
}

export function recipientsToHeader(entries: string[]): string {
	return joinEmailAddressList(entries);
}

export function headerToRecipients(value: string | null | undefined): string[] {
	return parseRecipientEntries(value ?? "");
}

/** Short label for a chip: the display name if there is one, else the address. */
export function getRecipientLabel(entry: string): string {
	const parts = parseEmailAddressParts(entry);
	return parts.name && parts.name !== parts.address ? parts.name : parts.address;
}

/** The text typed so far is worth a directory lookup: something other than a finished or pasted address list. */
export function shouldSuggestRecipients(draft: string): boolean {
	const term = draft.trim();
	return term.length > 0 && !/[,;<>"]/.test(term);
}

/** Suggestions not already among the chips, as recipient entries with the colleague's name. */
export function directorySuggestionEntries(people: DirectorySuggestion[], existing: string[]): { person: DirectorySuggestion; entry: string }[] {
	const seen = new Set(existing.map((entry) => getEmailAddress(entry).toLowerCase()));
	return people
		.filter((person) => !seen.has(person.email.toLowerCase()))
		.map((person) => ({ person, entry: formatEmailAddress(person.email, person.name) }));
}
