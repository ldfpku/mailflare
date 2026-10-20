"use client";

import { useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { shortLoginName } from "@/lib/auth/login-domain-utils";

const LAST_LOGIN_NAME_KEY = "mailflare:last-login-name";

function readLastLoginName(): string {
	try {
		return localStorage.getItem(LAST_LOGIN_NAME_KEY) ?? "";
	} catch {
		// Storage can be blocked; nothing to fill in.
		return "";
	}
}

const noSubscription = () => () => {};

/** Remembers the name that last signed in, so the next visit only needs the password. */
export function rememberLoginName(name: string) {
	try {
		const value = name.trim();
		if (value) localStorage.setItem(LAST_LOGIN_NAME_KEY, value);
	} catch {
		// Storage can be blocked; the form just starts empty then.
	}
}

type Props = Omit<React.ComponentProps<"input">, "value" | "defaultValue" | "onChange" | "type"> & {
	/** Shown after the name while it has no @; null when the install has no domain yet. */
	domain: string | null;
	/** Fill in the last remembered name. */
	prefill?: boolean;
};

/**
 * The account box of the sign-in forms: people type the name before the @ and
 * the login domain stays visible on the right. A full address works too.
 */
export function LoginNameInput({ domain, prefill = false, className, ...props }: Props) {
	// The server render has no storage, so the remembered name arrives on hydration.
	const lastName = useSyncExternalStore(noSubscription, readLastLoginName, () => "");
	const [typed, setTyped] = useState<string | null>(null);
	const value = typed ?? (prefill ? shortLoginName(lastName, domain) : "");

	const showSuffix = !!domain && !value.includes("@");
	return (
		<div
			className={cn(
				// The BIS focus ring (globals.css) goes around the whole box, suffix included.
				"flex h-10 w-full items-center rounded-md border border-neutral-300 bg-transparent focus-within:border-blue-600 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[#034fbc] dark:has-[:focus-visible]:outline-[#7a9fe2]",
				className,
			)}
		>
			<input
				{...props}
				type="text"
				inputMode="email"
				autoCapitalize="none"
				autoCorrect="off"
				spellCheck={false}
				value={value}
				onChange={(event) => setTyped(event.target.value)}
				className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm placeholder:text-neutral-500"
				style={{ outline: "none" }}
			/>
			{showSuffix && (
				<span className="shrink-0 select-none pr-3 text-sm text-neutral-500">
					@{domain}
				</span>
			)}
		</div>
	);
}
