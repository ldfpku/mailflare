export type DeleteAccountsInput = {
	ids: string[];
	transferToId?: string | null;
	/** Remove the accounts and their data now instead of after the restore window. */
	permanent?: boolean;
};

export type DeleteAccountsResult =
	| { ok: true; deleted: number }
	| { ok: false; status: number; error: string };
