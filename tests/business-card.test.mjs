import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import test, { after } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const directory = mkdtempSync(join(root, "node_modules", "mailflare-card-test-"));
after(() => rmSync(directory, { recursive: true, force: true }));
await build({
	stdin: {
		contents: `
			export { SqliteDatabase } from "./server/runtime/sqlite-database.ts";
			export { applyMigrations } from "./server/runtime/migrate.ts";
			export * from "./src/lib/business-card/card-utils.ts";
			export * from "./src/lib/business-card/service.ts";
		`,
		resolveDir: root,
		sourcefile: "business-card-test-entry.ts",
	},
	outfile: join(directory, "entry.mjs"),
	bundle: true,
	platform: "node",
	format: "esm",
	target: "node22",
	tsconfig: join(root, "tsconfig.json"),
	packages: "external",
	logLevel: "silent",
});
const card = await import(pathToFileURL(join(directory, "entry.mjs")).href);

const ORIGIN = "https://mail.one.test";

async function fixture(t) {
	const database = new SqliteDatabase(":memory:");
	t.after(() => database.db.close());
	await card.applyMigrations(database, join(root, "drizzle/migrations"));
	const run = (sql, ...args) => database.db.prepare(sql).run(...args);
	run("INSERT INTO users (id, email, password_hash, name, role, created_at) VALUES ('u1', 'gaozq@smjtools.com', 'x', '高增强', 'user', 1)");
	run("INSERT INTO domains (id, user_id, hostname, zone_id, created_at) VALUES ('d1', 'u1', 'smjtools.com', 'z', 1)");
	run("INSERT INTO mailboxes (id, user_id, domain_id, local_part, type, created_at) VALUES ('m1', 'u1', 'd1', 'gaozq', 'personal', 1)");
	run("INSERT INTO mailboxes (id, user_id, domain_id, local_part, type, signature, created_at) VALUES ('m2', 'u1', 'd1', 'sales', 'personal', '旧签名', 2)");
	run("INSERT INTO mailboxes (id, user_id, domain_id, local_part, type, created_at) VALUES ('m3', 'u1', 'd1', 'group', 'shared', 3)");
	return { env: { DB: database }, database };
}
const { SqliteDatabase } = card;

const fields = {
	title: "销售经理", department: "市场营销部", nameEn: "Gao Zengqiang", titleEn: "Sales Manager",
	mobile: "13347880755", phone: "0311-8888 8888", placement: "field", published: true,
};

test("card input is trimmed and validated", () => {
	assert.deepEqual(card.parseBusinessCardInput({ ...fields, title: "  销售   经理 " }).fields.title, "销售 经理");
	assert.match(card.parseBusinessCardInput({ mobile: "call me" }).error, /mobile/);
	assert.match(card.parseBusinessCardInput({ placement: "moon" }).error, /placement/);
	assert.match(card.parseBusinessCardInput({ title: "x".repeat(41) }).error, /too long/);
	assert.equal(card.parseBusinessCardInput({ phone: "0311-88888888 转 123" }).fields.phone, "0311-88888888 转 123");
});

test("phones format like the BIS letterhead and dial cleanly", () => {
	assert.equal(card.formatCardPhone("13347880755"), "133-4788-0755");
	assert.equal(card.formatCardPhone("+86 133 4788 0755"), "+86 133-4788-0755");
	assert.equal(card.formatCardPhone("0311-88888888"), "0311-88888888");
	assert.equal(card.cardTelHref("0311-8888 8888 转 123"), "tel:031188888888,123");
});

test("Chinese names split into surname and given name for the vCard", () => {
	assert.deepEqual(card.splitPersonName("高增强"), { family: "高", given: "增强" });
	assert.deepEqual(card.splitPersonName("欧阳明月"), { family: "欧阳", given: "明月" });
	assert.deepEqual(card.splitPersonName("Ada Lovelace"), { family: "Lovelace", given: "Ada" });
});

test("the vCard carries one mobile, the desk phone, company and folded UTF-8 lines", () => {
	const vcf = card.buildBusinessCardVcf({ name: "高增强", email: "gaozq@smjtools.com", ...fields, department: "市场营销部;华北区" }, `${ORIGIN}/card/abc`, new Date("2026-10-19T10:00:00Z"));
	assert.ok(vcf.startsWith("BEGIN:VCARD\r\nVERSION:3.0\r\n"));
	assert.ok(vcf.endsWith("END:VCARD\r\n"));
	assert.match(vcf, /\r\nN:高;增强;;;\r\n/);
	assert.match(vcf, /\r\nTEL;TYPE=CELL,VOICE:13347880755\r\n/);
	assert.match(vcf, /\r\nTEL;TYPE=WORK,VOICE:0311-8888 8888\r\n/);
	assert.match(vcf, /\r\nORG:江苏斯米伽石油装备有限公司;市场营销部\\\;华北区\r\n/);
	assert.match(vcf, /\r\nURL;TYPE=WORK:https:\/\/www\.smjtools\.com\r\n/);
	assert.match(vcf, /\r\nREV:2026-10-19T10:00:00Z\r\n/);
	for (const line of vcf.split("\r\n")) assert.ok(Buffer.byteLength(line) <= 75, line);
	assert.equal(vcf.match(/TYPE=CELL/g).length, 1);
});

