// Copies the RealtimeKit browser build and UI Kit into public/vendor so the
// meeting page loads nothing from a CDN, patches out the UI Kit's Google
// Fonts loader, and patches how the core picks the received video quality.
// The output is committed; rerun this only to change version, and bump
// CORE_REVISION in src/lib/meetings/page.ts whenever the core file changes:
//
//   node scripts/vendor-realtimekit.mjs [version]
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const version = process.argv[2] || "2.0.2";
const root = fileURLToPath(new URL("../", import.meta.url));
const output = join(root, "public", "vendor", "realtimekit", version);
// Matches FONT_STACK in src/lib/meetings/page.ts.
const fontStack = `"Barlow", "Noto Sans SC", "Microsoft YaHei", "PingFang SC", system-ui, sans-serif`;

function unpack(name, into) {
	mkdirSync(into, { recursive: true });
	const tarball = execFileSync("npm", ["pack", `${name}@${version}`, "--silent", "--pack-destination", into], {
		encoding: "utf8",
		shell: process.platform === "win32",
	}).trim();
	execFileSync("tar", ["-xzf", join(into, tarball.split("\n").pop()), "-C", into]);
	return join(into, "package");
}

function patchGoogleFonts(directory) {
	let patched = 0;
	for (const file of readdirSync(directory)) {
		const path = join(directory, file);
		const source = readFileSync(path, "utf8");
		if (!source.includes("const provideGoogleFont")) continue;
		const next = source
			.replace(/const provideGoogleFont = \(fontFamily\) => \{[\s\S]*?\n\};\n/, "const provideGoogleFont = () => {};\n")
			.replace(
				"el.style.setProperty(getToken('font-family', tokenPrefix), googleFont);",
				`el.style.setProperty(getToken('font-family', tokenPrefix), ${JSON.stringify(fontStack)});`,
			);
		if (/fonts\.(googleapis|gstatic)\.com/.test(next) || next.includes(", googleFont);")) {
			throw new Error(`Could not patch the Google Fonts loader in ${file}`);
		}
		writeFileSync(path, next);
		patched += 1;
	}
	if (patched === 0) throw new Error("No Google Fonts loader found to patch; check the UI Kit layout");
	return patched;
}

/**
 * The core picks each remote video's simulcast layer from its tile: layer 0 is
 * the quarter-size encoding, layer 1 the half-size one, and the full encoding is
 * only used until the first switch. It also compares against CSS pixels, so on a
 * high-DPI screen a large tile still drops to 320x180. Patched so layer 0 is the
 * half-size encoding and layer 1 the full one, tiles are measured in device
 * pixels, and the downswitch threshold (2.4x) leaves room for the factor-of-two
 * jump between layers, so a tile does not flip back and forth.
 */
const CORE_PATCHES = [
	['preferredRid:e===0?"q":"h"', 'preferredRid:e===0?"h":"f"'],
	["const pD=.8,mD=1.2;", "const pD=.8,mD=2.4;"],
	["const o=n/r,c=i/e,d=Math.max(o,c);", "const dpr=window.devicePixelRatio||1,o=n/(r*dpr),c=i/(e*dpr),d=Math.max(o,c);"],
];

function patchCore(path) {
	let source = readFileSync(path, "utf8");
	for (const [from, to] of CORE_PATCHES) {
		if (source.split(from).length !== 2) throw new Error(`Could not patch the RealtimeKit core: ${from}`);
		source = source.replace(from, to);
	}
	writeFileSync(path, source);
}

const work = mkdtempSync(join(tmpdir(), "realtimekit-"));
try {
	const core = unpack("@cloudflare/realtimekit", join(work, "core"));
	const ui = unpack("@cloudflare/realtimekit-ui", join(work, "ui"));

	if (existsSync(output)) rmSync(output, { recursive: true });
	mkdirSync(join(output, "core"), { recursive: true });
	cpSync(join(core, "dist", "browser.js"), join(output, "core", "browser.js"));
	cpSync(join(ui, "loader"), join(output, "ui", "loader"), { recursive: true });
	cpSync(join(ui, "dist", "esm"), join(output, "ui", "dist", "esm"), { recursive: true });
	for (const license of ["LICENSE", "LICENSE.md", "LICENSE.txt"]) {
		if (existsSync(join(ui, license))) cpSync(join(ui, license), join(output, "ui", license));
		if (existsSync(join(core, license))) cpSync(join(core, license), join(output, "core", license));
	}

	patchCore(join(output, "core", "browser.js"));
	const patched = patchGoogleFonts(join(output, "ui", "dist", "esm"));
	console.log(`[realtimekit] ${version} copied to public/vendor/realtimekit/${version} (${patched} font loaders patched)`);
} finally {
	rmSync(work, { recursive: true, force: true });
}
