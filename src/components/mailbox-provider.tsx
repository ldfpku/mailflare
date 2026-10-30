"use client";

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";
import type { ReactNode } from "react";
import {
	clearMailboxesCache,
	fetchMailboxOptions,
	isIdentityMailbox,
	SELECTED_MAILBOX_STORAGE_KEY,
} from "./mailbox-provider-utils";
import {
	AUTH_SESSION_CHANGED_EVENT,
	getClientSessionToken,
} from "@/lib/auth/client";
import { PROFILE_NAME_CHANGED_EVENT } from "@/lib/profile/name-client";
import { PROFILE_AVATAR_CHANGED_EVENT } from "@/lib/profile/avatar-client";
import { MAILBOX_SIGNATURES_CHANGED_EVENT, MAILBOX_SIGNATURES_CHANGED_KEY } from "@/lib/business-card/signature-client";
import type { ProfileNameChangedDetail } from "@/lib/profile/types";
import { fetchSessionInfo } from "@/hooks/use-current-user";

export type MailboxOption = {
	id: string;
	domainId: string;
	localPart: string;
	hostname: string;
	displayName: string | null;
	signature?: string | null;
	autoReplyEnabled?: boolean;
	autoReplySubject?: string;
	autoReplyBody?: string;
	hasAvatar?: boolean;
	type?: "personal" | "shared";
	permission?: "read_only" | "send_as" | "send_on_behalf" | "full_access";
	isPrimary?: boolean;
	senderAddresses?: string[];
};

type MailboxContextValue = {
	selectedMailbox: MailboxOption | null;
	setSelectedMailbox: (mb: MailboxOption | null) => void;
	mailboxes: MailboxOption[];
	isLoading: boolean;
};

const MailboxContext = createContext<MailboxContextValue | null>(null);

export function useSelectedMailbox() {
	const ctx = useContext(MailboxContext);
	if (!ctx) throw new Error("useSelectedMailbox must be used within MailboxProvider");
	return ctx;
}

export function MailboxProvider({ children }: { children: ReactNode }) {
	const [mailboxes, setMailboxes] = useState<MailboxOption[]>([]);
	const [selectedMailbox, setSelectedMailboxState] = useState<MailboxOption | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [sessionRevision, setSessionRevision] = useState(0);

	useEffect(() => {
		let cancelled = false;
		const sessionToken = getClientSessionToken();

		fetchSessionInfo()
			.then((session) => {
				if (cancelled || sessionToken !== getClientSessionToken()) return [];
				if (session?.status === 401) return [];
				if (!session || session.status !== 200) throw new Error("Could not verify mailbox session");
				return fetchMailboxOptions();
			})
			.then((items) => {
				if (cancelled || sessionToken !== getClientSessionToken()) return;
				setMailboxes(items);

				const storedId = localStorage.getItem(SELECTED_MAILBOX_STORAGE_KEY);
				if (storedId) {
					const found = items.find((mb) => mb.id === storedId);
					if (found) {
						setSelectedMailboxState(found);
						return;
					}
				}

				const primary = items.find((mb) => mb.isPrimary) ?? items[0] ?? null;
				if (primary) {
					setSelectedMailboxState(primary);
					localStorage.setItem(SELECTED_MAILBOX_STORAGE_KEY, primary.id);
				}
			})
			.catch((error) => { if (!cancelled) console.error("Could not load mailboxes", error); })
			.finally(() => {
				if (!cancelled && sessionToken === getClientSessionToken()) setIsLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, [sessionRevision]);

	useEffect(() => {
		function resetMailboxState() {
			setMailboxes([]);
			setSelectedMailboxState(null);
			setIsLoading(true);
			setSessionRevision((revision) => revision + 1);
		}

		window.addEventListener(AUTH_SESSION_CHANGED_EVENT, resetMailboxState);
		return () => window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, resetMailboxState);
	}, []);

	useEffect(() => {
		function updatePersonalMailboxNames(event: Event) {
			const { name } = (event as CustomEvent<ProfileNameChangedDetail>).detail;
			clearMailboxesCache();
			// Only the primary mailbox follows the profile name; the rest keep their own.
			setMailboxes((items) => items.map((mailbox) => (
				isIdentityMailbox(mailbox) ? { ...mailbox, displayName: name } : mailbox
			)));
			setSelectedMailboxState((mailbox) => (
				mailbox && isIdentityMailbox(mailbox) ? { ...mailbox, displayName: name } : mailbox
			));
		}

		window.addEventListener(PROFILE_NAME_CHANGED_EVENT, updatePersonalMailboxNames);
		return () => window.removeEventListener(PROFILE_NAME_CHANGED_EVENT, updatePersonalMailboxNames);
	}, []);

	useEffect(() => {
		function updatePersonalMailboxAvatars() {
			clearMailboxesCache();
			setMailboxes((items) => items.map((mailbox) => (
				isIdentityMailbox(mailbox) ? { ...mailbox, hasAvatar: true } : mailbox
			)));
			setSelectedMailboxState((mailbox) => (
				mailbox && isIdentityMailbox(mailbox) ? { ...mailbox, hasAvatar: true } : mailbox
			));
		}

		window.addEventListener(PROFILE_AVATAR_CHANGED_EVENT, updatePersonalMailboxAvatars);
		return () => window.removeEventListener(PROFILE_AVATAR_CHANGED_EVENT, updatePersonalMailboxAvatars);
	}, []);

	useEffect(() => {
		// The card signature is written to mailboxes on the server, so the copies loaded at sign-in are stale.
		function reloadSignatures() {
			clearMailboxesCache();
			fetchMailboxOptions(true)
				.then((items) => {
					const signatures = new Map(items.map((mailbox) => [mailbox.id, mailbox.signature ?? null]));
					const withSignature = (mailbox: MailboxOption) => (
						signatures.has(mailbox.id) && signatures.get(mailbox.id) !== (mailbox.signature ?? null)
							? { ...mailbox, signature: signatures.get(mailbox.id) }
							: mailbox
					);
					setMailboxes((current) => current.map(withSignature));
					setSelectedMailboxState((mailbox) => (mailbox ? withSignature(mailbox) : mailbox));
				})
				.catch(() => {});
		}

		function reloadFromOtherTab(event: StorageEvent) {
			if (event.key === MAILBOX_SIGNATURES_CHANGED_KEY) reloadSignatures();
		}

		window.addEventListener(MAILBOX_SIGNATURES_CHANGED_EVENT, reloadSignatures);
		window.addEventListener("storage", reloadFromOtherTab);
		return () => {
			window.removeEventListener(MAILBOX_SIGNATURES_CHANGED_EVENT, reloadSignatures);
			window.removeEventListener("storage", reloadFromOtherTab);
		};
	}, []);

	const setSelectedMailbox = useCallback((mb: MailboxOption | null) => {
		setSelectedMailboxState((current) => (current?.id === mb?.id ? current : mb));
		if (mb) {
			setMailboxes((items) => items.map((item) => (item.id === mb.id && item !== mb ? mb : item)));
			localStorage.setItem(SELECTED_MAILBOX_STORAGE_KEY, mb.id);
		} else {
			localStorage.removeItem(SELECTED_MAILBOX_STORAGE_KEY);
		}
	}, []);

	return (
		<MailboxContext.Provider value={{ selectedMailbox, setSelectedMailbox, mailboxes, isLoading }}>
			{children}
		</MailboxContext.Provider>
	);
}
