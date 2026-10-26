# Deployment checklist

## Backend (Laravel)

1. PHP 8.3+ with `pdo_mysql`, `redis`, `sodium`, `intl`; MySQL 8; Redis 7.
2. `.env`: `APP_ENV=production`, `APP_DEBUG=false`, unique `APP_KEY` (back it up — it decrypts stored tokens), `APP_URL` (HTTPS), `FRONTEND_URL`, `DB_CONNECTION=mysql`, `QUEUE_CONNECTION=redis`, `CACHE_STORE=redis`, `SESSION_DRIVER=redis`, `SIMULATOR_SYNC=true` (simulator only), platform credentials.
3. Deploy: `composer install --no-dev -o && php artisan migrate --force && php artisan config:cache route:cache event:cache`.
4. Workers (Supervisor/systemd or Laravel Cloud workers), separated so webhooks never wait behind email:
   ```
   php artisan queue:work redis --queue=webhooks --tries=5 --max-time=3600
   php artisan queue:work redis --queue=automations --tries=6 --max-time=3600
   php artisan queue:work redis --queue=email --tries=3 --timeout=3600
   ```
   Scale `webhooks`/`automations` workers horizontally under load.
5. Scheduler: `* * * * * php artisan schedule:run` (resumes delayed runs, times out reply waits, refreshes Instagram tokens, prunes failed jobs).
6. Respond to webhooks quickly: the endpoint only verifies, stores and enqueues, so keep PHP-FPM workers free.
7. Monitoring: ship Laravel logs to your error tracker (Sentry/Flare), alert on `failed_jobs` growth and on **Settings → Integrations → webhook health** failures.

## Frontend (Next.js)

1. `BACKEND_URL` = internal URL of the Laravel API (server-side only).
2. `npm ci && npm run build && npm run start` (or deploy to Vercel / any Node host).
3. Serve both behind HTTPS on the same registrable domain so the session cookie stays first-party.

## Before onboarding customers

- Meta App Review approved (see SETUP_INTEGRATIONS.md), Business Verification complete.
- Privacy policy + terms URLs set in the Meta app; data deletion callback/instructions.
- Backups for MySQL; `APP_KEY` stored in a secret manager.
