import type { NextConfig } from "next";
import { getSecurityHeaders } from "./src/lib/security/headers";

const nextConfig: NextConfig = {
	distDir: process.env.MAILFLARE_RUNTIME === "node" ? ".next-node" : undefined,
	turbopack: {
		root: import.meta.dirname,
		resolveAlias: process.env.MAILFLARE_RUNTIME === "node" ? {
			"cloudflare:workers": "./server/runtime/cloudflare-workers.ts",
		} : {},
	},
  allowedDevOrigins: ['mail.dev'],
	typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete
    // even if your project has type errors.
    ignoreBuildErrors: true,
	  },
	experimental: {
		// Pages the user just visited reopen from the client router cache for 30 s instead of asking the
		// server again; their data is loaded by the client and stays fresh on its own.
		staleTimes: { dynamic: 30 },
	},
	// Native and server-only packages used by the self-hosted runtime; never bundle them.
	serverExternalPackages: ["better-sqlite3", "nodemailer", "smtp-server", "ws"],
	async headers() {
		return [
			{
				source: "/(.*)",
				headers: getSecurityHeaders(),
			},
		];
	},
};

export default nextConfig;
