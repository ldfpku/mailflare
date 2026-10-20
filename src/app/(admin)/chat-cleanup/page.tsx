"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, Eraser, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SkeletonRows } from "@/components/ui/skeleton";
import type { ChatCleanupCategory } from "./types";
import { CATEGORY_NAMES, fetchChatCleanupPreview, formatBytes, formatTime, runChatCleanup, splitEmails } from "./utils";

const CONFIRM_TEXT = "确认清理";
const KIND_LABELS = { allStaff: "全员群", group: "群聊", single: "私聊" } as const;

function CategoryCard({ category, checked, onChange }: { category: ChatCleanupCategory; checked: boolean; onChange: (checked: boolean) => void }) {
	const empty = category.messages + category.files + category.meetings + category.todos + category.rooms === 0;
	return (
		<Card className={`rounded-3xl border p-6 ${category.key === "colleague" ? "border-amber-200 bg-amber-50/60" : "border-neutral-200 bg-white"}`}>
			<CardHeader className="py-0">
				<label className="flex cursor-pointer items-start gap-3">
					<Checkbox className="mt-1" checked={checked} disabled={empty} onChange={(event) => onChange(event.target.checked)} aria-label={`清理${category.label}`} />
					<div className="min-w-0">
						<CardTitle className="text-base">{category.label}</CardTitle>
						<CardDescription className="mt-1">
							{empty
								? "没有可清理的数据"
								: `会话 ${category.rooms} 个，消息 ${category.messages} 条，聊天文件 ${category.files} 个（${formatBytes(category.fileBytes)}），会议 ${category.meetings} 场，待办 ${category.todos} 条`}
						</CardDescription>
						{category.key === "colleague" && !empty && <p className="mt-2 text-sm text-amber-800">这里可能有真实工作内容，默认不勾选；确认都是测试再勾选。</p>}
					</div>
				</label>
			</CardHeader>
			{category.conversations.length > 0 && (
				<CardContent className="mt-4 divide-y divide-neutral-100 rounded-2xl border border-neutral-100 bg-white px-4 py-0">
					{category.conversations.map((conversation) => (
						<div key={conversation.key} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3 text-sm">
							<div className="min-w-0">
								<p className="font-medium text-neutral-900">{KIND_LABELS[conversation.kind]}：{conversation.title}</p>
								<p className="text-xs text-neutral-500">{conversation.kind === "allStaff" ? "发送人" : "成员"}：{conversation.people.join("、") || "-"}</p>
							</div>
							<p className="text-xs text-neutral-500">
								{conversation.messages} 条消息 · {formatTime(conversation.firstAt)} 至 {formatTime(conversation.lastAt)}
							</p>
						</div>
					))}
				</CardContent>
			)}
		</Card>
	);
}

