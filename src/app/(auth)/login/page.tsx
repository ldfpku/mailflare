import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AuthGuard } from "@/components/auth/auth-guard";
import { hasAdminAccount } from "@/lib/auth/setup";
import { getUserFromSession, SESSION_COOKIE } from "@/lib/auth/session";
import { getEnv } from "@/lib/cloudflare";
import { authPageMetadata } from "../auth-metadata";
import { LoginClient } from "./login-client";

export const dynamic = "force-dynamic";

export const generateMetadata = () => authPageMetadata("auth.signIn");

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ add?: string; next?: string }> }) {
	const params = await searchParams;
	const adding = params.add === "1";
	const env = getEnv();
	if (!(await hasAdminAccount(env))) redirect("/setup");
	const cookieStore = await cookies();
	const user = await getUserFromSession(env, cookieStore.get(SESSION_COOKIE)?.value);
	// Already signed in: the web chat client sent here with `?next=/im/` goes straight back.
	if (user && !user.disabled && !adding) redirect(params.next === "/im/" ? "/im/" : "/inbox");

	return (
		<AuthGuard mode="public" allowAuthenticated={adding}>
			<LoginClient adding={adding} />
		</AuthGuard>
	);
}
