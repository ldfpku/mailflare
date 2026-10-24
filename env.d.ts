interface CloudflareEnv {
	DB: D1Database;
	EMAIL: SendEmail;
	BUCKET: R2Bucket;
	/** SMJ desktop installers, update bundles and latest.json, uploaded by HuLa's desktop-release workflow. */
	DESKTOP_BUCKET?: R2Bucket;
	INBOUND_QUEUE: Queue<import("./src/lib/email/inbound").InboundQueueMessage>;
	AGENT_QUEUE?: Queue<{ kind: "agent.draft"; jobId: string }>;
	AI?: Ai;
	AI_MODEL?: string;
	AI_BASE_URL?: string;
	AI_API_KEY?: string;
	/** Workers AI model (`@cf/...`) for chat summaries and mail to-dos; defaults to the assistant's Workers AI model. */
	IM_AI_MODEL?: string;
	// The outbound queue also carries webhook retries so that scheduled redelivery needs no extra binding.
	OUTBOUND_QUEUE: Queue<
		| import("./src/lib/email/send").OutboundQueueMessage
		| import("./src/lib/email/webhooks").WebhookRetryMessage
	>;
	ASSETS: Fetcher;
	IMAGES: ImagesBinding;
	WORKER_SELF_REFERENCE: Fetcher;
	REALTIME: DurableObjectNamespace<
		import("./src/lib/realtime/hub").RealtimeHub
	>;
	/** HuLa client sockets, one object per user. Absent in the Node runtime. */
	IM_HUB: DurableObjectNamespace<
		import("./src/lib/im/hub").ImUserHub
	>;
	LOGIN_RATE_LIMIT?: RateLimit;
	/** Mobile device sign-in (`/api/auth/device`), stricter than the web login. */
	DEVICE_LOGIN_RATE_LIMIT?: RateLimit;
	/** APNs auth key for the mobile push relay (src/lib/push/native.ts). */
	APNS_KEY_ID?: string;
	APNS_TEAM_ID?: string;
	/** The .p8 file contents (PKCS#8 PEM). */
	APNS_PRIVATE_KEY?: string;
	/** Origin of a Mailflare push relay (mailflare-relay); lets this server push without APNS_* keys. */
	APNS_RELAY_URL?: string;
	/** Spamhaus Data Query Service key; enables ZEN (sending IP) and DBL (domain) checks in spam analysis. */
	SPAMHAUS_DQS_KEY?: string;
	/** abuse.ch Auth-Key; enables URLhaus malware-host checks for links in incoming mail. */
	ABUSECH_AUTH_KEY?: string;
	/** "off" disables the RDAP domain-age check in spam analysis. */
	SPAM_DOMAIN_AGE_CHECK?: string;
	/** Assistant calls per minute per key (10/min); see src/lib/agent/rate-limit.ts. */
	AGENT_RATE_LIMIT?: RateLimit;
	/** Assistant calls per user per UTC day across chat, MCP and chat summaries; default 200, "0" disables. */
	AGENT_DAILY_LIMIT?: string;
	/** Assistant calls per UTC day for the whole install; default 2000, "0" disables. */
	AGENT_DAILY_GLOBAL_LIMIT?: string;
	/**
	 * Backblaze B2 storage. When all four are set, B2 replaces the R2 binding for raw mail, attachments, Drive,
	 * avatars, branding and backups. B2_ENDPOINT is the S3-compatible host, e.g. s3.us-west-004.backblazeb2.com.
	 */
	B2_KEY_ID?: string;
	B2_APPLICATION_KEY?: string;
	B2_BUCKET?: string;
	B2_ENDPOINT?: string;
	/**
	 * AWS S3 storage, used when B2 is not configured. Credentials fall back to AWS_ACCESS_KEY_ID /
	 * AWS_SECRET_ACCESS_KEY (read from the environment), so an existing SES key can serve both.
	 */
	S3_BUCKET?: string;
	S3_REGION?: string;
	S3_ACCESS_KEY_ID?: string;
	S3_SECRET_ACCESS_KEY?: string;
	CF_TOKEN?: string;
	CF_API_KEY?: string;
	CF_EMAIL?: string;
	TURNSTILE_SECRET_KEY?: string;
	/** "node" when served by the self-hosted runtime in server/; unset on Workers. */
	MAILFLARE_RUNTIME?: "node";
	/** Shared secret the Cloudflare email relay signs inbound webhooks with (self-hosted only). */
	INBOUND_WEBHOOK_SECRET?: string;
	/** Cloudflare account id, needed for the Email Sending REST API off Workers. */
	CF_ACCOUNT_ID?: string;
	/** Cloudflare Realtime TURN key (dashboard → Realtime → TURN). Mints short-lived ICE credentials for HuLa calls. */
	REALTIME_TURN_KEY_ID?: string;
	REALTIME_TURN_KEY_API_TOKEN?: string;
	/** Cloudflare RealtimeKit app for video meetings, and an API token with Realtime Admin. */
	REALTIMEKIT_APP_ID?: string;
	REALTIMEKIT_API_TOKEN?: string;
	/** Account the RealtimeKit app belongs to; falls back to CF_ACCOUNT_ID. */
	REALTIMEKIT_ACCOUNT_ID?: string;
	/** Preset names for the meeting host and everyone else; default to the presets a dashboard-created app has. */
	REALTIMEKIT_HOST_PRESET?: string;
	REALTIMEKIT_PARTICIPANT_PRESET?: string;
	/** Public origin of this install (https://mail.example.com) when it sits behind a proxy. */
	APP_URL?: string;
	/** Domain added to a sign-in name typed without @ (e.g. example.com); defaults to the first domain on the install. */
	LOGIN_DOMAIN?: string;
	/** VAPID public key (uncompressed P-256 point, URL-safe base64) for Web Push. */
	VAPID_PUBLIC_KEY?: string;
	/** VAPID private scalar (URL-safe base64). Keep this secret. */
	VAPID_PRIVATE_KEY?: string;
	/** Contact URI for VAPID, e.g. mailto:admin@example.com or https://mail.example.com. */
	VAPID_SUBJECT?: string;
}
