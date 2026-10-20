import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import test, { after } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const bundleDirectory = mkdtempSync(join(root, "node_modules", "mailflare-agent-tasks-"));
await build({
	stdin: {
		contents: `
			export { SqliteDatabase } from "./server/runtime/sqlite-database.ts";
			export { applyMigrations } from "./server/runtime/migrate.ts";
			export { createAgentChatStream, listAgentConversations, renameAgentConversation, clearAgentConversation, getAgentChatHistory } from "./src/lib/agent/chat.ts";
			export { runEmailTool } from "./src/lib/agent/tools.ts";
			export { runTaskTool, taskToolSchemas } from "./src/lib/agent/task-tools.ts";
			export { confirmAgentAction } from "./src/lib/agent/actions.ts";
			export * from "./src/lib/agent/task-tools-utils.ts";
			export { agentSystemPrompt } from "./src/lib/agent/model.ts";
			export { buildAgentMeetingIcs } from "./src/components/agent/meeting-ics.ts";
			export { groupAgentConversations, filterAgentConversations, agentActionProposal, normalizeAgentHistory, removeAgentStepText } from "./src/components/agent/utils.ts";
			export { agentQuickTasks, agentQuickTaskTitle } from "./src/components/agent/quick-tasks.ts";
		`,
		resolveDir: root,
		sourcefile: "agent-tasks-test-entry.ts",
	},
	outfile: join(bundleDirectory, "entry.mjs"),
	bundle: true,
	platform: "node",
	format: "esm",
	target: "node22",
	tsconfig: join(root, "tsconfig.json"),
	packages: "external",
	alias: { "next/headers": "next/headers.js", "next/server": "next/server.js", "cloudflare:workers": "./server/runtime/cloudflare-workers.ts" },
	logLevel: "silent",
});
const mod = await import(pathToFileURL(join(bundleDirectory, "entry.mjs")).href);
after(() => rmSync(bundleDirectory, { recursive: true, force: true }));

/** A Workers AI binding stand-in: `reply(messages)` answers each chat step; `toMarkdown` converts documents. */
function fakeAi(reply) {
	const calls = [];
	return {
		calls,
		run: async (model, input) => {
			calls.push({ model, input });
			const answer = reply(input.messages);
			return { choices: [{ message: { role: "assistant", content: answer.text ?? null, ...(answer.reasoning ? { reasoning_content: answer.reasoning } : {}), ...(answer.tool ? { tool_calls: [{ id: `call-${calls.length}`, type: "function", function: { name: answer.tool, arguments: JSON.stringify(answer.args) } }] } : {}) }, finish_reason: answer.tool ? "tool_calls" : "stop" }] };
		},
		toMarkdown: async (file) => ({ id: "md-1", name: file.name, mimeType: file.blob.type, format: "markdown", tokens: 10, data: `# ${file.name}\n\n报价单：总价 12 万元，有效期 30 天。` }),
	};
}

