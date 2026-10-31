import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import test, { after } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";
import { JSDOM } from "jsdom";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const directory = mkdtempSync(join(root, "node_modules", "attachment-viewer-test-"));
after(() => rmSync(directory, { recursive: true, force: true }));
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://mail.example.test/" });
for (const key of ["window", "document", "HTMLElement", "Element", "Node", "navigator"]) {
	Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true, writable: true });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

await build({
	stdin: {
		contents: `export { MessageAttachmentViewer } from "./src/components/message-attachment-viewer";
			export { getAttachmentPreviewKind } from "./src/components/message-attachment-viewer-utils";`,
		resolveDir: root,
		loader: "ts",
	},
	outfile: join(directory, "viewer.mjs"),
	bundle: true,
	platform: "browser",
	format: "esm",
	external: ["react", "react-dom", "react-dom/*"],
	alias: { "@": join(root, "src") },
	plugins: [{
		name: "viewer-test-dependencies",
		setup(builder) {
			const modules = {
				"@/lib/auth/client": "export function authFetch(...args) { return globalThis.attachmentFetch(...args); }",
				"@/components/language-provider": "const t = key => key; export function useLanguage() { return { t }; }",
				"@/components/ui/dialog": `import React from "react";
					const container = ({ children }) => React.createElement("div", null, children);
					export const Dialog = container, DialogContent = container, DialogDescription = container,
						DialogHeader = container, DialogTitle = container;`,
				"@/components/ui/button": "export function Button({ children }) { return children; }",
				"@/components/ui/skeleton": "export function Skeleton() { return null; }",
			};
			builder.onResolve({ filter: /.*/ }, ({ path }) => path in modules ? { path, namespace: "viewer-test-stub" } : undefined);
			builder.onLoad({ filter: /.*/, namespace: "viewer-test-stub" }, ({ path }) => ({ contents: modules[path], loader: "js" }));
		},
	}],
	logLevel: "silent",
});

const { createElement, act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { MessageAttachmentViewer, getAttachmentPreviewKind } = await import(pathToFileURL(join(directory, "viewer.mjs")).href);

test("classifies HTML and parameterized types without allowing SVG or malformed types", () => {
	for (const [type, kind] of [
		["TEXT/HTML; charset=utf-8", "html"],
		["application/pdf; name=guide.pdf", "pdf"],
		["text/plain; charset=utf-8", "text"],
		["image/svg+xml; charset=utf-8", "unsupported"],
		["image/png, text/html", "unsupported"],
	]) assert.equal(getAttachmentPreviewKind({ type }), kind, type);
});

test("HTML preview is sanitized and isolated while download keeps the original file", async (t) => {
	const requests = [];
	globalThis.attachmentFetch = async (url) => {
		requests.push(url);
		return new Response(`<style>body{color:red}</style><h1>Guide</h1><script>alert(1)</script>
			<img src="https://tracker.example/pixel" onerror="alert(1)"><form action="/change"><input></form>`);
	};
	const container = document.createElement("div");
	document.body.appendChild(container);
	const root = createRoot(container);
	t.after(async () => { await act(async () => root.unmount()); container.remove(); });
	await act(async () => {
		root.render(createElement(MessageAttachmentViewer, {
			open: true, messageId: "m1", onOpenChange() {},
			attachment: { id: "a1", filename: "guide.html", type: "text/html", size: 12 },
		}));
	});
	assert.deepEqual(requests, ["/api/messages/m1/attachments/a1?preview=1"]);
	const frame = container.querySelector("iframe");
	assert.ok(frame);
	assert.equal(frame.getAttribute("sandbox"), "");
	assert.match(frame.srcdoc, /default-src 'none'/);
	assert.match(frame.srcdoc, /<h1>Guide<\/h1>/);
	assert.match(frame.srcdoc, /color:red/);
	assert.doesNotMatch(frame.srcdoc, /<script|onerror|tracker\.example|<form|<input/i);
	const download = container.querySelector("a");
	assert.equal(download.getAttribute("href"), "/api/messages/m1/attachments/a1?download=1");
	assert.equal(download.getAttribute("download"), "guide.html");
});

test("empty text attachments finish loading and request errors are shown", async (t) => {
	const container = document.createElement("div");
	document.body.appendChild(container);
	const root = createRoot(container);
	t.after(async () => { await act(async () => root.unmount()); container.remove(); });
	globalThis.attachmentFetch = async () => new Response("");
	const props = { open: true, messageId: "m1", onOpenChange() {},
		attachment: { id: "a1", filename: "empty.txt", type: "text/plain", size: 0 } };
	await act(async () => root.render(createElement(MessageAttachmentViewer, props)));
	assert.equal(container.querySelector("pre")?.textContent, "");
	globalThis.attachmentFetch = async () => new Response("no", { status: 500 });
	await act(async () => root.render(createElement(MessageAttachmentViewer, {
		...props, attachment: { ...props.attachment, id: "a2" },
	})));
	assert.match(container.textContent, /attachment\.loadFailed/);
});