export default function ChatCleanupPage() {
	// Both start from what the server proposes and only hold the admin's own edits.
	const [realDraft, setRealDraft] = useState<string | null>(null);
	const [appliedReal, setAppliedReal] = useState<string | null>(null);
	const [selected, setSelected] = useState<Record<string, boolean>>({});
	const [confirm, setConfirm] = useState("");
	const preview = useQuery({ queryKey: ["chat-cleanup", appliedReal], queryFn: () => fetchChatCleanupPreview(appliedReal) });
	const realText = realDraft ?? preview.data?.realEmails.join(", ") ?? "";
	const isChecked = (category: ChatCleanupCategory) => selected[category.key] ?? category.defaultChecked;

	const run = useMutation({
		mutationFn: runChatCleanup,
		onSuccess: () => {
			setConfirm("");
			void preview.refetch();
		},
	});

	const categories = preview.data?.categories ?? [];
	const chosen = categories.filter((category) => isChecked(category) && category.messages + category.files + category.meetings + category.todos + category.rooms > 0);
	const realChanged = preview.data !== undefined && splitEmails(realText).join(",") !== preview.data.realEmails.join(",");

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl md:text-3xl font-medium text-neutral-900">清理聊天测试数据</h1>
				<p className="mt-2 text-sm text-neutral-500">
					删除调试和测试时产生的聊天记录：会话、群聊、消息、聊天文件、群文件列表、邮件卡片、会议和待办。账号、通讯录、名片、签名、头像、设置和邮件本身都会保留，全员群保留但清掉其中的消息。
				</p>
			</div>

			<Card className="rounded-3xl border border-neutral-200 bg-white p-6">
				<CardHeader className="py-0">
					<CardTitle className="text-base">真实同事</CardTitle>
					<CardDescription>和这些账号有关的聊天单独列为一类，默认不清理。多个地址用逗号隔开。</CardDescription>
				</CardHeader>
				<CardContent className="mt-4 flex flex-col gap-3 sm:flex-row">
					<Input value={realText} onChange={(event) => setRealDraft(event.target.value)} aria-label="真实同事的邮箱地址" placeholder="ninggd@smjtools.com, yangzf@smjtools.com" />
					<Button
						variant="outline"
						disabled={!realChanged || preview.isFetching}
						onClick={() => {
							setSelected({});
							setAppliedReal(splitEmails(realText).join(","));
						}}
					>
						<RefreshCw className="h-4 w-4" />
						重新统计
					</Button>
				</CardContent>
				{preview.data && <p className="mt-3 text-xs text-neutral-500">已识别账号：{preview.data.realAccounts.join("、") || "无"}</p>}
			</Card>

			{preview.error && <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{preview.error.message}</p>}
			{preview.isLoading && <SkeletonRows />}

			{categories.map((category) => (
				<CategoryCard
					key={category.key}
					category={category}
					checked={isChecked(category)}
					onChange={(checked) => setSelected((current) => ({ ...current, [category.key]: checked }))}
				/>
			))}

			{preview.data && (
				<Card className="rounded-3xl border border-red-200 bg-white p-6">
					<CardHeader className="py-0">
						<div className="flex items-start gap-3">
							<AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-700" />
							<div>
								<CardTitle className="text-base">执行清理</CardTitle>
								<CardDescription className="mt-1">
									删除后不能恢复，建议先在“备份”页做一次备份。清理后大家的客户端会自动删掉本机里对应的旧消息；没收到的，重新登录一次即可。
								</CardDescription>
							</div>
						</div>
					</CardHeader>
					<CardContent className="mt-4 space-y-3">
						<p className="text-sm text-neutral-700">将清理：{chosen.length ? chosen.map((category) => category.label).join("、") : "未勾选"}</p>
						<div className="space-y-1">
							<Label htmlFor="chat-cleanup-confirm">请输入“{CONFIRM_TEXT}”</Label>
							<Input id="chat-cleanup-confirm" value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="off" />
						</div>
						{realChanged && <p className="text-sm text-amber-700">真实同事名单改过了，请先点“重新统计”。</p>}
						<Button
							variant="destructive"
							disabled={!chosen.length || confirm.trim() !== CONFIRM_TEXT || run.isPending || realChanged || preview.isFetching}
							onClick={() =>
								run.mutate({ categories: chosen.map((category) => category.key), realEmails: preview.data.realEmails, confirm: confirm.trim() })
							}
						>
							<Eraser className="h-4 w-4" />
							{run.isPending ? "正在清理…" : "清理所选数据"}
						</Button>
						{run.error && <p className="text-sm text-red-700">{run.error.message}</p>}
						{run.data && (
							<p className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
								已清理：会话 {run.data.rooms} 个，消息 {run.data.messages} 条，聊天文件 {run.data.files} 个（{formatBytes(run.data.fileBytes)}），群文件记录 {run.data.roomFiles} 条，邮件卡片 {run.data.mailShares} 个，会议 {run.data.meetings} 场，待办 {run.data.todos} 条。
							</p>
						)}
					</CardContent>
				</Card>
			)}

			{preview.data && preview.data.runs.length > 0 && (
				<Card className="rounded-3xl border border-neutral-200 bg-white p-6">
					<CardHeader className="py-0">
						<CardTitle className="text-base">清理记录</CardTitle>
					</CardHeader>
					<CardContent className="mt-4 divide-y divide-neutral-100 px-0 py-0">
						{preview.data.runs.map((item) => (
							<p key={item.at} className="py-2 text-sm text-neutral-700">
								{formatTime(item.at)}：{item.categories.map((key) => CATEGORY_NAMES[key] ?? key).join("、")}，会话 {item.rooms}，消息 {item.messages}，文件 {item.files}，会议 {item.meetings}，待办 {item.todos}
							</p>
						))}
					</CardContent>
				</Card>
			)}
		</div>
	);
}