async function setup(t, extraEnv = {}) {
	const database = new mod.SqliteDatabase(":memory:");
	t.after(() => database.db.close());
	await mod.applyMigrations(database, join(root, "drizzle", "migrations"));
	database.db.exec(`
		INSERT INTO users (id, email, password_hash, name, created_at) VALUES
			('user-1', 'liss@smjtools.com', 'hash', '李尚松', 1),
			('user-2', 'shily@smjtools.com', 'hash', '时丽燕', 1),
			('user-3', 'gone@smjtools.com', 'hash', '已停用', 1);
		UPDATE users SET disabled = 1 WHERE id = 'user-3';
		INSERT INTO domains (id, user_id, hostname, zone_id, status, created_at) VALUES ('domain-1', 'user-1', 'smjtools.com', 'zone-1', 'active', 1);
		INSERT INTO mailboxes (id, user_id, domain_id, local_part, created_at) VALUES
			('mailbox-1', 'user-1', 'domain-1', 'liss', 1),
			('mailbox-2', 'user-2', 'domain-1', 'shily', 1);
		INSERT INTO messages (id, user_id, mailbox_id, direction, from_addr, to_addr, subject, text_body, status, thread_id, created_at) VALUES
			('email-1', 'user-1', 'mailbox-1', 'inbound', '张中岩 <zhangzy@smjtools.com>', 'liss@smjtools.com', '设备报价确认', '请在周五前确认附件里的设备报价，下周二上午十点开会讨论。', 'received', 'thread-1', ${Date.now() - 86_400_000}),
			('email-2', 'user-1', 'mailbox-1', 'inbound', 'customer@example.net', 'liss@smjtools.com', 'Weekly update', 'Nothing urgent this week.', 'received', 'thread-2', ${Date.now() - 2 * 86_400_000}),
			('email-other', 'user-2', 'mailbox-2', 'inbound', 'someone@example.net', 'shily@smjtools.com', '私人邮件', '不应被读到', 'received', 'thread-3', 1);
		INSERT INTO message_attachments (id, message_id, filename, content_type, size, r2_key, created_at) VALUES
			('att-text', 'email-1', '说明.txt', 'text/plain', 12, 'r2/att-text', 1),
			('att-pdf', 'email-1', '报价单.pdf', 'application/pdf', 2048, 'r2/att-pdf', 1),
			('att-image', 'email-1', '照片.jpg', 'image/jpeg', 2048, 'r2/att-image', 1);
	`);
	const objects = new Map([["r2/att-text", new TextEncoder().encode("交货期 45 天")], ["r2/att-pdf", new Uint8Array([37, 80, 68, 70])], ["r2/att-image", new Uint8Array([255, 216])]]);
	const bucket = { get: async (key) => objects.has(key) ? { arrayBuffer: async () => objects.get(key).buffer.slice(0) } : null, delete: async () => {} };
	const env = { DB: database, BUCKET: bucket, ...extraEnv };
	const user = { id: "user-1", email: "liss@smjtools.com", name: "李尚松", role: "user" };
	return { database, env, user, context: { env, user, mailboxId: "mailbox-1", origin: "chat", timeZone: "Asia/Shanghai" } };
}

test("pure helpers: search operators, reply language, conversation titles, attachment kinds and GB18030 text", () => {
	assert.equal(mod.buildAgentSearchQuery({ from: "张中岩", after: "2026-10-01", hasAttachment: true, query: "报价" }), "from:张中岩 after:2026-10-01 has:attachment 报价");
	assert.equal(mod.buildAgentSearchQuery({ subject: "weekly update", unread: true }), 'subject:"weekly update" is:unread');
	assert.equal(mod.buildAgentSearchQuery({}), "");
	assert.match(mod.agentReplyLanguage("zh-CN"), /Simplified Chinese/);
	assert.match(mod.agentReplyLanguage(undefined), /Simplified Chinese/);
	assert.equal(mod.agentReplyLanguage("en"), "English");
	assert.equal(mod.agentConversationTitle("Read the thread containing email msg_2753e12afc09 and draft a reply."), "Read the thread containing email and draft a reply.");
	assert.equal(mod.agentConversationTitle("总结这封邮件", "总结这封邮件：测试"), "总结这封邮件：测试");
	assert.equal(mod.agentConversationTitle("   \n  "), "新对话");
	assert.equal(mod.attachmentReadKind("报价单.pdf", "application/octet-stream"), "document");
	assert.equal(mod.attachmentReadKind("a.csv", ""), "text");
	assert.equal(mod.attachmentReadKind("x.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"), "document");
	assert.equal(mod.attachmentReadKind("photo.jpg", "image/jpeg"), "unsupported");
	// "你好" in GB18030.
	assert.equal(mod.decodeAttachmentText(new Uint8Array([0xc4, 0xe3, 0xba, 0xc3]).buffer), "你好");
	assert.equal(mod.decodeAttachmentText(new TextEncoder().encode("﻿中文").buffer), "中文");
});

test("the system prompt requires answers in the interface language and keeps sending with the user", () => {
	const prompt = mod.agentSystemPrompt("", "Asia/Shanghai", mod.agentReplyLanguage("zh-CN"));
	assert.match(prompt, /Always answer the user in Simplified Chinese/);
	assert.match(prompt, /suggest_todos/);
	assert.match(prompt, /propose_meeting/);
	assert.match(prompt, /cannot send or schedule email, add to-dos or schedule meetings yourself/);
	assert.match(prompt, /never show internal IDs/);
});

