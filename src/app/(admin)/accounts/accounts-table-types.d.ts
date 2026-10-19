import type { Account } from "./types";

export type AccountsTableProps = {
	accounts: Account[];
	currentUserId?: string;
	isPrimaryAdmin: boolean;
	loading: boolean;
	selected: Set<string>;
	onSelectedChange: (selected: Set<string>) => void;
	onDeleteSelected: () => void;
	/** Opens the delete dialog for one account; for an account already waiting for the purge it deletes permanently. */
	onDelete: (account: Account) => void;
	onRestore: (account: Account) => void;
	restoringId: string | null;
};

export type DeleteAccountsDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	accounts: Account[];
	candidates: Account[];
	/** The accounts are already waiting for the purge, so the only choice left is to remove them now. */
	permanentOnly?: boolean;
	onDeleted: () => void;
};
