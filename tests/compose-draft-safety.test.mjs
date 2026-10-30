import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import test, { after } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";
import { JSDOM } from "jsdom";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const directory = mkdtempSync(join(root, "node_modules", "compose-draft-safety-test-"));
after(() => rmSync(directory, { recursive: true, force: true }));
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://mail.example.test/" });
for (const key of ["window", "document", "HTMLElement", "HTMLInputElement", "Element", "Node", "Event", "FormData", "File", "localStorage", "navigator"]) {
	Object.defineProperty(globalThis, key, { value: key === "window" ? dom.window : dom.window[key], configurable: true, writable: true });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
await build({
	stdin: {
		contents: `
			export { ComposeForm } from "./src/components/compose/compose-form";
			export { ComposeProvider, useCompose } from "./src/components/compose/compose-context";
			export { FloatingComposer } from "./src/components/compose/floating-composer";
			export { installMailNavigationGuard, registerMailNavigationGuard, canLeaveMailEditor } from "./src/components/compose/mail-navigation-guard";
			export { formatAttachmentSize } from "./src/components/compose/utils";
		`,
		resolveDir: root,
		loader: "ts",
	},
	outfile: join(directory, "compose.mjs"),
	bundle: true,
	platform: "browser",
	format: "esm",
	external: ["react", "react-dom", "react-dom/*"],
	alias: { "@": join(root, "src") },
	plugins: [{
		name: "compose-test-dependencies",
		setup(builder) {
			const modules = {
				"next/navigation": 'export function useRouter() { return { push(path) { globalThis.composeRouterPush?.(path); }, replace() {} }; } export function usePathname() { return globalThis.composePath ?? "/inbox"; }',
				"@/lib/auth/client": 'export const AUTH_SESSION_CHANGED_EVENT = "compose-auth-changed"; export function authFetch(...args) { return globalThis.composeFetch(...args); }',
				"@/components/language-provider": 'export function useLanguage() { return { t: (key) => key }; }',
				"@/components/mailbox-provider": `import { useState } from "react"; export function useSelectedMailbox() {
					const mailboxes = globalThis.composeMailboxes ?? [{ id: "m1", localPart: "test", hostname: "example.test", senderAddresses: ["test@example.test"] }];
					const [selectedMailbox, setSelectedMailbox] = useState(mailboxes[0] ?? null);
					return { selectedMailbox, mailboxes, setSelectedMailbox };
				}`,
				"@/components/sidebar-state": 'export function useSidebar() { return { mobileOpen: false }; }',
				"@/components/sidebar-mobile-utils": "export function useIsMobile() { return false; }",
				"./rich-text-editor": `import React from "react"; export function RichTextEditor(props) {
					return React.createElement("div", null, React.createElement("textarea", { id: props.id, value: props.value, onChange: (event) => props.onChange(event.target.value) }), props.toolbarStart, props.toolbarEnd, props.footerContent);
				}`,
				"./recipient-input": `import React from "react"; export function RecipientInput(props) {
					return React.createElement("input", { id: props.id, value: props.value.join(","), onChange: (event) => props.onChange([event.target.value]) });
				}`,
				"./schedule-send-menu": "export function ScheduleSendMenu() { return null; }",
				"./attachment-upload": `export async function uploadLargeDraftAttachment(draftId, file, id, sessions, progress, active) {
					if (!active()) throw new Error("session changed");
					progress(100); return { id, filename: file.name, size: file.size, type: file.type, disposition: "attachment" };
				} export async function cancelLargeDraftAttachment() {}`,
				"@/components/follow-ups/follow-up-menu": "export function FollowUpMenu() { return null; }",
				"@/components/agent/send-review": "export function SendReview() { return null; }",
			};
			builder.onResolve({ filter: /.*/ }, ({ path }) => path in modules ? { path, namespace: "compose-test-stub" } : undefined);
			builder.onLoad({ filter: /.*/, namespace: "compose-test-stub" }, ({ path }) => ({ contents: modules[path], loader: "js" }));
		},
	}],
	logLevel: "silent",
});
const { createElement, act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { ComposeForm, ComposeProvider, FloatingComposer, useCompose, installMailNavigationGuard, registerMailNavigationGuard, canLeaveMailEditor, formatAttachmentSize } = await import(pathToFileURL(join(directory, "compose.mjs")).href);

async function fixture(t, fetchDraft, maxMb = 25, draftIdToLoad = null) {
	globalThis.composeFetch = async (url, init) => {
		if (url === "/api/attachment-policy") return Response.json({ maxMb, cloudThresholdBytes: 3_000_000 });
		return fetchDraft(url, init);
	};
	const container = document.createElement("div");
	document.body.appendChild(container);
	const releaseGuard = installMailNavigationGuard();
	const root = createRoot(container);
	let closed = 0;
	await act(async () => root.render(createElement(ComposeProvider, null, createElement(ComposeForm, { mode: "popup", draftIdToLoad, onClose: () => { closed++; } }))));
	t.after(async () => { await act(async () => root.unmount()); releaseGuard(); container.remove(); delete globalThis.composeMailboxes; });
	async function input(selector, value) {
		const element = container.querySelector(selector);
		assert.ok(element, selector);
		const prototype = element instanceof dom.window.HTMLTextAreaElement ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype;
		await act(async () => {
			Object.getOwnPropertyDescriptor(prototype, "value").set.call(element, value);
			element.dispatchEvent(new Event("input", { bubbles: true }));
		});
	}
	return {
		container,
		get closed() { return closed; },
		setSubject: (value) => input("#popup-subject", value),
		setRecipient: (value) => input("#popup-to", value),
		setBody: (value) => input("#popup-text", value),
		async close() {
			await act(async () => container.querySelector('[aria-label="compose.close"]').click());
		},
		async submit() {
			await act(async () => container.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
		},
		beforeUnload() {
			const event = new Event("beforeunload", { cancelable: true });
			window.dispatchEvent(event);
			return event.defaultPrevented;
		},
	};
}

test("loading a draft restores its sender and preserves a later explicit sender choice", async (t) => {
	globalThis.composeMailboxes = [{ id: "m1", localPart: "test", hostname: "example.test", senderAddresses: ["test@example.test", "alias@example.test"] }];
	let finish;
	const composer = await fixture(t, async (url, init) => {
		if (url === "/api/drafts/draft-1" && !init?.method) {
			await new Promise((resolve) => { finish = resolve; });
			return Response.json({ draft: {
				id: "draft-1", mailboxId: "m1", fromAddr: "alias@example.test", toAddr: "other@example.test",
				subject: "Saved draft", textBody: "Body", htmlBody: "", attachments: [],
			} });
		}
		return Response.json({ draft: { id: "draft-1" } });
	}, 25, "draft-1");
	const sender = composer.container.querySelector("#popup-from");
	assert.equal(sender.disabled, true);
	assert.equal(composer.beforeUnload(), true);
	await act(async () => { finish(); });
	assert.equal(sender.disabled, false);
	assert.equal(sender.value, "m1|alias@example.test");
	await act(async () => {
		sender.value = "m1|test@example.test";
		sender.dispatchEvent(new Event("change", { bubbles: true }));
	});
	assert.equal(sender.value, "m1|test@example.test");
	await composer.setSubject("Revised subject");
	assert.equal(sender.value, "m1|test@example.test");
});

test("closing waits for the current draft and blocks unload until it is saved", async (t) => {
	let finish;
	const requests = [];
	const composer = await fixture(t, async (url, init) => {
		requests.push({ url, body: JSON.parse(init.body) });
		await new Promise((resolve) => { finish = resolve; });
		return Response.json({ draft: { id: "d1" } });
	});
	await composer.setSubject("Draft subject");
	assert.equal(composer.beforeUnload(), true);
	await act(async () => { assert.equal(window.__smjMailNavigation.prepare(), false); });
	await composer.close();
	assert.equal(composer.closed, 0);
	assert.equal(requests[0].body.subject, "Draft subject");
	await act(async () => { finish(); });
	assert.equal(composer.closed, 1);
	assert.equal(composer.beforeUnload(), false);
	assert.equal(window.__smjMailNavigation.prepare(), true);
	assert.equal(document.documentElement.inert, true);
	window.__smjMailNavigation.release();
	assert.equal(document.documentElement.inert, false);
});

test("dropping a file outside the composer adds it once and protects the draft", async (t) => {
	const composer = await fixture(t, async (url) => {
		if (url.endsWith("/attachments")) return Response.json({ attachments: [{ id: "a1", filename: "example.txt", size: 3, disposition: "attachment" }] });
		return Response.json({ draft: { id: "d1" } });
	});
	const file = new File(["abc"], "example.txt", { type: "text/plain" });
	const dataTransfer = { types: ["Files"], files: [file], dropEffect: "none" };
	const dragover = new Event("dragover", { bubbles: true, cancelable: true });
	Object.defineProperty(dragover, "dataTransfer", { value: dataTransfer });
	await act(async () => document.body.dispatchEvent(dragover));
	assert.equal(dragover.defaultPrevented, true);
	assert.equal(dataTransfer.dropEffect, "copy");
	const drop = new Event("drop", { bubbles: true, cancelable: true });
	Object.defineProperty(drop, "dataTransfer", { value: dataTransfer });
	await act(async () => document.body.dispatchEvent(drop));
	assert.equal(drop.defaultPrevented, true);
	assert.equal(composer.container.textContent.match(/example\.txt/g)?.length, 1);
	assert.equal(composer.beforeUnload(), true);
});

test("the composer does not steal a file drop already handled by another surface", async (t) => {
	const composer = await fixture(t, async () => Response.json({ draft: { id: "d1" } }));
	const target = document.createElement("div");
	document.body.appendChild(target);
	t.after(() => target.remove());
	target.addEventListener("drop", (event) => event.preventDefault());
	const drop = new Event("drop", { bubbles: true, cancelable: true });
	Object.defineProperty(drop, "dataTransfer", { value: { types: ["Files"], files: [new File(["x"], "other.txt")] } });
	await act(async () => target.dispatchEvent(drop));
	assert.doesNotMatch(composer.container.textContent, /other\.txt/);
});

test("dropping directly on the composer adds one file, not two", async (t) => {
	const composer = await fixture(t, async (url) => {
		if (url.endsWith("/attachments")) return Response.json({ attachments: [{ id: "a1", filename: "direct.txt", size: 1, disposition: "attachment" }] });
		return Response.json({ draft: { id: "d1" } });
	});
	const drop = new Event("drop", { bubbles: true, cancelable: true });
	Object.defineProperty(drop, "dataTransfer", { value: { types: ["Files"], files: [new File(["x"], "direct.txt")] } });
	await act(async () => composer.container.querySelector("form").dispatchEvent(drop));
	assert.equal(drop.defaultPrevented, true);
	assert.equal(composer.container.textContent.match(/direct\.txt/g)?.length, 1);
});

test("the composer accepts exactly 500 MB and rejects one byte more", async (t) => {
	const composer = await fixture(t, async () => Response.json({ draft: { id: "d1" } }), 500);
	const file = new File(["x"], "maximum.bin");
	Object.defineProperty(file, "size", { value: 500_000_000 });
	const drop = new Event("drop", { bubbles: true, cancelable: true });
	Object.defineProperty(drop, "dataTransfer", { value: { types: ["Files"], files: [file] } });
	await act(async () => document.body.dispatchEvent(drop));
	assert.match(composer.container.textContent, /maximum\.bin/);
	const tooLarge = new File(["x"], "too-large.bin");
	Object.defineProperty(tooLarge, "size", { value: 500_000_001 });
	const rejected = new Event("drop", { bubbles: true, cancelable: true });
	Object.defineProperty(rejected, "dataTransfer", { value: { types: ["Files"], files: [tooLarge] } });
	await act(async () => document.body.dispatchEvent(rejected));
	assert.doesNotMatch(composer.container.textContent, /too-large\.bin/);
	assert.match(composer.container.textContent, /compose\.error\.attachmentSize/);
	assert.equal(formatAttachmentSize(500_000_000), "500.0 MB");
});

test("a message containing an attachment can be sent without body text", async (t) => {
	let sent = 0;
	const composer = await fixture(t, async (url) => {
		if (url === "/api/send") { sent++; return Response.json({ messageId: "sent-1" }); }
		if (url.startsWith("/api/drafts/") && !url.endsWith("/attachments")) return Response.json({ draft: { id: "d1" } });
		return Response.json({ draft: { id: "d1" } });
	});
	await composer.setRecipient("recipient@example.test");
	await composer.setSubject("File");
	const drop = new Event("drop", { bubbles: true, cancelable: true });
	Object.defineProperty(drop, "dataTransfer", { value: { types: ["Files"], files: [new File(["x"], "file.txt")] } });
	await act(async () => document.body.dispatchEvent(drop));
	await composer.submit();
	assert.equal(sent, 1);
});

test("the navigation bridge fails closed while any registered editor is dirty", () => {
	const uninstall = installMailNavigationGuard();
	const unregisterFirst = registerMailNavigationGuard(() => false);
	const unregisterSecond = registerMailNavigationGuard(() => true);
	try {
		assert.equal(window.__smjMailNavigation.prepare(), false);
		assert.notEqual(document.documentElement.inert, true);
		unregisterSecond();
		document.documentElement.inert = true;
		assert.equal(window.__smjMailNavigation.prepare(), true);
		assert.equal(window.__smjMailNavigation.prepare(), false);
		window.__smjMailNavigation.release();
		assert.equal(document.documentElement.inert, true, "restore a pre-existing inert state");
	} finally {
		document.documentElement.inert = false;
		unregisterFirst();
		unregisterSecond();
		uninstall();
	}
});

test("a failed save keeps the composer open and the draft can be retried", async (t) => {
	let calls = 0;
	const composer = await fixture(t, async () => {
		calls++;
		return calls === 1 ? Response.json({ error: "unavailable" }, { status: 503 }) : Response.json({ draft: { id: "d1" } });
	});
	const originalError = console.error;
	console.error = () => {};
	t.after(() => { console.error = originalError; });
	await composer.setSubject("Unsaved work");
	await composer.close();
	assert.equal(composer.closed, 0);
	assert.equal(composer.beforeUnload(), true);
	assert.equal(composer.container.querySelector('[role="alert"]')?.textContent, "compose.error.saveDraft");
	await composer.close();
	assert.equal(calls, 2);
	assert.equal(composer.closed, 1);
	assert.equal(composer.beforeUnload(), false);
});

test("sending immediately after composing includes the draft created during the save barrier", async (t) => {
	let sentDraft;
	const composer = await fixture(t, async (url, init) => {
		if (url === "/api/drafts") return Response.json({ draft: { id: "fresh-draft" } });
		if (url === "/api/send") {
			sentDraft = init.body.get("draftId");
			return Response.json({ messageId: "sent" });
		}
		if (url === "/api/drafts/fresh-draft" && init.method === "DELETE") return new Response(null, { status: 204 });
		assert.fail(`unexpected request: ${url}`);
	});
	await composer.setSubject("Subject");
	await composer.setRecipient("recipient@example.test");
	await composer.setBody("<p>Test body</p>");
	await composer.submit();
	assert.equal(sentDraft, "fresh-draft");
	assert.equal(composer.closed, 1);
});

test("the floating composer survives route changes after a failed save", async (t) => {
	globalThis.composePath = "/inbox";
	globalThis.composeFetch = async (url) => url === "/api/attachment-policy"
		? Response.json({ maxMb: 25, cloudThresholdBytes: 3_000_000 })
		: Response.json({ error: "unavailable" }, { status: 503 });
	const originalError = console.error;
	console.error = () => {};
	const container = document.createElement("div");
	document.body.appendChild(container);
	const releaseGuard = installMailNavigationGuard();
	const root = createRoot(container);
	t.after(async () => {
		await act(async () => root.unmount());
		releaseGuard();
		container.remove();
		console.error = originalError;
		delete globalThis.composePath;
	});
	function OpenButton() {
		const { openComposer, openPageComposer, setPageSlot } = useCompose();
		return createElement("div", null,
			createElement("button", { id: "open", onClick: openComposer }, "Compose"),
			createElement("button", { id: "open-page", onClick: openPageComposer }, "Compose page"),
			globalThis.composePath === "/compose" ? createElement("div", { id: "compose-page-slot", ref: setPageSlot }) : null,
		);
	}
	const render = () => createElement(ComposeProvider, null, createElement(OpenButton), createElement("main", null, globalThis.composePath), createElement(FloatingComposer));
	await act(async () => root.render(render()));
	await act(async () => container.querySelector("#open").click());
	const subject = document.querySelector("#popup-subject");
	assert.ok(subject);
	await act(async () => {
		Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value").set.call(subject, "Unsaved across routes");
		subject.dispatchEvent(new Event("input", { bubbles: true }));
	});
	const fileInput = document.querySelector('input[type="file"]');
	assert.ok(fileInput);
	await act(async () => {
		Object.defineProperty(fileInput, "files", { configurable: true, value: [new File(["synthetic"], "local-test.txt")] });
		fileInput.dispatchEvent(new Event("change", { bubbles: true }));
	});
	assert.match(document.body.textContent, /local-test\.txt/);
	await act(async () => document.querySelector('[aria-label="compose.close"]').click());
	await act(async () => { assert.equal(window.__smjMailNavigation.prepare(), false); });
	for (const route of ["/settings/account", "/drive", "/calendar", "/inbox"]) {
		globalThis.composePath = route;
		await act(async () => root.render(render()));
		assert.equal(document.querySelector("#popup-subject"), subject);
		assert.equal(subject.value, "Unsaved across routes");
		assert.match(document.body.textContent, /local-test\.txt/);
	}
	globalThis.composePath = "/compose";
	await act(async () => root.render(render()));
	await act(async () => container.querySelector("#open-page").click());
	assert.equal(document.querySelector("#page-subject"), subject);
	assert.ok(document.querySelector("#compose-page-slot").contains(subject));
	globalThis.composePath = "/settings/account";
	await act(async () => root.render(render()));
	assert.equal(document.querySelector("#popup-subject"), subject);
	assert.equal(subject.value, "Unsaved across routes");
	assert.match(document.body.textContent, /local-test\.txt/);
	assert.equal(canLeaveMailEditor(), false);
});

test("session changes freeze unsaved work instead of writing to another account", async (t) => {
	const requests = [];
	let finish;
	const originalError = console.error;
	console.error = () => {};
	t.after(() => { console.error = originalError; });
	const composer = await fixture(t, async (url, init) => {
		requests.push({ url, method: init.method });
		await new Promise((resolve) => { finish = resolve; });
		return Response.json({ draft: { id: "old-account-draft" } });
	});
	const originalConfirm = window.confirm;
	window.confirm = () => false;
	t.after(() => { window.confirm = originalConfirm; });
	await composer.setSubject("Keep this draft");
	await composer.close();
	assert.equal(requests.length, 1);
	await act(async () => window.dispatchEvent(new Event("compose-auth-changed")));
	await act(async () => { finish(); });
	assert.equal(requests.length, 1, "do not delete or save using the new session");
	assert.equal(composer.beforeUnload(), true);
	assert.equal(composer.container.querySelector("#popup-subject").value, "Keep this draft");
	await composer.submit();
	await composer.close();
	assert.equal(composer.closed, 0);
	assert.equal(requests.length, 1);
	window.confirm = () => true;
	await composer.close();
	assert.equal(composer.closed, 1);
});

test("sending from the full-page composer closes it and navigates to sent mail", async (t) => {
	globalThis.composePath = "/compose";
	const destinations = [];
	globalThis.composeRouterPush = (path) => destinations.push(path);
	globalThis.composeFetch = async (url, init) => {
		if (url === "/api/attachment-policy") return Response.json({ maxMb: 25, cloudThresholdBytes: 3_000_000 });
		if (url === "/api/drafts") return Response.json({ draft: { id: "page-draft" } });
		if (url === "/api/send") {
			assert.equal(init.body.get("draftId"), "page-draft");
			return Response.json({ messageId: "page-sent" });
		}
		if (url === "/api/drafts/page-draft" && init.method === "DELETE") return new Response(null, { status: 204 });
		assert.fail(`unexpected request: ${url}`);
	};
	const container = document.createElement("div");
	document.body.appendChild(container);
	const releaseGuard = installMailNavigationGuard();
	const root = createRoot(container);
	t.after(async () => {
		await act(async () => root.unmount());
		releaseGuard();
		container.remove();
		delete globalThis.composePath;
		delete globalThis.composeRouterPush;
	});
	function Page() {
		const { openPageComposer, setPageSlot } = useCompose();
		return createElement("div", null,
			createElement("button", { id: "open-page", onClick: openPageComposer }, "Compose page"),
			createElement("div", { id: "compose-page-slot", ref: setPageSlot }),
		);
	}
	await act(async () => root.render(createElement(ComposeProvider, null, createElement(Page), createElement(FloatingComposer))));
	await act(async () => container.querySelector("#open-page").click());
	const setInput = async (id, value) => {
		const input = document.querySelector(id);
		assert.ok(input, id);
		const prototype = input instanceof dom.window.HTMLTextAreaElement ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype;
		await act(async () => {
			Object.getOwnPropertyDescriptor(prototype, "value").set.call(input, value);
			input.dispatchEvent(new Event("input", { bubbles: true }));
		});
	};
	await setInput("#page-subject", "Page subject");
	await setInput("#page-to", "recipient@example.test");
	await setInput("#page-text", "<p>Body</p>");
	await act(async () => document.querySelector("#page-subject").closest("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
	assert.deepEqual(destinations, ["/sent"]);
	assert.equal(document.querySelector("#page-subject"), null);
});

test("a session change during a send does not delete a draft under the new account", async (t) => {
	const requests = [];
	let finishSend;
	const composer = await fixture(t, async (url, init) => {
		requests.push({ url, method: init.method });
		if (url === "/api/drafts") return Response.json({ draft: { id: "sending-draft" } });
		if (url === "/api/send") {
			await new Promise((resolve) => { finishSend = resolve; });
			return Response.json({ messageId: "sent" });
		}
		assert.fail(`unexpected request: ${url}`);
	});
	await composer.setSubject("Keep while sending");
	await composer.setRecipient("recipient@example.test");
	await composer.setBody("<p>Test body</p>");
	await composer.submit();
	assert.equal(typeof finishSend, "function");
	await act(async () => window.dispatchEvent(new Event("compose-auth-changed")));
	await act(async () => { finishSend(); });
	assert.equal(composer.closed, 0);
	assert.equal(composer.container.querySelector("#popup-subject").value, "Keep while sending");
	assert.equal(requests.some((request) => request.method === "DELETE"), false);
});
