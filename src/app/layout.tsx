import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import { isNodeRuntime } from "@/lib/runtime";
import { LanguageProvider } from "@/components/language-provider";
import { BUNDLED_LOCALE, getDirection } from "@/lib/i18n/utils";
import { getRequestLocale, loadServerMessages } from "@/lib/i18n/server";
import { sidebarBootstrapScript } from "@/components/sidebar-state-utils";
import { themeBootstrapScript } from "@/components/theme-utils";
import { getHomeBranding } from "./home-server-utils";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
	const { appName, hasCustomIcon } = await getHomeBranding();
	return {
		title: appName,
		description: "斯米伽（SMJ）内部邮箱",
		// The packaged icon is a static asset; only a custom icon needs the Worker.
		icons: { icon: hasCustomIcon ? "/api/branding/icon" : "/icon-96.png", apple: "/icon-180.png" },
		appleWebApp: {
			capable: true,
			title: appName,
			statusBarStyle: "default",
		},
		robots: {
			index: false,
			follow: false,
			noarchive: true,
			nosnippet: true,
			noimageindex: true,
			googleBot: {
				index: false,
				follow: false,
				noarchive: true,
				nosnippet: true,
				noimageindex: true,
			},
		},
	};
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
	const locale = await getRequestLocale();
	const messages = locale === BUNDLED_LOCALE ? undefined : await loadServerMessages(locale);
	const branding = await getHomeBranding();
	return (
		<html lang={locale} dir={getDirection(locale)} data-remote-image-proxy={isNodeRuntime() ? "disabled" : "enabled"} suppressHydrationWarning>
			<head>
				<script dangerouslySetInnerHTML={{ __html: sidebarBootstrapScript }} />
				<script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
			</head>
			<body className="antialiased">
				<LanguageProvider initialLocale={locale} initialMessages={messages}><Providers initialBranding={branding}>{children}</Providers></LanguageProvider>
			</body>
		</html>
	);
}
