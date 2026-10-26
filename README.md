# 2K Automation

Social media automation for creators and businesses — comment-to-DM, keyword triggers, a visual flow builder, unified inbox, lead capture, email and an AI assistant (English & Swahili). Built **only on official platform APIs** (Instagram, Facebook Messenger, WhatsApp Business, TikTok) with every platform's messaging rules enforced in code.

```
Someone comments "LINK" on your Reel
  → webhook (signature verified, deduplicated)
  → keyword trigger matches
  → public reply: "Check your DMs! 📩"
  → private reply DM with your link (once per comment, within 7 days)
  → tag the contact, wait for a reply, collect email, hand over to a human…
```

## Stack

| | |
|---|---|
| Frontend | Next.js 16 (App Router, TypeScript), Tailwind CSS 4, shadcn/ui (Base UI), React Flow 12, Recharts 3, SWR |
| Backend | Laravel 13 REST API (`/api/v1`), Sanctum, queued jobs, scheduler |
| Data | MySQL 8 (production) · SQLite (local quick start / tests) |
| Queues | Redis (production) · database driver (local) |
| AI | Anthropic Claude (official PHP SDK) or OpenAI, plus a credential-free knowledge-base fallback |

## Quick start (no external credentials needed)

Requirements: PHP 8.3+ (8.5 tested), Composer, Node 20+.

```bash
# 1. Backend
cd backend
cp .env.example .env
composer install
php artisan key:generate
touch database/database.sqlite
php artisan migrate --seed          # demo user: demo@2k.test / demo-pass-123
php artisan serve                    # http://127.0.0.1:8000

# In two more terminals (backend/):
php artisan queue:work --queue=webhooks,automations,email,default
php artisan schedule:work            # resumes delays, refreshes tokens

# 2. Frontend
cd ../frontend
cp .env.example .env.local
npm install
npm run dev                          # http://localhost:3000
```

Open http://localhost:3000, sign in with the demo account (or register), then open **Simulator** and comment `LINK` on a test Reel to watch the full automation run. Simulated records are badged everywhere and never leave the server.

### Production-like infrastructure

```bash
docker compose up -d   # MySQL 8.4 + Redis 7
```
Then in `backend/.env` set `DB_CONNECTION=mysql` (uncomment the MySQL block) and `QUEUE_CONNECTION=redis`, `CACHE_STORE=redis`.

## Tests

```bash
cd backend && php artisan test          # 46 tests: engine, policy, webhooks, OAuth config, tenancy, AI, email consent
cd frontend && npx tsc --noEmit && npm run lint
```

## Project layout

```
backend/                 Laravel API
  app/Services/Platforms   Official API clients (Instagram, Messenger, WhatsApp, TikTok, Simulated)
  app/Services/Messaging   MessagingPolicy (platform rules) + MessageDispatcher
  app/Services/Webhooks    Signature verification, payload normalisers, dedupe, ingestion
  app/Services/Automation  TriggerMatcher, FlowExecutor, node handlers, templates
  app/Services/Ai          Claude / OpenAI / knowledge-base responders, handover logic
  app/Http/Controllers/Api/V1
frontend/                Next.js dashboard
  src/app/api/            Auth + backend proxy route handlers (httpOnly session cookie)
  src/app/(app)/          Dashboard, Automations & Flow Builder, Comments, Simulator, Inbox,
                          Contacts, Email, AI, Analytics, Channels, Settings
docs/
  PLATFORM_COMPLIANCE.md  Researched API facts, limits and policy rules per platform
  SETUP_INTEGRATIONS.md   Step-by-step: Meta/Instagram/WhatsApp/TikTok apps, webhooks, App Review
  ARCHITECTURE.md         Engine design, data model, security model
  DEPLOYMENT.md           Production checklist
PROGRESS.md              Development log and next steps
```

## Going live

Connecting real accounts requires your own Meta / TikTok developer apps and App Review. Follow [docs/SETUP_INTEGRATIONS.md](docs/SETUP_INTEGRATIONS.md); the dashboard's **Settings → Integrations** tab shows which credentials are configured and the exact webhook/OAuth URLs to register.
