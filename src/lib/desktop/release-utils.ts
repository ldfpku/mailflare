import type {
	DesktopDownloadInfo,
	DesktopManifest,
	DesktopOs,
	DesktopReleaseInfo,
	DesktopUpdateResponse,
} from "./release-types";

const VERSION = /^\d{1,4}\.\d{1,4}\.\d{1,6}$/;
// Release files are named by the HuLa workflow: SMJ_<version>_x64-setup.exe, SMJ_<version>_universal.dmg ...
const FILE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const DESKTOP_OSES: DesktopOs[] = ["windows", "macos"];

export function isDesktopVersion(value: string): boolean {
	return VERSION.test(value);
}

/** Numeric x.y.z comparison; anything that is not x.y.z sorts first so a garbled client still gets the update. */
export function compareDesktopVersions(a: string, b: string): number {
	const parse = (value: string) => (isDesktopVersion(value) ? value.split(".").map(Number) : [-1, -1, -1]);
	const left = parse(a);
	const right = parse(b);
	for (let i = 0; i < 3; i++) {
		if (left[i] !== right[i]) return left[i] - right[i];
	}
	return 0;
}

/** `<version>/<file>` as stored in latest.json and as the download route receives it. */
export function isDesktopReleaseFile(value: string): boolean {
	const [version, name, ...rest] = value.split("/");
	return rest.length === 0 && !!version && !!name && isDesktopVersion(version) && FILE_NAME.test(name) && !name.includes("..");
}

export function desktopReleaseObjectKey(file: string): string {
	return `releases/${file}`;
}

export function desktopDownloadUrl(origin: string, file: string): string {
	const [version, name] = file.split("/");
	return `${origin}/api/desktop/download/${version}/${encodeURIComponent(name)}`;
}

export function parseDesktopManifest(value: unknown): DesktopManifest | null {
	if (!value || typeof value !== "object") return null;
	const raw = value as Record<string, unknown>;
	if (typeof raw.version !== "string" || !isDesktopVersion(raw.version)) return null;
	const platforms: DesktopManifest["platforms"] = {};
	if (raw.platforms && typeof raw.platforms === "object") {
		for (const [key, entry] of Object.entries(raw.platforms as Record<string, unknown>)) {
			const item = entry as Record<string, unknown> | null;
			if (!/^[a-z]+-[a-z0-9_]+$/.test(key) || !item) continue;
			if (typeof item.file !== "string" || !isDesktopReleaseFile(item.file)) continue;
			if (typeof item.signature !== "string" || !item.signature.trim()) continue;
			platforms[key] = { file: item.file, signature: item.signature.trim() };
		}
	}
	const downloads: DesktopManifest["downloads"] = {};
	if (raw.downloads && typeof raw.downloads === "object") {
		for (const os of DESKTOP_OSES) {
			const item = (raw.downloads as Record<string, unknown>)[os] as Record<string, unknown> | undefined;
			if (!item || typeof item.file !== "string" || !isDesktopReleaseFile(item.file)) continue;
			downloads[os] = { file: item.file, size: typeof item.size === "number" && item.size > 0 ? item.size : 0 };
		}
	}
	return {
		version: raw.version,
		notes: typeof raw.notes === "string" ? raw.notes : "",
		pub_date: typeof raw.pub_date === "string" ? raw.pub_date : "",
		platforms,
		downloads,
	};
}

/**
 * Answer the Tauri updater: the update for `<target>-<arch>` when the manifest is newer than the
 * running version, otherwise null (the route turns that into 204 No Content).
 */
export function resolveDesktopUpdate(
	manifest: DesktopManifest,
	target: string,
	arch: string,
	currentVersion: string,
	origin: string,
): DesktopUpdateResponse | null {
	const platform = manifest.platforms[`${target}-${arch}`];
	if (!platform) return null;
	if (compareDesktopVersions(manifest.version, currentVersion) <= 0) return null;
	return {
		version: manifest.version,
		notes: manifest.notes,
		pub_date: manifest.pub_date,
		url: desktopDownloadUrl(origin, platform.file),
		signature: platform.signature,
	};
}

export function desktopReleaseInfo(manifest: DesktopManifest, origin: string): DesktopReleaseInfo {
	const downloads: DesktopDownloadInfo[] = [];
	for (const os of DESKTOP_OSES) {
		const item = manifest.downloads[os];
		if (!item) continue;
		downloads.push({ os, url: desktopDownloadUrl(origin, item.file), fileName: item.file.split("/")[1], size: item.size });
	}
	return { version: manifest.version, notes: manifest.notes, publishedAt: manifest.pub_date, downloads };
}

export function desktopFileContentType(name: string): string {
	if (name.endsWith(".exe")) return "application/vnd.microsoft.portable-executable";
	if (name.endsWith(".dmg")) return "application/x-apple-diskimage";
	if (name.endsWith(".tar.gz")) return "application/gzip";
	return "application/octet-stream";
}

/** The visitor's desktop system from the User-Agent, so the page can put that download first. */
export function detectDesktopOs(userAgent: string): DesktopOs | null {
	if (/Windows NT/i.test(userAgent)) return "windows";
	if (/Macintosh|Mac OS X/i.test(userAgent) && !/iPhone|iPad/i.test(userAgent)) return "macos";
	return null;
}
