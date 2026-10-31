import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import test, { after } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";
import { JSDOM } from "jsdom";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const directory = mkdtempSync(join(root, "node_modules", "shared-attachment-reader-test-"));
after(() => rmSync(directory, { recursive: true, force: true }));
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://mail.example.test/inbox" });
for (const key of ["window", "document", "HTMLElement", "HTMLAnchorElement", "Element", "Node", "Event", "MouseEvent", "navigator", "location", "MutationObserver"]) {
	Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true, writable: true });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

await build({
	stdin: {
		contents: `export { EmailHtmlRenderer } from "./src/components/messages/email-html-renderer";
			export { prepareSharedAttachmentLinks } from "./src/components/messages/shared-attachment-links";`,
		resolveDir: root,
		loader: "ts",
	},
	outfile: join(directory, "reader.mjs"),
	bundle: true,
	platform: "browser",
	format: "esm",
	external: ["react", "react-dom", "react-dom/*"],
	alias: { "@": join(root, "src") },
	plugins: [{
		name: "reader-language",
		setup(builder) {
			builder.onResolve({ filter: /^@\/components\/language-provider$/ }, ({ path }) => ({ path, namespace: "reader-test" }));
			builder.onLoad({ filter: /.*/, namespace: "reader-test" }, () => ({
				contents: `const messages = { "attachment.download": "下载", "attachment.loadFailed": "无法加载此附件",
					"compose.attachmentDeliveryNotice": "下载链接在 30 天后失效", "message.quote.toggle": "引用" };
					const t = key => messages[key] || key;
					export function useLanguage() { return { t }; }`,
				loader: "js",
			}));
		},
	}],
	logLevel: "silent",
});

const { createElement, act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { EmailHtmlRenderer, prepareSharedAttachmentLinks } = await import(pathToFileURL(join(directory, "reader.mjs")).href);
const url = "https://mail.example.test/api/shared-files/share_abcdefghijklmnopqrstu";
const intro = "Attachments (download links expire after 30 days):";

test("the download-link notice is translated in each shipped catalog", () => {
	const english = JSON.parse(readFileSync(join(root, "src", "lib", "i18n", "en.json"), "utf8"))["compose.attachmentDeliveryNotice"];
	for (const file of readdirSync(join(root, "public", "locales")).filter((name) => name.endsWith(".json"))) {
		const catalog = JSON.parse(readFileSync(join(root, "public", "locales", file), "utf8"));
		assert.ok(catalog["compose.attachmentDeliveryNotice"], file);
		assert.notEqual(catalog["compose.attachmentDeliveryNotice"], english, file);
	}
});

test("only recognizes this site's own legacy and new shared-file links", () => {
	const template = document.createElement("template");
	template.innerHTML = `<div><p>${intro}</p><ul>
		<li><a href="${url}" target="_blank">Download file</a></li>
		<li><a href="${url}">↓</a></li>
		<li><a href="https://other.example/api/shared-files/share_abcdefghijklmnopqrstu" target="_blank">Download file</a></li>
		<li><a href="${url}?extra=1" target="_blank">Download file</a></li>
		<li><a href="${url}" target="_blank">A normal link</a></li>
	</ul></div>`;
	const links = prepareSharedAttachmentLinks(template.content, window.location.origin, { download: "下载", intro: "链接有效期 30 天" });
	const anchors = template.content.querySelectorAll("a");
	assert.equal(links.size, 2);
	for (const anchor of [...anchors].slice(0, 2)) {
		assert.ok(anchor.querySelector("svg"));
		assert.equal(anchor.getAttribute("aria-label"), "下载");
		assert.equal(anchor.getAttribute("download"), "");
		assert.equal(anchor.hasAttribute("target"), false);
		assert.doesNotMatch(anchor.textContent, /Download file/);
	}
	assert.equal(template.content.querySelector("p").textContent, "链接有效期 30 天");
	for (const anchor of [...anchors].slice(2)) assert.equal(anchor.getAttribute("target"), "_blank");
});

test("rendered old mail checks the link and starts a same-window native download; expired links show an error", async (t) => {
	const container = document.createElement("div");
	document.body.appendChild(container);
	const root = createRoot(container);
	const calls = [];
	const originalFetch = globalThis.fetch;
	const originalClick = dom.window.HTMLAnchorElement.prototype.click;
	globalThis.fetch = async (input, options) => {
		calls.push([input, options]);
		return new Response(null, { status: calls.length === 1 ? 200 : 404 });
	};
	const started = [];
	dom.window.HTMLAnchorElement.prototype.click = function () {
		started.push({ href: this.href, download: this.getAttribute("download"), target: this.getAttribute("target"), rel: this.rel });
	};
	t.after(async () => {
		await act(async () => root.unmount());
		globalThis.fetch = originalFetch;
		dom.window.HTMLAnchorElement.prototype.click = originalClick;
		container.remove();
	});
	await act(async () => root.render(createElement(EmailHtmlRenderer, {
		html: `<div><p>${intro}</p><ul><li>file.pdf: <a href="${url}">Download file</a></li></ul></div>`,
	})));
	const shadow = container.querySelector("div").querySelector("div").shadowRoot;
	const link = shadow.querySelector("a");
	assert.ok(link.querySelector("svg"));
	assert.equal(shadow.querySelector("p").textContent, "下载链接在 30 天后失效");
	await act(async () => link.querySelector("svg").dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })));
	assert.equal(calls[0][0], url);
	assert.deepEqual(calls[0][1], { method: "HEAD", cache: "no-store", redirect: "error", referrerPolicy: "no-referrer" });
	assert.deepEqual(started, [{ href: url, download: "", target: null, rel: "noreferrer" }]);
	const error = console.error;
	console.error = () => {};
	try {
		await act(async () => link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })));
	} finally {
		console.error = error;
	}
	assert.equal(started.length, 1);
	assert.equal(container.querySelector('[role="alert"]').textContent, "无法加载此附件");
});
