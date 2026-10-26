# 2K Automation — Development Progress

> Living document. Update at the end of every work session so development can resume without lost context.

## Architecture (decided)

| Layer | Choice | Notes |
|---|---|---|
| Frontend | Next.js 16.4 (App Router, TS, Cache Components), Tailwind 4, shadcn/ui on **Base UI** (compose with `render`, not `asChild`), React Flow 12, Recharts 3, SWR | `frontend/` |
| Backend | Laravel 13.38 REST API, Sanctum tokens, prefix `/api/v1` (route names `v1.*`) | `backend/`; Laravel Boost guidelines in `backend/CLAUDE.md` |
| DB | MySQL 8 in production; SQLite locally/tests | `docker-compose.yml` → MySQL 8.4 + Redis 7 |
| Queues | `webhooks`, `automations`, `email` (Redis in prod, database locally); simulator runs inline (`SIMULATOR_SYNC`) | |
| Auth | Sanctum token in an **httpOnly cookie** set by Next route handlers (`src/app/api/auth/[action]`); `src/app/api/backend/[...path]` proxies to Laravel | |
| Tenancy | `workspace_id` everywhere, `ResolveWorkspace` middleware, abilities in `App\Enums\WorkspaceRole` (mirrored in `frontend/src/hooks/use-session.ts`) | |
| AI | Official `anthropic-ai/sdk` (default `claude-opus-5-5`, effort low, structured JSON, server-side fallback) / OpenAI via HTTP / built-in knowledge-base fallback | |

Engine flow and security model: `docs/ARCHITECTURE.md`. Platform facts and limits: `docs/PLATFORM_COMPLIANCE.md` (Graph API v26.0).

## Phase status

- [x] **Phase 1** — setup, schema, auth (register/login/logout/profile), workspaces, team & invitations, roles, dashboard UI, onboarding
- [x] **Phase 2** — Instagram API with Instagram Login: OAuth + long-lived tokens + refresh command, webhooks (verify handshake, HMAC signature, dedupe), comment keyword triggers, public replies, private replies (once/comment, 7-day window, 740/h throttle)
- [x] **Phase 3** — React Flow builder (14 node types, inspector, validation, runs drawer) + resumable FlowExecutor (delays, reply waits, branching, retries)
- [x] **Phase 4** — Unified inbox (policy-aware composer, AI suggest, assignment), contacts (tags, consent ledger, CSV export, GDPR erase), comments moderation, email (SMTP providers, templates, consent-gated campaigns, signed unsubscribe), analytics
- [x] **Phase 5** — AI assistant (EN/SW, confidence threshold, handover keywords, knowledge base, playground, auto-reply); Messenger (Pages OAuth, feed comments, Send API), WhatsApp (Cloud API, manual system-user connect, templates), TikTok (comment replies only; endpoints marked UNVERIFIED)
- [~] **Phase 6** — 48 backend tests passing; frontend tsc/eslint clean; production build OK; security headers; docs. Remaining items below.

## How to run

See `README.md` → Quick start. Demo login after `php artisan migrate --seed`: **demo@2k.test / demo-pass-123**.

## Session log

### 2026-10-26 (session 1)
- Scaffolded Laravel 13 + Next 16, researched platform APIs (`docs/PLATFORM_COMPLIANCE.md`).
- Built the full backend (models, platform clients, MessagingPolicy, dispatcher, webhooks, engine, AI, email, controllers, 87+ routes) with 48 feature/unit tests.
- Built the frontend foundation (theme with validated chart palette, BFF auth proxy, shell, dashboard, auth, onboarding) and, in parallel, Automations/Flow Builder, Inbox/Contacts/Comments, Simulator/Channels/Analytics, Email/AI/Settings.
- Integration fixes found by verification: nested-validation stripping of `flow`/`trigger_config` on save, enum key bug in per-automation analytics, run-lock re-entrancy with delayed jobs, Suspense boundary for Cache Components, default-provider uniqueness, draft campaign delete.
- Visual QA via headless Chrome screenshots (desktop light/dark + mobile).

## Next steps (prioritised)

1. **Real-account test**: create the Meta app, set Instagram credentials, connect a tester account via a tunnel, verify live webhook payload shapes against `MetaPayloadNormalizer` (see `docs/SETUP_INTEGRATIONS.md`).
2. Fetch Instagram user profile (name/username/`is_user_follow_business`) for DM senders on first contact.
3. WhatsApp Embedded Signup JS flow in Channels; WhatsApp template picker in the inbox composer when the 24h window is closed.
4. Real-time inbox/simulator updates (Laravel Reverb or SSE) instead of polling.
5. Frontend tests (Playwright smoke tests for login → simulator → builder save).
6. Flow builder: highlight invalid nodes on canvas, undo/redo.
7. Billing/plans, usage limits per workspace, Horizon or queue metrics dashboard, Sentry integration.
8. Confirm TikTok API for Business endpoints once access is granted (marked UNVERIFIED in code).

## External setup required (human steps)
Documented in `docs/SETUP_INTEGRATIONS.md`: Meta app + Instagram Login product, webhook URL + verify token, Instagram testers, App Review (Advanced Access for `instagram_business_*`, `pages_*`), Business Verification, WhatsApp WABA/system user/templates, TikTok for Business app, AI API keys, SMTP provider.