test("search_emails takes sender, date, attachment and Chinese keyword conditions, inside the mailbox only", async (t) => {
	const { context } = await setup(t);
	const found = await mod.runEmailTool(context, "search_emails", { from: "zhangzy", query: "报价", limit: 10 });
	assert.deepEqual(found.emails.map((email) => email.id), ["email-1"]);
	const english = await mod.runEmailTool(context, "search_emails", { subject: "weekly", limit: 10 });
	assert.deepEqual(english.emails.map((email) => email.id), ["email-2"]);
	const none = await mod.runEmailTool(context, "search_emails", { query: "不应被读到", limit: 10 });
	assert.deepEqual(none.emails, []);
	await assert.rejects(mod.runEmailTool(context, "search_emails", { limit: 10 }), /at least one search condition/);
});

test("suggested to-dos are a proposal until confirmed, then land in im_todos with the picked items and their mail", async (t) => {
	const { database, env, user, context } = await setup(t);
	const proposal = await mod.runTaskTool(context, "suggest_todos", { items: [
		{ title: "确认设备报价", dueAt: "2026-10-23T18:00:00+08:00", sourceEmailId: "email-1" },
		{ title: "准备周二会议材料", notes: "张中岩邀请", sourceEmailId: "email-other" },
		{ title: "回复客户周报" },
	] });
	assert.equal(proposal.status, "pending_approval");
	assert.equal(proposal.action, "create_todos");
	assert.equal(proposal.items[0].sourceSubject, "设备报价确认");
	// A mail from another mailbox is dropped from the item, not leaked.
	assert.equal(proposal.items[1].sourceEmailId, null);
	assert.equal(database.db.prepare("SELECT count(*) AS count FROM im_todos").get().count, 0);

	database.db.exec("INSERT INTO agent_conversations (id, user_id, mailbox_id, title, created_at, updated_at) VALUES ('conv-1', 'user-1', 'mailbox-1', '提取待办', 1, 1)");
	database.db.prepare("INSERT INTO agent_chat_messages (id, conversation_id, role, tool_name, content, created_at) VALUES ('tool-1', 'conv-1', 'tool', 'suggest_todos', ?, 1)").run(JSON.stringify(proposal));
	const confirmed = await mod.confirmAgentAction(env, user, "tool-1", { selected: [0, 2] });
	assert.equal(confirmed.status, "approved");
	assert.equal(confirmed.result.todos.length, 2);
	const rows = database.db.prepare("SELECT title, due_at, source_type, source_id FROM im_todos WHERE user_id = 'user-1' ORDER BY title").all();
	assert.deepEqual(rows.map((row) => row.title), ["回复客户周报", "确认设备报价"]);
	const mailTodo = rows.find((row) => row.title === "确认设备报价");
	assert.equal(mailTodo.source_type, "mail");
	assert.equal(mailTodo.source_id, "email-1");
	assert.equal(mailTodo.due_at, Date.parse("2026-10-23T18:00:00+08:00"));
	await assert.rejects(mod.confirmAgentAction(env, user, "tool-1"), /已处理或已失效/);
	// Someone else cannot confirm the proposal.
	await assert.rejects(mod.confirmAgentAction(env, { ...user, id: "user-2" }, "tool-1"), /操作不存在/);
});

test("a proposed meeting resolves company accounts, lists outside addresses and builds an .ics without sending", async (t) => {
	const { context } = await setup(t);
	const start = new Date(Date.now() + 3 * 86_400_000).toISOString();
	const proposal = await mod.runTaskTool(context, "propose_meeting", { title: "设备报价讨论", startsAt: start, durationMinutes: 45, attendees: ["SHILY@smjtools.com", "liss@smjtools.com", "gone@smjtools.com", "customer@example.net"], sourceEmailId: "email-1" });
	assert.equal(proposal.status, "pending_approval");
	assert.equal(proposal.action, "schedule_meeting");
	assert.deepEqual(proposal.invitees.map((person) => person.id), ["user-2"]);
	assert.deepEqual(proposal.external, ["gone@smjtools.com", "customer@example.net"]);
	await assert.rejects(mod.runTaskTool(context, "propose_meeting", { title: "过去的会", startsAt: "2020-01-01T10:00:00+08:00", attendees: [] }), /in the past/);
	const ics = mod.buildAgentMeetingIcs(proposal, "tool-1", Date.UTC(2026, 9, 20));
	const unfolded = ics.replace(/\r\n /g, "");
	assert.match(ics, /METHOD:PUBLISH/);
	assert.match(ics, /SUMMARY:设备报价讨论/);
	assert.match(ics, /ATTENDEE;CN="时丽燕";ROLE=REQ-PARTICIPANT:mailto:shily@smjtools.com/);
	assert.match(unfolded, /mailto:customer@example.net/);
	assert.ok(ics.split("\r\n").every((line) => new TextEncoder().encode(line).length <= 75));
	assert.ok(ics.endsWith("\r\n"));
	assert.equal(mod.buildAgentMeetingIcs({ ...proposal, startsAt: "nope" }, "x"), null);
});

