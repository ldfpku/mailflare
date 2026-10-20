"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AUTH_SESSION_CHANGED_EVENT, authFetch } from "@/lib/auth/client";
import type { AuthGuardProps, AuthGuardSession } from "./auth-guard-types";
import { LoadingTransition } from "@/components/loading-transition";
import { saveUserTimeZonePreference } from "@/lib/time/client";

type SessionCheck = { ok: boolean; status: number; data: AuthGuardSession | null };

// One check per page load (and per sign-in change), shared by every route the guard wraps:
// re-asking /api/auth/me on each client-side navigation put a server round trip on every click.
let sessionCheck: Promise<SessionCheck> | null = null;

if (typeof window !== "undefined") {
	window.addEventListener(AUTH_SESSION_CHANGED_EVENT, () => {
		sessionCheck = null;
	});
}

function checkSessionOnce(): Promise<SessionCheck> {
	if (!sessionCheck) {
		const request = (async (): Promise<SessionCheck> => {
			const cookieResponse = await fetch("/api/auth/me", {
				cache: "no-store",
				signal: AbortSignal.timeout(5_000),
			});
			const response = cookieResponse.ok || cookieResponse.status !== 401
				? cookieResponse
				: await authFetch("/api/auth/me", {
					redirectOnUnauthorized: false,
					signal: AbortSignal.timeout(5_000),
				});
			const data = response.ok ? (await response.json()) as AuthGuardSession : null;
			return { ok: response.ok, status: response.status, data };
		})();
		sessionCheck = request;
		// Only a settled, signed-in account is kept: a failed check, or one still in setup (its answer
		// changes as setup finishes), is asked again by the next route.
		request.then((result) => {
			const settled = result.ok && result.data?.isSetup !== false && result.data?.hasMailboxes !== false;
			if (!settled && sessionCheck === request) sessionCheck = null;
		}, () => {
			if (sessionCheck === request) sessionCheck = null;
		});
	}
	return sessionCheck;
}

export function AuthGuard({ children, mode = "protected", requireMailbox, requireRole, requirePrimary, allowAuthenticated }: AuthGuardProps) {
	const pathname = usePathname();
	const router = useRouter();
	const [authorized, setAuthorized] = useState(mode === "public");

	useEffect(() => {
		let cancelled = false;

		async function checkSession() {
			try {
				const response = await checkSessionOnce();
				if (cancelled) return;

				if (!response.ok) {
					if (mode === "protected" && response.status === 401) router.replace("/login");
					else setAuthorized(true);
					return;
				}

				const data = response.data ?? {};
				if (data.user?.id) saveUserTimeZonePreference(data.user.id, data.user.timeZone ?? null);
				if (mode === "public") {
					if (!allowAuthenticated) router.replace("/inbox");
					return;
				}

				if (requireMailbox && data.hasMailboxes === false && data.user?.role === "admin" && data.isSetup === false && pathname !== "/setup") {
					router.replace("/setup");
					return;
				}

				if (pathname === "/setup" && data.isSetup === true) {
					router.replace("/inbox");
					return;
				}

				if (requireRole && data.user?.role !== requireRole) {
					router.replace("/inbox");
					return;
				}

				if (requirePrimary && !data.user?.isPrimaryAdmin) {
					router.replace("/admin");
					return;
				}

				setAuthorized(true);
			} catch {
				if (!cancelled) setAuthorized(true);
			}
		}

		void checkSession();

		return () => {
			cancelled = true;
		};
	}, [mode, pathname, requireMailbox, requireRole, requirePrimary, allowAuthenticated, router]);

	useEffect(() => {
		const refreshTimeZone = (event: StorageEvent) => {
			if (event.key === "mailflare-user-time-zone") window.location.reload();
		};
		window.addEventListener("storage", refreshTimeZone);
		return () => window.removeEventListener("storage", refreshTimeZone);
	}, []);

	if (mode === "public") return <>{children}</>;
	return <LoadingTransition ready={authorized}>{children}</LoadingTransition>;
}
