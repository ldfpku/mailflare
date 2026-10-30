import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import test, { after } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";
import { JSDOM } from "jsdom";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const directory = mkdtempSync(join(root, "node_modules", "mailbox-session-test-"));
after(() => rmSync(directory, { recursive: true, force: true }));
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://mail.example.test/" });
for (const key of ["window", "document", "HTMLElement", "Event", "localStorage", "navigator"]) {
	Object.defineProperty(globalThis, key, { value: key === "window" ? dom.window : dom.window[key], configurable: true, writable: true });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
await build({
	entryPoints: [join(root, "src/components/mailbox-provider.tsx")],
	outfile: join(directory, "mailbox.mjs"),
	bundle: true,
	platform: "browser",
	format: "esm",
	external: ["react", "react-dom", "react-dom/*"],
	alias: { "@": join(root, "src") },
	plugins: [{
		name: "session-stubs",
		setup(builder) {
			const modules = {
				"@/lib/auth/client": 'export const AUTH_SESSION_CHANGED_EVENT = "test-session-changed"; export function getClientSessionToken() { return globalThis.mailboxSession; }',
				"@/hooks/use-current-user": 'export async function fetchSessionInfo() { return { status: globalThis.testSessionStatus ?? 200 }; }',
				"./mailbox-provider-utils": 'export const SELECTED_MAILBOX_STORAGE_KEY = "selected-mailbox-id"; export function clearMailboxesCache() {} export function isIdentityMailbox() { return false; } export function fetchMailboxOptions() { return globalThis.loadTestMailboxes(); }',
			};
			builder.onResolve({ filter: /.*/ }, ({ path }) => path in modules ? { path, namespace: "stub" } : undefined);
			builder.onLoad({ filter: /.*/, namespace: "stub" }, ({ path }) => ({ contents: modules[path], loader: "js" }));
		},
	}],
	logLevel: "silent",
});
const { createElement, act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { MailboxProvider, useSelectedMailbox } = await import(pathToFileURL(join(directory, "mailbox.mjs")).href);

test("a session change reloads mailboxes and discards an older account response", async (t) => {
	const pending = [];
	globalThis.mailboxSession = "account-a";
	globalThis.loadTestMailboxes = () => new Promise((resolve) => pending.push(resolve));
	const container = document.createElement("div");
	document.body.appendChild(container);
	const root = createRoot(container);
	t.after(async () => {
		await act(async () => root.unmount());
		container.remove();
		localStorage.clear();
		delete globalThis.mailboxSession;
		delete globalThis.loadTestMailboxes;
		delete globalThis.testSessionStatus;
	});

	function CurrentMailbox() {
		const { selectedMailbox, isLoading } = useSelectedMailbox();
		return createElement("output", null, isLoading ? "loading" : selectedMailbox?.id ?? "none");
	}
	await act(async () => root.render(createElement(MailboxProvider, null, createElement(CurrentMailbox))));
	assert.equal(pending.length, 1);
	globalThis.mailboxSession = "account-b";
	await act(async () => window.dispatchEvent(new Event("test-session-changed")));
	assert.equal(pending.length, 2);
	await act(async () => pending[1]([{ id: "mailbox-b", isPrimary: true }]));
	assert.equal(container.textContent, "mailbox-b");
	await act(async () => pending[0]([{ id: "mailbox-a", isPrimary: true }]));
	assert.equal(container.textContent, "mailbox-b");
});

test("the public login page does not load mailboxes for an unauthenticated session", async (t) => {
	globalThis.mailboxSession = null;
	globalThis.testSessionStatus = 401;
	let requests = 0;
	globalThis.loadTestMailboxes = async () => { requests++; return []; };
	const container = document.createElement("div");
	document.body.appendChild(container);
	const root = createRoot(container);
	t.after(async () => {
		await act(async () => root.unmount());
		container.remove();
		delete globalThis.mailboxSession;
		delete globalThis.testSessionStatus;
		delete globalThis.loadTestMailboxes;
	});
	function CurrentMailbox() {
		const { selectedMailbox, isLoading } = useSelectedMailbox();
		return createElement("output", null, isLoading ? "loading" : selectedMailbox?.id ?? "none");
	}
	await act(async () => root.render(createElement(MailboxProvider, null, createElement(CurrentMailbox))));
	assert.equal(container.textContent, "none");
	assert.equal(requests, 0);
});
