// Copies the RealtimeKit browser build and UI Kit into public/vendor so the
// meeting page loads nothing from a CDN, patches out the UI Kit's Google
// Fonts loader, and patches how the core picks the received video quality and the screen
// share bitrate.
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
 * only used until the first switch. Stock, it compared the received size with
 * the one element whose resize fired last (in CSS pixels), only on a resize, and
 * only when its own idea of the layer changed, so a share started and stopped
 * twice could leave a full-size tile on 640x360 for good. Patched so:
 *
 * - layer 0 is the half-size encoding and layer 1 the full one;
 * - the decision uses the largest visible tile of that person: the width a
 *   16:9 picture fills in it, in device pixels. 580 or more gets the full
 *   layer, under 530 half, in between keeps the current one (the gap stops
 *   tiles flipping);
 * - it runs again every few seconds while the person has a tile, and re-sends
 *   the layer every 30 s even when unchanged, so a lost switch heals itself;
 * - the last decision per person is kept in `window.__smjLayers` for tests.
 */
const ORIGINAL_LAYER_PICK =
	'g(this,Sl,Ou(t=>{if(!this.videoTrack)return;const{clientWidth:e,clientHeight:r}=t,{width:i,height:n}=this.videoTrack.getSettings();if(!i||!n)return;const o=n/r,c=i/e,d=Math.max(o,c);d>mD&&a(this,mr)===1?(f(this,mr,0),a(this,$t).getValue("peerSessionStore").emit(k.MAX_SPATIAL_LAYER_CHANGE,{peerId:this.id,maxSpatialLayer:a(this,mr)})):d<pD&&a(this,mr)===0&&(f(this,mr,1),a(this,$t).getValue("peerSessionStore").emit(k.MAX_SPATIAL_LAYER_CHANGE,{peerId:this.id,maxSpatialLayer:a(this,mr)}))},2e3))';
const PATCHED_LAYER_PICK =
	'g(this,Sl,Ou(()=>{clearTimeout(this.smjLayerTimer);const els=Array.from(a(this,Zr).keys());if(!els.length)return;this.smjLayerTimer=setTimeout(()=>a(this,Sl).call(this),5e3);if(!this.videoTrack)return;let w=0,h=0;for(const el of els)if(el.isConnected&&el.clientWidth*el.clientHeight>w*h){w=el.clientWidth;h=el.clientHeight}if(!w||!h)return;const size=Math.min(w,h*16/9)*(window.devicePixelRatio||1),cur=a(this,mr),next=size>=pD?1:size<mD?0:cur,now=Date.now();(window.__smjLayers||(window.__smjLayers={}))[this.id]={w,h,layer:next,at:now};if(next!==cur||now-(this.smjLayerAt||0)>3e4){f(this,mr,next);this.smjLayerAt=now;a(this,$t).getValue("peerSessionStore").emit(k.MAX_SPATIAL_LAYER_CHANGE,{peerId:this.id,maxSpatialLayer:next})}},2e3))';

// Screen share is produced with one encoding and no bitrate cap, so Chrome
// limits it to its 2.5 Mbps default and text on a 2K screen blurs; give it
// 6 Mbps and up to 30 fps (the SFU only takes VP8 for it).
const SCREEN_SHARE_PRODUCE = 'codecOptions:[{name:"VP8"}],appData:{screenShare:!0';

const CORE_PATCHES = [
	['preferredRid:e===0?"q":"h"', 'preferredRid:e===0?"h":"f"'],
	[SCREEN_SHARE_PRODUCE, `encodings:[{maxBitrate:6e6,maxFramerate:30,priority:"high"}],${SCREEN_SHARE_PRODUCE}`],
	["const pD=.8,mD=1.2;", "const pD=580,mD=530;"],
	[ORIGINAL_LAYER_PICK, PATCHED_LAYER_PICK],
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
