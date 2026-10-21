import type { SettingsNavSection } from "./settings-nav-types";

export const settingsNavSections: SettingsNavSection[] = [
	{
		labelKey: "settings.nav.settings",
		items: [
			{
				href: "/settings/account",
				labelKey: "settings.nav.account",
			},
			{
				href: "/settings/business-card",
				labelKey: "settings.nav.businessCard",
			},
			{
				href: "/settings/inbox",
				labelKey: "settings.nav.inbox",
			},
			{
				href: "/settings/security",
				labelKey: "settings.nav.security",
			},
			{
				href: "/settings/api-keys",
				labelKey: "settings.nav.apiKeys",
			},
			{
				href: "/settings/app-passwords",
				labelKey: "settings.nav.appPasswords",
			},
			{
				href: "/settings/rules",
				labelKey: "settings.nav.rules",
			},
			{
				href: "/settings/desktop",
				labelKey: "settings.nav.desktop",
			},
			{
				href: "/settings/mobile",
				labelKey: "settings.nav.mobile",
			},
		],
	},
	{
		labelKey: "settings.nav.mailbox",
		items: [
			{
				href: "/settings/mailboxes",
				labelKey: "admin.nav.mailboxes",
				requiresMailboxAccess: true,
			},
			{
				href: "/settings/import",
				labelKey: "settings.nav.import",
			},
			{
				href: "/settings/export",
				labelKey: "settings.nav.export",
			},
		],
	},
];

export function isActiveSettingsPath(pathname: string, href: string): boolean {
	return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * What the settings pages load when they open. The menu asks for these once it is on screen, so the
 * pages behind it open from the client cache (src/lib/auth/get-cache.ts) instead of waiting on the server.
 */
export const settingsWarmUpUrls = [
	"/api/auth/me",
	"/api/settings/business-card",
	"/api/push/config",
	"/api/settings/recipient-addresses",
	"/api/settings/trash-retention",
	"/api/settings/remote-content",
	"/api/settings/spam",
	"/api/settings/mfa",
	"/api/devices",
	"/api/api-keys",
	"/api/desktop/latest",
];
