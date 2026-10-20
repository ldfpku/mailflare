/**
 * Saving a card, its link or its signature switches rewrites mailbox signatures on the server, so the composer has to
 * reload them: in this tab through the event, in the other open tabs (the mail page beside settings, the embedded mail
 * in chat) through the storage key, whose `storage` event fires only elsewhere.
 */
export const MAILBOX_SIGNATURES_CHANGED_EVENT = "mailflare:mailbox-signatures-changed";
export const MAILBOX_SIGNATURES_CHANGED_KEY = "mailflare-mailbox-signatures-changed";

export function dispatchMailboxSignaturesChanged(): void {
	window.dispatchEvent(new Event(MAILBOX_SIGNATURES_CHANGED_EVENT));
	try {
		localStorage.setItem(MAILBOX_SIGNATURES_CHANGED_KEY, String(Date.now()));
	} catch {}
}
