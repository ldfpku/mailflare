import type { ReactNode } from "react";

export type AuthGuardMode = "protected" | "public";

export type AuthGuardProps = {
	children: ReactNode;
	mode?: AuthGuardMode;
	requireMailbox?: boolean;
	requireRole?: "admin";
	requirePrimary?: boolean;
	/** Public page that stays usable while signed in (adding another account). */
	allowAuthenticated?: boolean;
};

/** The parts of /api/auth/me the guard reads. */
export type AuthGuardSession = {
	hasMailboxes?: boolean;
	isSetup?: boolean;
	user?: { id?: string; role?: string; isPrimaryAdmin?: boolean; timeZone?: string | null };
};
