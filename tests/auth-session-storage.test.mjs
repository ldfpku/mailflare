import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import test, { after } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";
import { JSDOM } from "jsdom";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const directory = mkdtempSync(join(root, "node_modules", "auth-session-storage-test-"));
after(() => rmSync(directory, { recursive: true, force: true }));
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://mail.example.test/" });
for (const key of ["window", "document", "localStorage", "navigator", "CustomEvent"]) {
	Object.defineProperty(globalThis, key, { value: key === "window" ? dom.window : dom.window[key], configurable: true, writable: true });
}
await build({
	entryPoints: [join(root, "src/lib/auth/client.ts")],
	outfile: join(directory, "auth.mjs"),
	bundle: true,
	platform: "browser",
	format: "esm",
	alias: { "@": join(root, "src") },
	logLevel: "silent",
});
const { AUTH_SESSION_CHANGED_EVENT, authFetch, getClientSessionToken, setClientSessionToken } = await import(pathToFileURL(join(directory, "auth.mjs")).href);

test("another tab's session change notifies existing editors without exposing the token", () => {
	const details = [];
	const listener = (event) => details.push(event.detail);
	window.addEventListener(AUTH_SESSION_CHANGED_EVENT, listener);
	try {
		window.dispatchEvent(new dom.window.StorageEvent("storage", {
			key: "mailflare-session-token",
			oldValue: "old-test-token",
			newValue: "new-test-token",
		}));
		window.dispatchEvent(new dom.window.StorageEvent("storage", {
			key: "another-key",
			oldValue: "old-value",
			newValue: "new-value",
		}));
		window.dispatchEvent(new dom.window.StorageEvent("storage", {
			key: "mailflare-session-token",
			oldValue: "new-test-token",
			newValue: null,
		}));
		assert.deepEqual(details, [{ authenticated: true }, { authenticated: false }]);
	} finally {
		window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, listener);
	}
});

test("a late unauthorized response cannot clear a newer account session", async (t) => {
	const originalFetch = globalThis.fetch;
	let finish;
	globalThis.fetch = () => new Promise((resolve) => { finish = resolve; });
	t.after(() => {
		globalThis.fetch = originalFetch;
		localStorage.clear();
	});
	setClientSessionToken("old-test-token");
	const request = authFetch("/api/test", { method: "POST" });
	setClientSessionToken("new-test-token");
	finish(new Response(null, { status: 401 }));
	assert.equal((await request).status, 401);
	assert.equal(getClientSessionToken(), "new-test-token");
});
