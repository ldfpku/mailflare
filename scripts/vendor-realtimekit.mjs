// Copies the RealtimeKit browser build and UI Kit into public/vendor so the
// meeting page loads nothing from a CDN, and patches out the UI Kit's Google
// Fonts loader. The output is committed; rerun this only to change version:
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

	const patched = patchGoogleFonts(join(output, "ui", "dist", "esm"));
	console.log(`[realtimekit] ${version} copied to public/vendor/realtimekit/${version} (${patched} font loaders patched)`);
} finally {
	rmSync(work, { recursive: true, force: true });
}
