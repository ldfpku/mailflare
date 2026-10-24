/**
 * Accounts all live on the install's mail domain, so the sign-in forms ask for
 * the name before the @ only. A full address is still taken as typed.
 */
export function completeLoginEmail(input: string, domain: string | null | undefined): string {
	const value = input.trim();
	if (!value || value.includes("@") || !domain) return value;
	return `${value}@${domain}`;
}

/** What a sign-in form shows for a stored address: the bare name when it is on the login domain. */
export function shortLoginName(email: string, domain: string | null | undefined): string {
	const suffix = domain ? `@${domain}`.toLowerCase() : "";
	return suffix && email.toLowerCase().endsWith(suffix) ? email.slice(0, -suffix.length) : email;
}
