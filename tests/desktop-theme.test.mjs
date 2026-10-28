import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import test, { after } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runInNewContext } from "node:vm";
import { build } from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const directory = mkdtempSync(join(root, "node_modules", "desktop-theme-test-"));
after(() => rmSync(directory, { recursive: true, force: true }));
await build({
	entryPoints: [join(root, "src/components/theme-utils.ts")],
	outfile: join(directory, "theme.mjs"),
	bundle: true,
	platform: "node",
	format: "esm",
	logLevel: "silent",
});
const theme = await import(pathToFileURL(join(directory, "theme.mjs")).href);

function storage(initial = {}) {
	const values = new Map(Object.entries(initial));
	return {
		getItem: (key) => values.get(key) ?? null,
		setItem: (key, value) => values.set(key, String(value)),
		removeItem: (key) => values.delete(key),
	};
}

function fixture(search, saved = {}) {
	const localStorage = storage(saved);
	const sessionStorage = storage();
	const classes = new Set();
	const document = { documentElement: { classList: { toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name) } } };
	const matchMedia = () => ({ matches: true });
	const window = { location: { search }, sessionStorage, matchMedia, dispatchEvent: () => true };
	const context = { window, document, localStorage, sessionStorage, matchMedia, URLSearchParams };
	return { ...context, classes };
}

function bootstrap(f) {
	runInNewContext(theme.themeBootstrapScript, f);
}

test("desktop mail defaults to light before paint and across navigation, while web keeps system default", () => {
	const desktop = fixture("?smj_desktop=1");
	bootstrap(desktop);
	assert.equal(desktop.classes.has("light"), true);
	assert.equal(desktop.classes.has("dark"), false);
	desktop.window.location.search = "";
	bootstrap(desktop);
	assert.equal(desktop.classes.has("light"), true);
	const web = fixture("");
	bootstrap(web);
	assert.equal(web.classes.has("dark"), true);
});

test("desktop mail respects a saved dark or explicit system preference", () => {
	for (const saved of ["dark", "system"]) {
		const f = fixture("?smj_desktop=1", { "mailflare-theme": saved });
		bootstrap(f);
		assert.equal(f.classes.has("dark"), true);
	}
});

test("the marked desktop window still defaults to light when storage is unavailable", () => {
	const f = fixture("?smj_desktop=1");
	const blocked = {
		getItem: () => { throw new Error("storage blocked"); },
		setItem: () => { throw new Error("storage blocked"); },
	};
	f.localStorage = blocked;
	f.sessionStorage = blocked;
	f.window.sessionStorage = blocked;
	f.console = { warn() {} };
	bootstrap(f);
	assert.equal(f.classes.has("light"), true);
	const old = { window: globalThis.window, localStorage: globalThis.localStorage };
	const warn = console.warn;
	Object.assign(globalThis, { window: f.window, localStorage: blocked });
	console.warn = () => {};
	try {
		assert.equal(theme.readThemePreference(), "light");
	} finally {
		console.warn = warn;
		Object.assign(globalThis, old);
	}
});

test("runtime and bootstrap agree and explicitly saving system keeps it selected", () => {
	const f = fixture("?smj_desktop=1");
	bootstrap(f);
	const old = { window: globalThis.window, document: globalThis.document, localStorage: globalThis.localStorage };
	Object.assign(globalThis, { window: f.window, document: f.document, localStorage: f.localStorage });
	try {
		assert.equal(theme.readThemePreference(), "light");
		theme.saveThemePreference("system");
		assert.equal(theme.readThemePreference(), "system");
		assert.equal(f.localStorage.getItem("mailflare-theme"), "system");
		assert.equal(f.classes.has("dark"), true);
		bootstrap(f);
		assert.equal(f.classes.has("dark"), true);
	} finally {
		Object.assign(globalThis, old);
	}
});
