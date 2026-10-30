"use client";

import { useLanguage } from "@/components/language-provider";
import { useCompose } from "@/components/compose/compose-context";
import { useEffect, useRef } from "react";

export default function ComposePage() {
	const { t } = useLanguage();
	const { openPageComposer, setPageSlot } = useCompose();
	const openPage = useRef(openPageComposer);
	useEffect(() => { openPage.current(); }, []);
	return (
		<div className="h-full overflow-auto p-8">
			<div className="mb-6">
				<h1 className="text-2xl font-normal text-neutral-900">{t("compose.pageTitle")}</h1>
				<p className="mt-1 text-sm text-neutral-500">{t("compose.pageDescription")}</p>
			</div>
			<div id="compose-page-slot" ref={setPageSlot} className="h-full min-h-[720px] w-full max-w-4xl" />
		</div>
	);
}
