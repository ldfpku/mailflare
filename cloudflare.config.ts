import { bindings, defineConfig, exports, triggers } from "cf/config";

export default defineConfig({
	// The ZY account that serves mail.smjtools.com.
	accountId: "35f7abfbdeb4851714ce57f480531c4a",
	worker: {
		name: "mailflare",
		compatibilityDate: "2026-05-20",
		compatibilityFlags: [
			"nodejs_compat",
			"global_fetch_strictly_public",
		],
		entrypoint: "./worker.ts",
		// Both classes were created with `new_sqlite_classes` (Wrangler migrations v1 and v2).
		exports: {
			RealtimeHub: exports.durableObject({ storage: "sqlite" }),
			ImUserHub: exports.durableObject({ storage: "sqlite" }),
		},
		observability: {
			enabled: true,
		},
		assets: {
			notFoundHandling: "none",
		},
		triggers: [
			triggers.scheduled({
				schedule: "0 2 * * *",
			}),
			triggers.scheduled({
				schedule: "*/5 * * * *",
			}),
			triggers.queue({
				maxBatchSize: 5,
				maxRetries: 3,
				name: "mailflare-inbound",
			}),
			triggers.queue({
				maxBatchSize: 5,
				maxRetries: 3,
				name: "mailflare-outbound",
			}),
			triggers.queue({
				maxBatchSize: 1,
				maxRetries: 3,
				name: "mailflare-agent",
			}),
		],
		env: {
			DB: bindings.d1({
				name: "mailflare",
			}),
			BUCKET: bindings.r2({
				name: "mailflare-raw",
			}),
			EMAIL: bindings.sendEmail({
				dev: {
					remote: false,
				},
			}),
			INBOUND_QUEUE: bindings.queue({
				name: "mailflare-inbound",
			}),
			OUTBOUND_QUEUE: bindings.queue({
				name: "mailflare-outbound",
			}),
			AGENT_QUEUE: bindings.queue({
				name: "mailflare-agent",
			}),
			WORKER_SELF_REFERENCE: bindings.worker({
				worker: "mailflare",
			}),
			REALTIME: bindings.durableObject({
				worker: "mailflare",
				exportName: "RealtimeHub",
			}),
			IM_HUB: bindings.durableObject({
				worker: "mailflare",
				exportName: "ImUserHub",
			}),
			AI: bindings.ai({
				dev: {
					remote: true,
				},
			}),
			IMAGES: bindings.images({}),
			LOGIN_RATE_LIMIT: bindings.rateLimit({
				namespace: "1001",
				simple: {
					limit: 20,
					period: 60,
				},
			}),
			DEVICE_LOGIN_RATE_LIMIT: bindings.rateLimit({
				namespace: "1003",
				simple: {
					limit: 10,
					period: 60,
				},
			}),
			AGENT_RATE_LIMIT: bindings.rateLimit({
				namespace: "1002",
				simple: {
					limit: 120,
					period: 60,
				},
			}),
			ASSETS: bindings.assets(),
		},
	},
});
