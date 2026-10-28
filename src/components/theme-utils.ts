export type ThemePreference = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "mailflare-theme";
export const THEME_CHANGED_EVENT = "mailflare:theme-changed";
export const DESKTOP_THEME_SESSION_KEY = "mailflare-desktop-window";

// Runs in <head> before paint, so the first frame already has the right theme (same approach as the
// sidebar width). Keep it in sync with resolveTheme/applyTheme below.
export const themeBootstrapScript = `(() => {
	const marker = new URLSearchParams(window.location.search).get("smj_desktop") === "1";
	let desktop = marker;
	let saved = null;
	try {
		if (marker) sessionStorage.setItem("mailflare-desktop-window", "1");
		desktop = desktop || sessionStorage.getItem("mailflare-desktop-window") === "1";
	} catch (error) { console.warn("Desktop theme session storage unavailable", error); }
	try { saved = localStorage.getItem("mailflare-theme"); }
	catch (error) { console.warn("Theme preference storage unavailable", error); }
	const preference = saved === "light" || saved === "dark" || saved === "system" ? saved : desktop ? "light" : "system";
	const dark = preference === "dark" || (preference === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
	document.documentElement.classList.toggle("dark", dark);
	document.documentElement.classList.toggle("light", !dark);
})();`;

export function isThemePreference(value: unknown): value is ThemePreference {
	return value === "light" || value === "dark" || value === "system";
}

function isDesktopMailWindow(): boolean {
	if (typeof window === "undefined") return false;
	const marker = new URLSearchParams(window.location.search).get("smj_desktop") === "1";
	try {
		if (marker) window.sessionStorage.setItem(DESKTOP_THEME_SESSION_KEY, "1");
		return marker || window.sessionStorage.getItem(DESKTOP_THEME_SESSION_KEY) === "1";
	} catch (error) {
		console.warn("Desktop theme session storage unavailable", error);
		return marker;
	}
}

export function readThemePreference(): ThemePreference {
	if (typeof window === "undefined") return "system";
	let saved: string | null = null;
	try {
		saved = localStorage.getItem(THEME_STORAGE_KEY);
	} catch (error) {
		console.warn("Theme preference storage unavailable", error);
	}
	return isThemePreference(saved) ? saved : isDesktopMailWindow() ? "light" : "system";
}

export function resolveTheme(preference: ThemePreference): "light" | "dark" {
	if (preference !== "system") return preference;
	if (typeof window === "undefined") return "light";
	return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(preference: ThemePreference): void {
	if (typeof document === "undefined") return;
	const dark = resolveTheme(preference) === "dark";
	document.documentElement.classList.toggle("dark", dark);
	document.documentElement.classList.toggle("light", !dark);
}

export function saveThemePreference(preference: ThemePreference): void {
	try {
		localStorage.setItem(THEME_STORAGE_KEY, preference);
	} catch (error) {
		// Storage can be unavailable in private windows; the theme still applies for this page.
		console.warn("Unable to save theme preference", error);
	}
	applyTheme(preference);
	if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(THEME_CHANGED_EVENT, { detail: preference }));
}
