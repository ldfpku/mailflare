// Builds HuLa's web client into public/im so the Worker serves it at /im.
// HuLa is a separate repository checked out next to this one (../HuLa), or wherever HULA_DIR points.
// Without a HuLa checkout the step is skipped and any existing public/im is kept.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const candidates = [process.env.HULA_DIR, path.resolve(root, "../HuLa"), path.resolve(root, "../hula")].filter(Boolean);
const hulaDir = candidates.find((dir) => existsSync(path.join(dir, "src/web/entry.ts")));

if (!hulaDir) {
	console.warn("[im-web] HuLa checkout with the web build not found (set HULA_DIR); skipping, /im keeps its current files.");
	process.exit(0);
}

const outDir = path.join(root, "public", "im");
console.log(`[im-web] building ${hulaDir} -> ${outDir}`);
// HuLa needs pnpm 10; npx pins it so a newer global pnpm does not break the build.
const result = spawnSync(`npx --yes pnpm@10 run build:web --outDir "${outDir}" --emptyOutDir`, {
	cwd: hulaDir,
	stdio: "inherit",
	shell: true,
});
process.exit(result.status ?? 1);
