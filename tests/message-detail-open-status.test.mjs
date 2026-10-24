import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const detail = readFileSync(join(root, "src/app/(dashboard)/inbox/[messageId]/page.tsx"), "utf8");
const sent = readFileSync(join(root, "src/app/(dashboard)/sent/[messageId]/page.tsx"), "utf8");

test("the current outbound message requests its open status above the body", () => {
	assert.match(detail, /import \{ MessageOpenStatus \} from "@\/components\/messages\/message-open-status";/);
	const status = detail.indexOf('message.direction === "outbound" && <MessageOpenStatus messageId={message.id} />');
	const body = detail.indexOf("<EmailHtmlRenderer");
	assert.ok(status >= 0, "the current message must render MessageOpenStatus, not only other thread cards");
	assert.ok(status < body, "the status belongs above the current message body");
});

test("the sent-message route uses the same detail page", () => {
	assert.match(sent, /import Page from "@\/app\/\(dashboard\)\/inbox\/\[messageId\]\/page"/);
	assert.match(sent, /export default Page;/);
});
