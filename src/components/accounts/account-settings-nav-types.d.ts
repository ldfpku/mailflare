import type { TranslationKey } from "@/lib/i18n/types";

export type AccountSettingsNavItem = {
	segment: "" | "business-card" | "password" | "permissions" | "mailboxes";
	labelKey: TranslationKey;
};
