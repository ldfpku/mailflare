import Link from "next/link";
import { getServerTranslator } from "@/lib/i18n/server";
import { DesktopDownloadSettings } from "@/components/settings/desktop-download-settings";

export default async function DesktopAppSettingsPage() {
	const t = await getServerTranslator();
	return <div className="space-y-8 py-4">
		<section className="space-y-4">
			<div>
				<h1 className="text-xl font-semibold text-neutral-900">{t("settingsPage.desktop.title")}</h1>
				<p className="mt-1 text-sm text-neutral-500">{t("settingsPage.desktop.description")}</p>
			</div>
			<div className="space-y-4 rounded-3xl bg-white p-6">
				<DesktopDownloadSettings />
			</div>
			<p className="px-2 text-sm text-neutral-600">
				<Link href="/settings/mobile" className="font-medium text-[#034fbc] hover:underline">{t("settingsPage.desktop.mobileHint")}</Link>
			</p>
		</section>
	</div>;
}
