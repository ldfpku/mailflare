"use client";

import Link from "next/link";
import { useLanguage } from "@/components/language-provider";
import type { AgentEmailLinkProps } from "./types";
import { agentDraftIdForEmail, agentEmailHref } from "./utils";

export function AgentEmailLink({ email, className }: AgentEmailLinkProps) {
	const { t } = useLanguage();
	const draftId = agentDraftIdForEmail(email);
	if (draftId) return <Link className={className} href={`/drafts/${encodeURIComponent(draftId)}`}>{email.subject || t("list.noSubject")}</Link>;
	return <Link className={className} href={agentEmailHref(email)}>{email.subject || t("list.noSubject")}</Link>;
}
