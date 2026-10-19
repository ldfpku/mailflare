"use client";

import { BusinessCardEditor } from "@/components/business-card/business-card-editor";
import { useLanguage } from "@/components/language-provider";

export default function SettingsBusinessCardPage() {
	const { t } = useLanguage();
	return (
		<>
			<h1 className="sr-only">{t("settings.nav.businessCard")}</h1>
			<BusinessCardEditor />
		</>
	);
}
