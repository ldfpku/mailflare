export type ChatCleanupConversation = {
	key: string;
	title: string;
	kind: "allStaff" | "group" | "single";
	people: string[];
	messages: number;
	firstAt: number | null;
	lastAt: number | null;
};

export type ChatCleanupCategory = {
	key: "test" | "admin" | "colleague";
	label: string;
	defaultChecked: boolean;
	rooms: number;
	messages: number;
	files: number;
	fileBytes: number;
	meetings: number;
	todos: number;
	conversations: ChatCleanupConversation[];
};

export type ChatCleanupRun = {
	at: number;
	categories: string[];
	rooms: number;
	messages: number;
	files: number;
	fileBytes: number;
	roomFiles: number;
	mailShares: number;
	meetings: number;
	todos: number;
};

export type ChatCleanupPreview = {
	realEmails: string[];
	realAccounts: string[];
	categories: ChatCleanupCategory[];
	runs: ChatCleanupRun[];
};