test("the signature follows BIS C3 and only points at our origin and the company site", () => {
	const html = card.buildBusinessCardSignatureHtml({ name: "高增强", email: "gaozq@smjtools.com", ...fields, title: "<b>经理</b>" }, ORIGIN, `${ORIGIN}/card/abc`);
	assert.match(html, /border-left:2px solid #FA8C1F/);
	assert.match(html, /src="https:\/\/mail\.one\.test\/brand\/smj-symbol-email@2x\.png" width="36" height="41"/);
	assert.match(html, /高增强 · &lt;b&gt;经理&lt;\/b&gt;/);
	assert.match(html, /M 133-4788-0755/);
	assert.match(html, /Built for impact<span style="color:#FA8C1F">\.<\/span>/);
	const hosts = new Set([...html.matchAll(/(?:href|src)="(https?:[^"]+)"/g)].map((match) => new URL(match[1]).host));
	assert.deepEqual([...hosts].sort(), ["mail.one.test", "www.smjtools.com"]);
	const hq = card.buildBusinessCardSignatureHtml({ name: "A", email: "a@smjtools.com", ...fields, placement: "hq", published: false }, ORIGIN, `${ORIGIN}/card/abc`);
	assert.match(hq, /border-left:2px solid #034FBC/);
	assert.doesNotMatch(hq, /电子名片/);
});

test("cards are created on first use, saved, published and found by token", async (t) => {
	const { env } = await fixture(t);
	const first = await card.loadBusinessCard(env, "u1");
	assert.equal(first.card.name, "高增强");
	assert.equal(first.card.placement, "hq");
	assert.equal(first.token.length, 21);
	assert.equal((await card.loadBusinessCard(env, "u1")).token, first.token);
	assert.equal(await card.loadBusinessCard(env, "nobody"), null);

	await card.saveBusinessCard(env, "u1", fields, ORIGIN);
	const pub = await card.getPublicBusinessCard(env, first.token, ORIGIN);
	assert.equal(pub.title, "销售经理");
	assert.equal(pub.pageUrl, `${ORIGIN}/card/${first.token}`);
	assert.match(pub.qrSvg, /^<svg/);
	assert.equal("published" in pub, false);

	await card.saveBusinessCard(env, "u1", { ...fields, published: false }, ORIGIN);
	assert.equal(await card.findPublicBusinessCard(env, first.token), null);
	await card.saveBusinessCard(env, "u1", fields, ORIGIN);
	env.DB.db.prepare("UPDATE users SET disabled = 1 WHERE id = 'u1'").run();
	assert.equal(await card.findPublicBusinessCard(env, first.token), null);
});

test("the card signature goes on own personal mailboxes and follows card edits", async (t) => {
	const { env, database } = await fixture(t);
	const signatureOf = (id) => database.db.prepare("SELECT signature FROM mailboxes WHERE id = ?").get(id).signature;
	await card.saveBusinessCard(env, "u1", fields, ORIGIN);
	let settings = await card.getBusinessCardSettings(env, "u1", ORIGIN);
	assert.deepEqual(settings.mailboxes.map((mailbox) => mailbox.address), ["gaozq@smjtools.com", "sales@smjtools.com"]);
	assert.equal(settings.mailboxes[1].hasOtherSignature, true);

	await card.setBusinessCardSignature(env, "u1", true, ["m1"], ORIGIN);
	settings = await card.getBusinessCardSettings(env, "u1", ORIGIN);
	assert.equal(signatureOf("m1"), settings.signatureHtml);
	assert.equal(signatureOf("m2"), "旧签名");
	assert.equal(settings.mailboxes[0].usesCardSignature, true);

	await card.saveBusinessCard(env, "u1", { ...fields, title: "销售总监" }, ORIGIN);
	assert.match(signatureOf("m1"), /销售总监/);
	assert.equal(signatureOf("m2"), "旧签名");

	const { token } = await card.loadBusinessCard(env, "u1");
	const reset = await card.resetBusinessCardToken(env, "u1", ORIGIN);
	assert.notEqual(reset.token, token);
	assert.match(signatureOf("m1"), new RegExp(`/card/${reset.token}`));
	assert.equal(await card.findPublicBusinessCard(env, token), null);

	await card.setBusinessCardSignature(env, "u1", false, [], ORIGIN);
	assert.equal(signatureOf("m1"), null);
	assert.equal(signatureOf("m2"), "旧签名");
	assert.equal(signatureOf("m3"), null);
});
