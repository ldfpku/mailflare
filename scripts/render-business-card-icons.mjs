// Renders the card contact icons (src/lib/business-card/card-icons.ts) to the 2x PNGs the email signature links to,
// since mail clients drop inline SVG. Uses the resvg wasm that vinext already installs (through @vercel/og).
import fs from "node:fs";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { initWasm, Resvg } from "@resvg/resvg-wasm";

const require = createRequire(import.meta.url);
await initWasm(fs.readFileSync(require.resolve("@resvg/resvg-wasm/index_bg.wasm")));
const bundle = await build({ entryPoints: ["src/lib/business-card/card-icons.ts"], bundle: true, write: false, format: "esm", platform: "neutral" });
const { CARD_ICON_FILES, cardIconSvg } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`);
// Well Navy, the colour of the contact lines (BIS C1 / C3).
const NAVY = "#0A1F54";
for (const [icon, file] of Object.entries(CARD_ICON_FILES)) {
	const png = new Resvg(cardIconSvg(icon, NAVY), { fitTo: { mode: "width", value: 24 } }).render().asPng();
	fs.writeFileSync(`public${file}`, png);
	console.log(`public${file}`, png.length, "bytes");
}
