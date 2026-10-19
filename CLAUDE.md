# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev                    # Vite + vinext in local workerd
npm run lint                   # eslint (next/core-web-vitals + next/typescript)
npm run build                  # vinext build, including the complete Worker

npm run db:generate            # drizzle-kit generate from src/db/schema/index.ts
npm run db:migrate:local -- <d1-id>   # cf d1 migrations apply --local --dir drizzle/migrations
npm run db:migrate:remote -- <d1-id>  # remote; or migrate later from Admin settings
npm run db:seed                # POST /api/seed against localhost:3000

npm run deploy                 # vp build, then cf deploy --prebuilt; migrate later from Admin settings
npm run preview                # build and preview the vinext Worker locally
npm run cf-typegen             # cf workers types (cloudflare-env.d.ts is the checked-in CloudflareEnv)
```

There is no test script in `package.json`; the checks under `tests/` are `node:test` files run with `node --test tests/*.test.mjs` (pass the glob — on Node 24 a bare `tests/` is read as a module path). They must not need Workers bindings, so anything that reaches D1 or R2 belongs in a script under `scripts/` run against `npm run dev` instead.

`next.config.ts` sets `typescript.ignoreBuildErrors: true` and `tsconfig.json` sets `noImplicitAny: false`, so the build will not catch type errors. Run `npx tsc --noEmit` if you want real type checking.

Deployment uses the Cloudflare CLI `cf` (beta), not Wrangler. The Worker is configured in `cloudflare.config.ts` (there is no `wrangler.jsonc`); `vp build` with the beta `@cloudflare/vite-plugin` writes Build Output to `.cloudflare/output`, and `cf deploy --prebuilt` uploads it. Building needs Node 24: on Node 22 the module loader hook from `@cloudflare/config` breaks the Tailwind PostCSS load. Durable Object classes are declared in `worker.exports` (sqlite); once deployed this way the Worker cannot go back to a Wrangler `migrations` array. The config has no `keep_vars`, so Worker settings must be secrets, not plaintext variables set in the dashboard, or a deploy removes them.

## Architecture

Next.js App Router APIs running on Cloudflare Workers via vinext. Drizzle ORM over D1, R2 for raw MIME, attachments, and record backups, Queues for async mail processing, a Durable Object for realtime, and a cron trigger for scheduled backups.

### worker.ts is the entrypoint

`worker.ts` wraps `vinext/server/fetch-handler` and adds handlers Next.js cannot express:

- **`fetch`** — intercepts `/api/realtime` for the WebSocket upgrade (authenticates the session cookie, then routes to `env.REALTIME.getByName(user.id)`), delegating everything else to vinext.
- **`email`** — the Cloudflare Email Routing handler. Resolves domain routing rules first (`resolveIncomingMail` in `src/lib/email/incoming.ts`) because `message.setReject()` and `message.forward()` only exist here, then applies optional account-level forwarding (loop-guarded by the `MAILFLARE_FORWARDED_HEADER`), writes raw MIME to R2, and enqueues to `INBOUND_QUEUE`. It never parses mail inline.
- **`queue`** — a single consumer for both queues; `isInboundQueueMessage` and `isWebhookRetryMessage` in `worker-utils.ts` discriminate inbound mail, webhook retries, and outbound payloads. Failures `retry({ delaySeconds: 10 })`.

It also re-exports `RealtimeHub`, which must remain exported from the Worker entrypoint.

### Mail pipeline

Inbound: `email` handler → R2 → queue → `processInboundMessage` (`src/lib/email/inbound.ts`) → `resolveInboundAddress` routing decision (deliver / reject / forward) → `parseRawMime` (postal-mime) → insert message + attachments → upsert contacts → `dispatchWebhooks` → `notifyUsersOfNewMessage` over the Durable Object.

Outbound: `src/lib/email/send.ts` / `sender.ts`, composing with mimetext and sending through the `EMAIL` send_email binding, with `outbound_jobs` rows tracking queued sends. `to`, `cc` and `bcc` accept a header string or an array; `toAddr`/`ccAddr`/`bccAddr` on `messages` store the full comma-joined lists (use `splitEmailAddressList` from `src/lib/email/address.ts`, not `getEmailAddress`, when a value may be a list).

Composer: `src/components/compose/rich-text-editor.tsx` is a contentEditable HTML editor; the body is one HTML string and the text/plain part is derived with `htmlToPlainText` (`rich-text-utils.ts`). Quoted/forwarded content is wrapped by `wrapQuotedHtml` and folded by both the composer and the reader (`splitQuotedHtml`). Forward copies the source's attachments onto the draft (`copyMessageAttachments`); `/api/send` with `draftId` sends them.

Threading: `resolveThreadId` in `src/lib/email/threading.ts` files an inbound or imported message under the thread of the stored message its `In-Reply-To`/`References` name (matched against `providerMessageId` in the same mailbox); otherwise its own Message-ID seeds a new thread. Outbound replies carry `inReplyTo`/`references`/`threadId` from the draft, and a fresh send is keyed by the Message-ID Cloudflare returns. `/api/messages/[id]/thread` returns the conversation. Lists pass `group=thread` (the "conversation view" toggle, `use-conversation-view.ts`) to get one row per thread plus `threadMessageIds`, which row actions and bulk actions expand to.

### Sending and receiving providers are per domain

`domains.sending_provider` (`none | cloudflare | resend | ses`) and `domains.receiving_provider` (`none | cloudflare | resend | ses`, default `cloudflare`) are chosen independently on the Domains page; DNS stays on Cloudflare either way. They record intent: switching a provider never touches DNS, each provider's own Setup does, and a **Clean up** button removes the config of an unselected provider.

- **Sending** goes through `sendThroughProvider` (`src/lib/email/outbound-provider.ts`), which `deliverEmail` and `sendSystemEmail` call after `getOutboundProviderConfig(env, from)` resolves the provider from the From domain (`none` throws). Cloudflare keeps its 5 MiB link fallback; Resend and SES take attachments directly. Resend and SES return different Message-IDs than we send, so `providerMessageId` stores the one replies will carry (`<id@email.amazonses.com>` or `<id@region.amazonses.com>` for SES).
- **Receiving** from a non-Cloudflare provider enters through `intakeProviderMail` (`src/lib/email/provider-intake.ts`) and then the same `intakeIncomingMail` as everything else, once per recipient on a known domain. Providers cannot be rejected to after accepting, so reject and size limits drop the message, and `forward` is unavailable. Inbound endpoints are public and authenticate themselves: `/api/inbound/resend` verifies the Svix signature (`svix.ts`) with the secret Resend returned when `ensureWebhook` created the hook (`app_settings.resend_webhook_secret`), then fetches the raw MIME from `raw.download_url`; `/api/inbound/ses` is an SNS HTTPS endpoint guarded by a secret token in its URL, the topic ARN and reading the object from our own bucket.
- **Only one MX owner per domain.** `publishMx` (`receiving-dns.ts`) refuses with `MxConflictError` (HTTP 409 `MX_CONFLICT`) when other MX records exist; the UI confirms and retries with `replaceMx`. Cloudflare Worker routes (`ensureMailboxDomainRouting`) are created only for domains whose receiving provider is `cloudflare`.
- **Resend** keeps one key (`app_settings.resend_api_key`, or `RESEND_API_KEY`) and one Resend domain per hostname carrying both capabilities, so sending cleanup disables only `sending` when the domain still receives through Resend and vice versa. Apex MX values matching `inbound-smtp.*.amazonaws.com` are receiving records; everything else is sending.
- **AWS** (`src/lib/aws/`) is a hand-rolled SigV4 client (`sigv4.ts`, verified against AWS's published vectors in `tests/provider-aws-resend.test.mjs`) so it runs on Workers and Node without the SDK. Credentials live in `app_settings.aws_config` (or `AWS_*` env vars) and are validated before saving by `validateAwsConfig`, which proves identity with STS then probes SES, SNS and S3, reporting each missing permission with the IAM policy that grants it. SES sending uses SESv2 (`ses.ts`); receipt rules exist only in SES v1 (Query protocol), so receiving uses `awsQuery`. `setupSesReceiving` creates the S3 bucket and policy, SNS topic, policy and HTTPS subscription, then a per-domain receipt rule in the account's active rule set (creating `mailflare-inbound` only when none is active), and the MX. State is in `app_settings.ses_receiving`. SES inbound exists only in some regions (`SES_RECEIVING_REGIONS`) and needs a public HTTPS `APP_URL`.

### Routing rules have two scopes

`routing_rules.scope` splits two genuinely different mechanisms, and mixing them up is the easy mistake:

- **`domain`** — evaluated by `resolveInboundAddress` (`src/lib/email/routing.ts`) *while resolving the address*, in three phases: `reject` rules first (so a sender can be blocked even when the recipient is a real mailbox), then exact mailbox and alias lookup, then `forward`/`store` catch-all fallbacks. Ordered by descending `priority`, then oldest first. This phase split is what stops a `*` catch-all from shadowing real mailboxes — preserve it.
- **`mailbox`** — evaluated by `resolveInboxRuleDestination` *after* delivery, to pick a folder or move to spam/trash.

Both queries filter on `scope`, so any new rule must set it explicitly. `forward` and `reject` are actioned in `worker.ts`, never in the queue consumer.

### Webhook retries ride the outbound queue

`src/lib/email/webhooks.ts` records every attempt (status, error snippet, duration, `nextRetryAt`) on `webhook_deliveries` and re-enqueues failures onto `OUTBOUND_QUEUE` with a `delaySeconds` backoff rather than adding a third queue binding. `env.d.ts` widens `OUTBOUND_QUEUE` to the union of both payload types accordingly. `runDelivery` is shared by the retry queue and the manual retry endpoint.

### Cloudflare is a live dependency, not just a host

Domain and mailbox management call the Cloudflare API at runtime (`src/lib/cloudflare-api.ts`, `src/lib/domains/`). Adding a domain enables Email Routing DNS and sending subdomains on the zone; creating a mailbox creates a Cloudflare Email Routing rule targeting `CF_EMAIL_WORKER_NAME`; removing a domain cleans those up (`src/lib/domains/cloudflare-cleanup.ts`).

Consequence: `CF_EMAIL_WORKER_NAME`, the deployed Worker `name`, and the `WORKER_SELF_REFERENCE` binding's `worker` in `cloudflare.config.ts` must all agree. Cloudflare service bindings need a literal name and cannot reference the top-level `name`.

Auth is `CF_TOKEN` (preferred) or the legacy `CF_EMAIL` + `CF_API_KEY` pair.

### Schema and the dual-migration gotcha

Schema lives in one file: `src/db/schema/index.ts` (21 tables). Migrations are generated into `drizzle/migrations/`. Note that `drizzle-kit generate` currently prompts interactively about a snapshot rename conflict, so recent migrations were hand-written to match the generated style.

`npm run db:bundle` packages the SQL files for the Worker. `/api/setup/prepare` and the admin migration endpoint use the shared runner in `src/lib/migrations/service.ts`; migration files remain the only schema history to maintain. Build, deploy, preview, and development scripts generate the bundle before loading application code.

The setup path only ever initializes an empty database — it refuses to touch one that already has tables.

### Object storage is `env.BUCKET`, from R2, Backblaze B2 or AWS S3

Every blob (raw MIME, attachments, Drive, avatars, branding icon, JMAP uploads, backups) goes through `env.BUCKET` with the R2 API. `withStorage` (`src/lib/storage/index.ts`) swaps `BUCKET` for `B2Bucket` (`b2-bucket.ts`, S3 API signed with the shared SigV4 client; it serves AWS S3 too) when `getObjectStorageConfig` finds all of `B2_*` (Backblaze, wins) or `S3_BUCKET`/`S3_REGION`/credentials (AWS S3, credentials falling back to `AWS_*`); otherwise the R2 binding (or the Node file bucket) is untouched. It is applied in `getEnv()`, at the top of each `worker.ts` handler (which receive the raw env) and in the Node runtime env. `B2Bucket` implements only what the app calls (`get` with range, `head`, `put`, `delete`, multipart); if new code needs another R2 method, add it there. Do not read `cloudflare:workers` env directly for storage. `GET/POST /api/v1/storage` and the `manage_storage` MCP tool (admin scope `storage`) report and test it.

### Two runtimes, one code path

The Node build aliases `cloudflare:workers` to `server/runtime/cloudflare-workers.ts`, allowing the shared helper to use its existing `getNodeEnv()` fallback. That alias only applies when `MAILFLARE_RUNTIME=node`; vinext uses the native Workers module. Next outputs to `.next-node` so its generated types do not collide with vinext's `.next/types`.

The app reaches every platform service through `getEnv()` (`src/lib/cloudflare.ts`). On Workers that is the native `cloudflare:workers` env. In the self-hosted runtime, `server/index.ts` builds an object with the same shape (`server/runtime/env.ts`: a D1-compatible wrapper over better-sqlite3, an R2-compatible file bucket, `EMAIL` over nodemailer or the Cloudflare Sending REST API, in-process queues, a WebSocket hub standing in for the Durable Object, a fixed-window rate limiter) and publishes it as `globalThis.__mailflareNodeEnv` before Next starts; `getNodeEnv()` in `src/lib/runtime.ts` returns it. Application code must not care which one it got. The few places that must differ check `isNodeRuntime(env)`: setup requirement checks, the self-update button, and domain provisioning, which without Cloudflare credentials records the zone as `"manual"` (`src/lib/domains/provision.ts`) so every Cloudflare call is a no-op and the DNS page lists records to set by hand. Inbound mail off Workers goes through `intakeIncomingMail` (`src/lib/email/intake.ts`) from either the SMTP listener (`server/runtime/smtp.ts`) or the signed `/api/inbound` webhook the relay Worker in `deploy/cloudflare-email-relay` calls. `npm run build:node` builds Next in Node mode and bundles the server with esbuild to `dist/server.mjs`; the Dockerfile runs that. Migrations are applied from `drizzle/migrations` at start (`server/runtime/migrate.ts`), so the bootstrap schema in `src/lib/setup/migration.ts` is not used there.

### JMAP lives in `src/lib/jmap/`

`handleJmapRequest` (`src/lib/jmap/handler.ts`) owns `/jmap/*` and `/.well-known/jmap`; the Next routes under `src/app/jmap/[[...segments]]` and `src/app/.well-known/jmap` only delegate to it, and it is framework-free so it could be mounted from `worker.ts` too. Auth is an API key with the `jmap` scope via `authenticateApiRequest` (`src/lib/api/key-auth.ts`, the Next-free core that `src/lib/api/auth.ts` now wraps). JMAP Mailbox ids encode `mailboxId`, `mailboxId~role` or `mailboxId~f~folderId` (`ids.ts`); `email-query.ts` maps filters onto `messages` columns, `email-objects.ts` builds Email objects from stored rows (no MIME parsing).

States are positions in a change log (`changes.ts`): the `jmap_changes_*` triggers of migration 0064 write a row per created, updated or destroyed message and per folder or mailbox change into `jmap_changes`, so `Email/changes`, `Mailbox/changes` and `Thread/changes` return real deltas (`Email/queryChanges` still answers `cannotCalculateChanges`). A state is `c1:<seq>:<access fingerprint>`; a sharing change alters the fingerprint, and the daily cron prunes rows older than 30 days and raises `jmap_change_floor`, and either makes older states answer `cannotCalculateChanges`. Like `jmap_mailbox_revisions`, these tables are derived and excluded from backups. Never write to them from application code.

### HuLa chat lives in `src/lib/im/`

`handleImRequest` (`handler.ts`) answers HuLa's client under `/api/im/*` in HuLa-Server's shapes: every answer is `{ success, code, msg, data }` with HTTP 200, and HuLa branches on `code` (406 refreshes the token, 401 signs out). Its paths start `im/` below that prefix, so requests arrive as `/api/im/im/...`. Tokens are `sessions` rows (`tokens.ts`). `ImUserHub` (`hub.ts`) is one Durable Object per user holding that user's sockets (`/api/im/ws` in `worker.ts`); `notifyImUsers` pushes HuLa events (`receiveMessage`, `msgRecall`) and the hub writes `im_presence`.

Chat data is `im_rooms`, `im_room_members` and `im_messages` (migration 0067), queried with raw SQL in `chat.ts`; membership is the access check for every room. Room `"1"` is the all-staff group and the organisation directory: `ensureAllStaffRoom` keeps it equal to the active accounts, and the friend page lists those accounts (there are no friend requests). Message ids are the autoincrement row id and leave as strings, since HuLa's Rust side reads ids into `String`. HuLa pages history from its own SQLite, so `msg/list` (the latest `IM_SYNC_MESSAGES_PER_ROOM` per room) is how a client catches up. Text, image, file, voice, video and emoji messages are accepted; recall notices are rendered per viewer, not stored. Media go through HuLa's MinIO path (`files.ts`, migration 0068): `ossToken` creates an `im_files` row and returns a single-use PUT URL plus the download URL `/api/im/files/<id>/<name>`, whose random id is the only access check because HuLa loads images with `<img src>`. Message bodies may only point at uploaded files on our own origin (`parseMediaBody`). Mail reaches HuLa through `mail.ts`: `im/mail/sso` returns a one-time link (a 60-second `imsso_` `sessions` row) that `GET /api/im/mail/sso/<code>` trades for a normal web session cookie, `im/mail/unread` counts unread inbox mail in owned and shared mailboxes, and `notifyUsersOfNewMessage` also sends HuLa a `mailNew` socket event. A mail shared into chats becomes a `MAIL_CARD` (19) message plus an `im_mail_shares` row (`mail-share.ts`); its page `/api/im/mail/share/<id>` is routed in `worker.ts` so its sandbox CSP survives, and only current room members may open it. A group may have its own address (`room-mailbox.ts`, `im_room_mailboxes`, migration 0071): a shared mailbox owned by the manager who turned it on, whose inbound mail `processInboundMessage` posts into the group as a card instead of notifying the owner; it is also left out of `im/mail/unread`. Group files (`room-files.ts`, `im_room_files`, migration 0073) are the group's folder in Drive: every image, file and video sent into a group is filed there, and the list (HuLa's `im/room/files`, Drive's `?view=groups`) is checked against current membership on every read, so leaving a group hides it with nothing to re-share; a recall or a removal by the sender or a manager takes a file off the list but leaves the message. `im/room/files/fromDrive` copies a Drive file into a new chat file and posts it, and `im/room/files/saveToDrive` copies a group file into the caller's Drive.

### Calls and meetings ride Cloudflare Realtime

One-to-one calls are HuLa's own peer-to-peer WebRTC: `ImUserHub.webSocketMessage` hands call frames (request types 5, 6, 14) to `resolveRtcRelay` (`src/lib/im/rtc.ts`), which relays them as `VideoCallRequest`, `CallAccepted`, `CallRejected`, `DROPPED`, `CANCEL`, `TIMEOUT` or `WEBRTC_SIGNAL` only between the two members of a private room. `GET im/rtc/iceServers` mints short-lived TURN credentials from `REALTIME_TURN_KEY_ID` / `REALTIME_TURN_KEY_API_TOKEN` (STUN only without them).

Meetings are Cloudflare RealtimeKit (`src/lib/meetings/`, migration 0069): `im_meetings` keeps the schedule and invitees RealtimeKit lacks, `im_meeting_participants` one participant token per user. HuLa creates and joins through `im/meeting*` (`src/lib/im/meeting-routes.ts`); the page `/meet/<id>` and `/api/meetings/<id>/{join,meeting.ics}` are served from `worker.ts` by `handleMeetingRequest`, outside Next, because the page needs its own CSP and a Permissions-Policy that allows camera and microphone. Any active account may join by link. Invitations are mail from the host's own mailbox with a `METHOD:REQUEST` iCalendar attachment, so recipients accept them into their own calendar; there is no SMJ calendar for meetings. Needs `REALTIMEKIT_APP_ID`, `REALTIMEKIT_API_TOKEN` (Realtime Admin) and `REALTIMEKIT_ACCOUNT_ID` (or `CF_ACCOUNT_ID`); presets default to `group_call_host` / `group_call_participant`. The Node runtime does not serve the meeting page. The page loads RealtimeKit's browser build and UI Kit from `public/vendor/realtimekit/<version>` (committed; regenerate with `node scripts/vendor-realtimekit.mjs <version>`, which also patches out the UI Kit's Google Fonts loader), so its CSP names only this origin and `*.realtime.cloudflare.com`; keep it that way, no CDN. Screen sharing needs nothing from the server: one-to-one calls reserve their screen transceivers in the first offer and send share state over a negotiated data channel (HuLa `useWebRtc.ts`), and in meetings it is the UI Kit's button; the host's "仅主持人可共享屏幕" lock is a broadcast that every meeting page enforces, since `updatePermissions` does not change screenshare with the default presets.

### Mobile apps: device keys and native push

`POST /api/auth/device` signs a mobile app in with email + password (+ MFA via the login challenge) and returns a `jmap`-scoped API key of `kind = 'device'`, named after the device. It has its own rate limit (`DEVICE_LOGIN_RATE_LIMIT`) since it skips Turnstile. Device keys are listed and revoked under Settings → Security (`/api/devices`), hidden from the API keys list, and `deleteUserSessions` revokes them all (password change, reset, MFA change). Apps register their APNs token with `PUT /api/mobile/push` using the device key; `push_devices` rows cascade with the key. `notifyUsersOfNewMessage` fans out to `sendNativePush` (`src/lib/push/native.ts`), which needs the `APNS_KEY_ID`, `APNS_TEAM_ID` and `APNS_PRIVATE_KEY` secrets and encrypts sender and subject to each device's P-256 key (`native-crypto.ts`), or sends a content-free alert when the device turned previews off.

`Email/set` create and `Email/import` share one insert (`insertDraft` in `emails.ts`) and one target rule (`resolveDraftsMailbox` in `email-import-utils.ts`): a new message goes into exactly one Drafts mailbox, never Inbox or a folder, because delivered mail is the inbound pipeline's job. `Email/import` parses the uploaded blob with `parseRawMime`, stores the `Message-ID` in `providerMessageId` with its angle brackets (as inbound rows do) and keeps the uploaded bytes at `drafts/<messageId>.eml` in `rawR2Key`, so `readBlob` serves the client's own MIME back instead of the rebuilt minimal message; the `jmap-uploads/` object is deleted once claimed. `Email/copy` and `Email/parse` are still `emailUnsupported`.

`email-query.ts` answers the `header` filter from columns — `Message-ID` from `providerMessageId` (compared with and without angle brackets, since inbound rows store them and outbound rows do not), `In-Reply-To` from `inReplyTo`, `References` by a padded `LIKE` on the space-joined chain. Any other header name throws `unsupportedFilter` (RFC 8620 §5.5). Filter conditions must never be silently dropped: a client that de-duplicates with `header` would otherwise match every message in the mailbox.

### Password reset and MFA

`reset_email` on `users` is the destination for reset links (`src/lib/auth/password-reset.ts`); links are hashed, single-use, 30 minutes, and redeeming one revokes every session. Reset mail is sent by `sendSystemEmail` (`src/lib/email/system-mail.ts`), which writes straight to the send binding from the first admin mailbox on a sending-enabled domain, so nothing lands in Sent and no webhooks fire. If no domain can send, the request still returns 200 and a warning is logged. TOTP lives in `src/lib/auth/totp.ts` (RFC 6238 over Web Crypto, no dependency); the secret is stored on `users` at enrolment but only counts once `totp_enabled` is set by a verified code. A login with MFA returns `{ mfaRequired, challengeToken }` (`login_challenges`, 5 minutes) instead of a session, and `/api/auth/mfa/verify` finishes it with a TOTP or recovery code. Password changes and admin resets call `deleteUserSessions`.

### Search is an FTS5 index kept by triggers

`messages_fts` (migration 0030) is an external-content FTS5 table over `messages`; three triggers in the same migration keep it in sync on insert, update and delete, so no application code touches the index. `buildSearchConditions` in `src/lib/search/conditions.ts` turns the Gmail-style grammar (`src/lib/search/query-utils.ts`) into a `rowid IN (SELECT rowid FROM messages_fts WHERE messages_fts MATCH ?)` predicate plus plain column filters. Two consequences: the bootstrap SQL in `src/lib/setup/migration.ts` is split with `splitSqlStatements`, which keeps trigger bodies whole; and the backup coverage check skips `messages_fts%`, since the shadow tables are derived and repopulate on restore. `wrangler d1 export` does not work on databases with virtual tables; the app's own JSON backup is unaffected.

Chat has its own index, `im_messages_fts` (migration 0072), with the trigram tokenizer because chat is mostly Chinese, which unicode61 keeps as one token per run of characters. It stores its own copy of the searchable text (text content, file names, mail card subject and snippet); triggers add, drop recalled and delete rows, and `insertMessage` swaps a text message's copy for its tag-stripped text. `GET im/search` (`src/lib/im/search.ts`) is the unified search: chat in the rooms the user is a member of (trigram MATCH for terms of three or more characters, `instr` for shorter ones), and mail in the mailboxes they own or were shared, without group addresses, through `buildSearchConditions` with `substringTerm`, which matches Chinese words with `LIKE` since the mail index cannot find them inside a sentence. Backups skip `im_messages_fts%` as well.

### Access control

Two independent auth surfaces:

- **Session cookie** (`ep_session`) — `getCurrentUser` / `requireUser` in `src/lib/auth/cookies.ts`, backed by `src/lib/auth/session.ts`. Used by dashboard/admin API routes. `requireUser` *throws*, which Next surfaces as a 500; prefer `requireSessionUser` from `src/lib/api/auth.ts`, which returns a proper 401 response. Most older routes still use `requireUser` and 500 on unauthenticated requests.
- **API key bearer token** — `authenticateApiKey` + `requireScope` in `src/lib/api/auth.ts`, used by the public `/api/v1/*` surface.

Mailbox authorization is separate from user role and goes through `src/lib/mailboxes/access.ts` (`getMailboxAccessLevel`, `listAccessibleMailboxes`, `listAccessibleMailboxIds`), which accounts for ownership, the `mailbox_access` sharing table, and admin role. Message queries scope by accessible mailbox IDs, not by `userId` — see `src/app/api/messages/route.ts` for the canonical pattern.

### Folders are mostly virtual

`messages.status` is a free-text column driving the folder views: `received` (inbox), `sent`, `draft`, `spam`, `trash`, `archived`. Orthogonal to that are `starred`, `snoozedUntil`, and `folderId` (user-created folders in the `folders` table). A "folder" route under `src/app/(dashboard)/` is usually a status filter, not a table.

### Licensing gates branding

Pro/Team keys are validated against Paymug (`src/lib/licenses/`); only a one-way key hash is stored. Without an active license the app falls back to the default name, icon, and favicon, and custom branding is unavailable. `getLicenseEntitlements` is the gate.

### Self-update

The admin overview dispatches `deploy-update.yml` (constant in `src/app/api/admin/update/utils.ts`) in the installation repo, which merges the upstream default branch and pushes it. It does not migrate, build, or deploy; the connected Cloudflare Git integration deploys the push. The admin update card separately reports and applies pending D1 migrations through the Worker binding.

## Conventions

- Tabs for indentation. `@/*` maps to `src/*`.
- Types and pure helpers are split out of components and modules into sibling `*-types.d.ts` and `*-utils.ts` files (41 and 27 of them respectively). Follow this when adding anything non-trivial.
- Server code reaches bindings through `getEnv()` / `getEnvAsync()` in `src/lib/cloudflare.ts`, then `getDb(env)` from `src/db`. Keep binding access centralized here.
- API routes return `NextResponse.json({ error: "..." }, { status })` for failures; there is no shared error envelope helper.
- UI is Tailwind v4 + shadcn/Radix primitives in `src/components/ui/`. `DialogContent` sets no max height, so a tall dialog overflows the viewport with an unreachable submit button — add `max-h-[calc(100vh-4rem)] overflow-y-auto` on any dialog with more than a few fields.
- `cloudflare-env.d.ts` is generated (500KB) — regenerate with `cf-typegen`, never hand-edit.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
