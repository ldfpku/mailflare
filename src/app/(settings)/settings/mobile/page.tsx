import { getServerTranslator } from "@/lib/i18n/server";
import { MobileAppSettings } from "@/components/settings/mobile-app-settings";

export default async function MobileAppSettingsPage() {
	const t = await getServerTranslator();
	return <div className="space-y-8 py-4">
		<section className="space-y-4">
			<div>
				<h1 className="text-xl font-semibold text-neutral-900">{t("settingsPage.mobile.title")}</h1>
				<p className="mt-1 text-sm text-neutral-500">{t("settingsPage.mobile.description")}</p>
			</div>
			<MobileAppSettings />
		</section>
	</div>;
}
