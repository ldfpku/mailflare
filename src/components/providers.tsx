"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { clearMailboxClientState } from "@/components/mailbox-provider-utils";
import { BrandingProvider } from "@/components/branding-provider";
import type { Branding } from "@/lib/branding/types";
import { NewMessagePopup } from "@/components/new-message-popup";
import { PwaServiceWorker } from "@/components/pwa-service-worker";
import { ThemeSync } from "@/components/theme-sync";
import { useMessagePolling } from "@/hooks/use-message-polling";
import { clearMessageClientState } from "@/hooks/utils";
import { clearMessageDetailCache } from "@/lib/messages/detail-cache";
import { clearCurrentUserCache } from "@/hooks/use-current-user";
import { AUTH_SESSION_CHANGED_EVENT } from "@/lib/auth/client";
import { installMailNavigationGuard } from "@/components/compose/mail-navigation-guard";
import { ComposeProvider } from "@/components/compose/compose-context";
import { FloatingComposer } from "@/components/compose/floating-composer";
import { MailboxProvider } from "@/components/mailbox-provider";

export function Providers({ children, initialBranding }: { children: React.ReactNode; initialBranding?: Branding }) {
	const realtime = useMessagePolling();

	useEffect(() => installMailNavigationGuard(), []);

	const [client] = useState(
		() =>
			new QueryClient({
				defaultOptions: {
					queries: {
						refetchOnMount: false,
						refetchOnReconnect: false,
						refetchOnWindowFocus: false,
						staleTime: 60_000,
					},
				},
			}),
	);

	useEffect(() => {
		function resetUserScopedState() {
			client.clear();
			clearMailboxClientState();
			clearMessageClientState();
			clearMessageDetailCache();
			clearCurrentUserCache();
		}

		window.addEventListener(AUTH_SESSION_CHANGED_EVENT, resetUserScopedState);
		return () => window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, resetUserScopedState);
	}, [client]);

	return (
		<QueryClientProvider client={client}>
			<BrandingProvider initialBranding={initialBranding}>
				<MailboxProvider>
				<ComposeProvider>
				<PwaServiceWorker />
				{children}
				<FloatingComposer />
				<ThemeSync />
				<div role="status" aria-live="polite">
					{realtime.notification && (
						<NewMessagePopup
							notification={realtime.notification}
							onDismiss={realtime.dismissNotification}
						/>
					)}
				</div>
				</ComposeProvider>
				</MailboxProvider>
			</BrandingProvider>
		</QueryClientProvider>
	);
}