test("attachments: text is decoded, PDF goes through Workers AI toMarkdown, images are refused, other mailboxes are not found", async (t) => {
	const ai = fakeAi(() => ({ text: "" }));
	const { context } = await setup(t, { AI: ai });
	const text = await mod.runTaskTool(context, "read_attachment", { emailId: "email-1", attachmentId: "att-text" });
	assert.equal(text.readable, true);
	assert.equal(text.text, "交货期 45 天");
	const pdf = await mod.runTaskTool(context, "read_attachment", { emailId: "email-1", attachmentId: "att-pdf" });
	assert.equal(pdf.readable, true);
	assert.match(pdf.text, /总价 12 万元/);
	const image = await mod.runTaskTool(context, "read_attachment", { emailId: "email-1", attachmentId: "att-image" });
	assert.equal(image.readable, false);
	await assert.rejects(mod.runTaskTool(context, "read_attachment", { emailId: "email-other", attachmentId: "att-text" }), /not found/i);
	const noAi = await mod.runTaskTool({ ...context, env: { ...context.env, AI: undefined } }, "read_attachment", { emailId: "email-1", attachmentId: "att-pdf" });
	assert.equal(noAi.readable, false);
});

test("chat with a fake Workers AI: Chinese system prompt, quick-task title, proposal stored for the card, rename and clear", async (t) => {
	const ai = fakeAi((messages) => messages.some((message) => message.role === "tool")
		? { text: "我找到两项需要你跟进的事情，请在下方卡片确认后加入我的待办。" }
		: { tool: "suggest_todos", args: { items: [{ title: "确认设备报价", sourceEmailId: "email-1" }] } });
	const { database, env, context } = await setup(t, { AI: ai });
	const { conversationId, stream } = await mod.createAgentChatStream(context, "找出这封邮件里需要我跟进的事项，并建议加入我的待办。", undefined, undefined, "Asia/Shanghai", "email-1", { locale: "zh-CN", title: "提取待办：设备报价确认" });
	const events = (await new Response(stream).text()).trim().split("\n").map((line) => JSON.parse(line));
	assert.ok(events.some((event) => event.type === "tool" && event.name === "suggest_todos" && event.state === "complete" && event.result.status === "pending_approval"));
	assert.ok(events.some((event) => event.type === "text" && event.text.includes("我的待办")));
	assert.equal(events.at(-1).type, "done");
	const first = ai.calls[0].input;
	const system = first.messages.find((message) => message.role === "system")?.content ?? "";
	assert.match(system, /Always answer the user in Simplified Chinese/);
	assert.ok(first.tools.some((tool) => (tool.function?.name ?? tool.name) === "propose_meeting"));
	assert.equal(database.db.prepare("SELECT count(*) AS count FROM im_todos").get().count, 0);

	const conversations = await mod.listAgentConversations(context);
	assert.equal(conversations[0].title, "提取待办：设备报价确认");
	const history = await mod.getAgentChatHistory(context, conversationId);
	assert.ok(history.some((row) => row.role === "tool" && row.toolName === "suggest_todos"));

	const renamed = await mod.renameAgentConversation(env, "user-1", conversationId, "  报价跟进  ");
	assert.equal(renamed.title, "报价跟进");
	await assert.rejects(mod.renameAgentConversation(env, "user-2", conversationId, "别人的"), /对话不存在/);
	await assert.rejects(mod.renameAgentConversation(env, "user-1", conversationId, "   "), /请填写/);
	await mod.clearAgentConversation(env, "user-1", conversationId);
	assert.equal((await mod.getAgentChatHistory(context, conversationId)).length, 0);
	assert.equal((await mod.listAgentConversations(context))[0].title, "报价跟进");
	await assert.rejects(mod.clearAgentConversation(env, "user-2", conversationId), /对话不存在/);
});

