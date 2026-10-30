"use client";

import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import { logoutClientSession } from "@/lib/auth/logout";

export function LogoutButton() {
	const { t } = useLanguage();
	const router = useRouter();
	return (
		<Button
			variant="outline"
			className="w-full"
			onClick={async () => {
				const bridge = window.__smjMailNavigation;
				if (!bridge) {
					window.alert(t("compose.error.navigationUnavailable"));
					return;
				}
				if (!bridge.prepare()) return;
				try {
					const switched = await logoutClientSession();
					router.replace(switched ? "/inbox" : "/login");
					router.refresh();
				} finally {
					bridge.release();
				}
			}}
		>
			{t("auth.logout")}
		</Button>
	);
}
