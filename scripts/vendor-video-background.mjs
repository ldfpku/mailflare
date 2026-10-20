// Builds the meeting page's video background (src/lib/meetings/video-background)
// into public/vendor/video-background/<version>: the MediaPipe wasm (SIMD build
// only) from node_modules/@mediapipe/tasks-vision, and the page module bundled
// with esbuild. The model and the SMJ background images in that directory are
// committed as they are; they match HuLa's public/video-bg. The output is
// committed; rerun after changing the client or the MediaPipe version:
//
//   node scripts/vendor-video-background.mjs
import { build } from "esbuild";
import { cpSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const pkg = join(root, "node_modules", "@mediapipe", "tasks-vision");
const version = JSON.parse(readFileSync(join(pkg, "package.json"), "utf8")).version;
const output = join(root, "public", "vendor", "video-background", version);

for (const file of ["selfie_segmenter_landscape.tflite", "backgrounds/smj-hook.png", "backgrounds/smj-split.png", "backgrounds/smj-wall.jpg"]) {
	if (!existsSync(join(output, file))) throw new Error(`Missing ${file} in ${output}; copy it from HuLa public/video-bg`);
}

mkdirSync(join(output, "wasm"), { recursive: true });
for (const file of ["vision_wasm_internal.js", "vision_wasm_internal.wasm"]) cpSync(join(pkg, "wasm", file), join(output, "wasm", file));
if (existsSync(join(pkg, "LICENSE"))) cpSync(join(pkg, "LICENSE"), join(output, "LICENSE"));

const bundle = join(output, "smj-video-background.js");
await build({
	entryPoints: [join(root, "src", "lib", "meetings", "video-background", "client.ts")],
	bundle: true,
	format: "esm",
	target: "es2020",
	minify: true,
	legalComments: "eof",
	outfile: bundle,
	logLevel: "warning",
});

const urls = [bundle, join(output, "wasm", "vision_wasm_internal.js")]
	.flatMap((file) => readFileSync(file, "utf8").match(/https?:\/\/[a-z0-9.-]+\.[a-z]{2,}[^\s"'`)]*/gi) || [])
	.filter((url) => !/^https?:\/\/(www\.)?(apache\.org|github\.com\/emscripten-core)/.test(url));
if (urls.length) console.warn("[video-background] absolute URLs in the output (check none is fetched):", [...new Set(urls)]);
console.log(`[video-background] MediaPipe ${version} and the page module written to public/vendor/video-background/${version}`);
