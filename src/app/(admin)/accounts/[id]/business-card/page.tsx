"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { BusinessCardEditor } from "@/components/business-card/business-card-editor";
import { useLanguage } from "@/components/language-provider";
import { fetchManagedAccount } from "../utils";

export default function AccountBusinessCardPage() {
	const { t } = useLanguage();
	const { id } = useParams<{ id: string }>();
	const [editable, setEditable] = useState<boolean | null>(null);

	useEffect(() => {
		void fetchManagedAccount(id).then((account) => setEditable(account.editable)).catch(() => setEditable(false));
	}, [id]);

	return (
		<div className="space-y-2">
			<h1 className="text-2xl md:text-3xl font-medium text-neutral-900">{t("accountSettings.businessCard")}</h1>
			{editable !== null && <BusinessCardEditor accountId={id} editable={editable} />}
		</div>
	);
}
