import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import test, { after } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const directory = mkdtempSync(join(root, "node_modules", "compose-draft-queue-test-"));
after(() => rmSync(directory, { recursive: true, force: true }));
await build({
	entryPoints: [join(root, "src/components/compose/draft-save-queue.ts")],
	outfile: join(directory, "queue.mjs"),
	bundle: true,
	platform: "node",
	format: "esm",
	logLevel: "silent",
});
const { DraftSaveQueue } = await import(pathToFileURL(join(directory, "queue.mjs")).href);

test("flush saves the latest pending revision and keeps saves serialized", async () => {
	const queue = new DraftSaveQueue(assert.fail);
	const writes = [];
	let finish;
	queue.schedule(async () => { writes.push("first"); await new Promise((resolve) => { finish = resolve; }); });
	const flushing = queue.flush();
	queue.schedule(async () => { writes.push("obsolete"); });
	queue.schedule(async () => { writes.push("latest"); });
	const secondFlush = queue.flush();
	assert.deepEqual(writes, ["first"]);
	assert.equal(queue.hasPending, true);
	finish();
	await Promise.all([flushing, secondFlush]);
	assert.deepEqual(writes, ["first", "latest"]);
	assert.equal(queue.hasPending, false);
});

test("a failed save remains pending and can be retried", async () => {
	const queue = new DraftSaveQueue(assert.fail);
	let attempts = 0;
	queue.schedule(async () => {
		attempts++;
		if (attempts === 1) throw new Error("offline");
	});
	await assert.rejects(queue.flush(), /offline/);
	assert.equal(queue.hasPending, true);
	await queue.flush();
	assert.equal(attempts, 2);
	assert.equal(queue.hasPending, false);
});

test("scheduled errors are reported and discarded saves do not execute", async () => {
	const reports = [];
	const queue = new DraftSaveQueue((error) => reports.push(error));
	queue.schedule(async () => { throw new Error("failed"); }, 0);
	await new Promise((resolve) => setTimeout(resolve, 20));
	assert.equal(reports.length, 1);
	assert.equal(queue.hasPending, true);
	queue.discardPending();
	await queue.flush();
	assert.equal(queue.hasPending, false);
});
