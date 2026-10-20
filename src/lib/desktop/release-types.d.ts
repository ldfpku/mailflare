/** One update bundle in latest.json, keyed by Tauri's `{{target}}-{{arch}}` (e.g. `windows-x86_64`). */
export interface DesktopUpdatePlatform {
	/** `<version>/<file name>`; the object lives at `releases/<file>` in DESKTOP_BUCKET. */
	file: string;
	/** Contents of the `.sig` file Tauri wrote next to the bundle. */
	signature: string;
}

/** A first-install download offered on the download page. */
export interface DesktopDownload {
	file: string;
	size: number;
}

export type DesktopOs = "windows" | "macos";

/** `latest.json` as written by HuLa's .github/scripts/desktop-manifest.mjs. */
export interface DesktopManifest {
	version: string;
	notes: string;
	pub_date: string;
	platforms: Record<string, DesktopUpdatePlatform>;
	downloads: Partial<Record<DesktopOs, DesktopDownload>>;
}

/** The dynamic-server response the Tauri updater expects when an update is available. */
export interface DesktopUpdateResponse {
	version: string;
	notes: string;
	pub_date: string;
	url: string;
	signature: string;
}

export interface DesktopDownloadInfo {
	os: DesktopOs;
	url: string;
	fileName: string;
	size: number;
}

/** What /api/desktop/latest returns to the download page. */
export interface DesktopReleaseInfo {
	version: string;
	notes: string;
	publishedAt: string;
	downloads: DesktopDownloadInfo[];
}
