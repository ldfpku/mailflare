import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import test, { after } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const directory = mkdtempSync(join(root, "node_modules", "mailflare-desktop-test-"));
after(() => rmSync(directory, { recursive: true, force: true }));
await build({
	entryPoints: [join(root, "src/lib/desktop/release-utils.ts")],
	outfile: join(directory, "entry.mjs"),
	bundle: true,
	platform: "node",
	format: "esm",
	target: "node22",
	tsconfig: join(root, "tsconfig.json"),
	packages: "external",
	logLevel: "silent",
});
const desktop = await import(pathToFileURL(join(directory, "entry.mjs")).href);

const ORIGIN = "https://mail.one.test";
// The shape HuLa's .github/scripts/desktop-manifest.mjs writes.
const MANIFEST = {
	version: "1.0.2",
	notes: "- 修复远程协助\n- 新增安装包",
	pub_date: "2026-10-20T02:07:31Z",
	platforms: {
		"windows-x86_64": { file: "1.0.2/SMJ_1.0.2_x64-setup.exe", signature: "c2lnLXdpbg==" },
		"darwin-aarch64": { file: "1.0.2/SMJ_1.0.2_universal.app.tar.gz", signature: "c2lnLW1hYw==" },
		"darwin-x86_64": { file: "1.0.2/SMJ_1.0.2_universal.app.tar.gz", signature: "c2lnLW1hYw==" },
		"windows-../x": { file: "1.0.2/x.exe", signature: "s" },
		"linux-x86_64": { file: "../../latest.json", signature: "s" },
	},
	downloads: {
		windows: { file: "1.0.2/SMJ_1.0.2_x64-setup.exe", size: 41943040 },
		macos: { file: "1.0.2/SMJ_1.0.2_universal.dmg", size: 52428800 },
	},
};

test("versions compare numerically", () => {
	assert.ok(desktop.compareDesktopVersions("1.0.10", "1.0.9") > 0);
	assert.ok(desktop.compareDesktopVersions("1.10.0", "1.9.9") > 0);
	assert.equal(desktop.compareDesktopVersions("1.0.2", "1.0.2"), 0);
	// A garbled client version is older than anything, so it still receives the update
	assert.ok(desktop.compareDesktopVersions("1.0.0", "garbage") > 0);
});

test("release files stay inside releases/<version>/", () => {
	assert.equal(desktop.isDesktopReleaseFile("1.0.2/SMJ_1.0.2_x64-setup.exe"), true);
	assert.equal(desktop.isDesktopReleaseFile("../latest.json"), false);
	assert.equal(desktop.isDesktopReleaseFile("1.0.2/../latest.json"), false);
	assert.equal(desktop.isDesktopReleaseFile("1.0.2/a/b.exe"), false);
	assert.equal(desktop.isDesktopReleaseFile("1.0.2/..exe"), false);
	assert.equal(desktop.isDesktopReleaseFile("latest/SMJ.exe"), false);
	assert.equal(desktop.desktopReleaseObjectKey("1.0.2/SMJ.dmg"), "releases/1.0.2/SMJ.dmg");
});

test("the manifest parser keeps only well-formed platforms and downloads", () => {
	const manifest = desktop.parseDesktopManifest(MANIFEST);
	assert.deepEqual(Object.keys(manifest.platforms).sort(), ["darwin-aarch64", "darwin-x86_64", "windows-x86_64"]);
	assert.deepEqual(Object.keys(manifest.downloads), ["windows", "macos"]);
	assert.equal(desktop.parseDesktopManifest({ ...MANIFEST, version: "v1" }), null);
	assert.equal(desktop.parseDesktopManifest(null), null);
});

test("the updater gets the newer build for its platform and nothing otherwise", () => {
	const manifest = desktop.parseDesktopManifest(MANIFEST);
	assert.deepEqual(desktop.resolveDesktopUpdate(manifest, "windows", "x86_64", "1.0.0", ORIGIN), {
		version: "1.0.2",
		notes: "- 修复远程协助\n- 新增安装包",
		pub_date: "2026-10-20T02:07:31Z",
		url: `${ORIGIN}/api/desktop/download/1.0.2/SMJ_1.0.2_x64-setup.exe`,
		signature: "c2lnLXdpbg==",
	});
	assert.equal(desktop.resolveDesktopUpdate(manifest, "darwin", "aarch64", "1.0.1", ORIGIN).url, `${ORIGIN}/api/desktop/download/1.0.2/SMJ_1.0.2_universal.app.tar.gz`);
	assert.equal(desktop.resolveDesktopUpdate(manifest, "windows", "x86_64", "1.0.2", ORIGIN), null);
	assert.equal(desktop.resolveDesktopUpdate(manifest, "windows", "x86_64", "2.0.0", ORIGIN), null);
	assert.equal(desktop.resolveDesktopUpdate(manifest, "linux", "x86_64", "1.0.0", ORIGIN), null);
	const windowsOnly = desktop.parseDesktopManifest({ ...MANIFEST, platforms: { "windows-x86_64": MANIFEST.platforms["windows-x86_64"] } });
	assert.equal(desktop.resolveDesktopUpdate(windowsOnly, "darwin", "aarch64", "1.0.0", ORIGIN), null);
});

test("the download page lists both systems with absolute links", () => {
	const info = desktop.desktopReleaseInfo(desktop.parseDesktopManifest(MANIFEST), ORIGIN);
	assert.equal(info.version, "1.0.2");
	assert.deepEqual(info.downloads.map((item) => [item.os, item.fileName, item.size]), [
		["windows", "SMJ_1.0.2_x64-setup.exe", 41943040],
		["macos", "SMJ_1.0.2_universal.dmg", 52428800],
	]);
	assert.equal(info.downloads[1].url, `${ORIGIN}/api/desktop/download/1.0.2/SMJ_1.0.2_universal.dmg`);
});

test("the visitor's system is recognised from the User-Agent", () => {
	assert.equal(desktop.detectDesktopOs("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/141 Safari/537.36"), "windows");
	assert.equal(desktop.detectDesktopOs("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15"), "macos");
	assert.equal(desktop.detectDesktopOs("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15"), null);
	assert.equal(desktop.detectDesktopOs("Mozilla/5.0 (X11; Linux x86_64)"), null);
	assert.equal(desktop.desktopFileContentType("SMJ_1.0.2_universal.dmg"), "application/x-apple-diskimage");
});
