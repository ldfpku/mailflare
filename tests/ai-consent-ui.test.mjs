import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import test, { after } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";
import { JSDOM } from "jsdom";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = mkdtempSync(join(root, "tests", ".tmp-ai-consent-"));
after(() => rmSync(outDir, { recursive: true, force: true }));
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://mail.example/" });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Element = dom.window.Element;
globalThis.Node = dom.window.Node;
globalThis.Event = dom.window.Event;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const outfile = join(outDir, "panel.mjs");
await build({
	stdin: {
		contents: `
			import { createElement, act } from "react";
			import { createRoot } from "react-dom/client";
			import { LanguageProvider } from "./src/components/language-provider";
			import { MailTodoDialog } from "./src/components/message-actions/mail-todo-dialog";
			export async function renderDialog() {
				const container = document.createElement("div");
				document.body.appendChild(container);
				const root = createRoot(container);
				await act(async () => root.render(createElement(LanguageProvider, { initialLocale: "en" },
					createElement(MailTodoDialog, { open: true, messageId: "message", onOpenChange() {} }))));
				return {
					container,
					click: async (button) => act(async () => button.click()),
					close: async () => act(async () => root.unmount()),
				};
			}
		`,
		resolveDir: root,
		loader: "tsx",
	},
	outfile,
	bundle: true,
	platform: "browser",
	format: "esm",
	target: "es2022",
	tsconfig: join(root, "tsconfig.json"),
	external: ["react", "react-dom", "react-dom/client", "jsdom"],
	alias: { "@": join(root, "src") },
	logLevel: "silent",
	plugins: [{
		name: "dialog-stub",
		setup(builder) {
			builder.onResolve({ filter: /^@\/components\/ui\/dialog$/ }, () => ({ path: "dialog", namespace: "test" }));
			builder.onLoad({ filter: /.*/, namespace: "test" }, () => ({
				loader: "jsx",
				contents: `import React from "react";
					export const Dialog = ({ open, children }) => open ? <div>{children}</div> : null;
					export const DialogContent = ({ children }) => <div>{children}</div>;
					export const DialogHeader = ({ children }) => <div>{children}</div>;
					export const DialogTitle = ({ children }) => <h2>{children}</h2>;
					export const DialogDescription = ({ children }) => <p>{children}</p>;`,
			}));
		},
	}],
});
const { renderDialog } = await import(pathToFileURL(outfile).href);

test("opening mail-to-do does not call AI until the user confirms", async () => {
	const originalFetch = globalThis.fetch;
	const requests = [];
	globalThis.fetch = async (url, init) => {
		requests.push({ url: String(url), body: JSON.parse(init.body) });
		return Response.json({ draft: { title: "Task", dueAt: null, notes: "Notes" } });
	};
	try {
		const dialog = await renderDialog();
		assert.equal(requests.length, 0);
		assert.match(dialog.container.textContent, /may consume credits or incur charges/);
		const button = [...dialog.container.querySelectorAll("button")].find((item) => item.textContent.includes("Confirm AI draft"));
		assert.ok(button);
		await dialog.click(button);
		assert.deepEqual(requests, [{ url: "/api/messages/message/todo", body: { draft: true, confirmed: true } }]);
		assert.equal(dialog.container.querySelector("#mail-todo-title").value, "Task");
		await dialog.close();
	} finally {
		globalThis.fetch = originalFetch;
	}
});