test("the model's thinking and its text before a tool call never reach the panel or the stored chat", async (t) => {
	const ai = fakeAi((messages) => messages.some((message) => message.role === "tool")
		? { reasoning: "The user wants a summary, so I will answer in Chinese.", text: "这封邮件请你周五前确认设备报价。" }
		: { reasoning: "Let me look at the email first.", text: "Let me read the email.", tool: "get_email", args: { emailId: "email-1" } });
	const { context } = await setup(t, { AI: ai });
	const logs = [];
	t.mock.method(console, "log", (...args) => logs.push(args));
	const { conversationId, stream } = await mod.createAgentChatStream(context, "总结这封邮件", undefined, undefined, "Asia/Shanghai", "email-1", { locale: "zh-CN" });
	const body = await new Response(stream).text();
	const events = body.trim().split("\n").map((line) => JSON.parse(line));
	assert.equal(events.at(-1).type, "done");
	// One summary line per turn, in the same shape as the chat summaries' "[im-ai] request".
	const turns = logs.filter((args) => args[0] === "[agent] request").map((args) => JSON.parse(args[1]));
	assert.equal(turns.length, 1);
	assert.deepEqual([turns[0].source, turns[0].outcome, turns[0].attempts, turns[0].steps, turns[0].toolCalls], ["chat", "ok", 1, 2, 1]);
	assert.match(turns[0].model, /^@cf\//);
	assert.ok([turns[0].ms, turns[0].inputTokens, turns[0].outputTokens].every((value) => typeof value === "number"));
	assert.ok(!events.some((event) => event.type === "reasoning"));
	assert.doesNotMatch(body, /The user wants|Let me look/);
	const history = await mod.getAgentChatHistory(context, conversationId);
	assert.ok(!history.some((row) => row.toolName === "__reasoning__"));
	const answer = history.filter((row) => row.role === "assistant").map((row) => row.content).join("");
	assert.equal(answer, "这封邮件请你周五前确认设备报价。");

	const older = [{ id: "u", role: "user", content: "总结" }, { id: "r", role: "tool", toolName: "__reasoning__", content: "Let me think" }, { id: "x", role: "tool", toolName: "get_email", content: "{}" }];
	assert.deepEqual(mod.normalizeAgentHistory(older).map((item) => [item.id, item.recordId]), [["u", undefined], ["x", "x"]]);
	assert.deepEqual(mod.removeAgentStepText([{ id: "a", role: "assistant", content: "好的Let me read." }], "a", "Let me read.")[0].content, "好的");
});

test("panel helpers: history sections, search, quick tasks and proposal parsing", () => {
	const now = new Date(2026, 9, 20, 10, 0, 0);
	const groups = mod.groupAgentConversations([
		{ id: "a", title: "今天的", updatedAt: new Date(2026, 9, 20, 8).toISOString() },
		{ id: "b", title: "昨天的", updatedAt: new Date(2026, 9, 19, 23).getTime() },
		{ id: "c", title: "很早的", updatedAt: new Date(2026, 8, 1).toISOString() },
		{ id: "d", title: "无时间" },
	], now);
	assert.deepEqual(groups.map((group) => [group.key, group.items.map((item) => item.id)]), [["today", ["a"]], ["yesterday", ["b"]], ["earlier", ["c", "d"]]]);
	assert.deepEqual(mod.filterAgentConversations([{ id: "a", title: "报价跟进" }, { id: "b", title: "Weekly" }], "weekly").map((item) => item.id), ["b"]);
	assert.ok(mod.agentQuickTasks(true).some((task) => task.id === "translateThread"));
	assert.ok(mod.agentQuickTasks(false).some((task) => task.id === "searchMail" && task.mode === "insert"));
	assert.equal(mod.agentQuickTaskTitle("总结这封邮件", " 测试 "), "总结这封邮件：测试");
	assert.equal(mod.agentActionProposal(JSON.stringify({ action: "create_todos", status: "pending_approval", items: [] }))?.action, "create_todos");
	assert.equal(mod.agentActionProposal(JSON.stringify({ action: "send_now", status: "pending_approval" })), null);
});
