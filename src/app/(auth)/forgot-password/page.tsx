import { AuthGuard } from "@/components/auth/auth-guard";
import { authPageMetadata } from "../auth-metadata";
import { getEnv } from "@/lib/cloudflare";
import { getLoginDomain } from "@/lib/auth/login-domain";
import { ForgotPasswordClient } from "./forgot-password-client";

export const dynamic = "force-dynamic";

export const generateMetadata = () => authPageMetadata("auth.forgot.title");

export default async function ForgotPasswordPage() {
	return (
		<AuthGuard mode="public">
			<ForgotPasswordClient loginDomain={await getLoginDomain(getEnv())} />
		</AuthGuard>
	);
}
