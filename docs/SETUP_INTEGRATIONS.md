# Connecting real platforms

Everything in 2K Automation runs in simulation mode until you add credentials. This guide lists the exact human steps; the code side is already implemented. See [PLATFORM_COMPLIANCE.md](PLATFORM_COMPLIANCE.md) for the underlying API facts and sources.

Your public URLs (shown in **Settings → Integrations**) must be HTTPS. For local testing, expose the Laravel server with a tunnel (e.g. `cloudflared tunnel --url http://127.0.0.1:8000` or ngrok) and set `APP_URL` to the tunnel URL.

| Purpose | URL |
|---|---|
| Meta webhook (Instagram, Messenger, WhatsApp) | `{APP_URL}/api/v1/webhooks/meta` |
| TikTok webhook | `{APP_URL}/api/v1/webhooks/tiktok` |
| Instagram OAuth redirect | `{APP_URL}/api/v1/oauth/instagram/callback` |
| Facebook OAuth redirect | `{APP_URL}/api/v1/oauth/facebook/callback` |
| TikTok OAuth redirect | `{APP_URL}/api/v1/oauth/tiktok/callback` |

---

## 1. Instagram (Instagram API with Instagram Login)

Works with Instagram **Business or Creator** accounts; no Facebook Page required.

1. Go to https://developers.facebook.com/apps → **Create app** → type **Business**.
2. Add the **Instagram** product → **API setup with Instagram login**.
3. Copy the **Instagram app ID** and **Instagram app secret** into `backend/.env`:
   ```
   INSTAGRAM_APP_ID=...
   INSTAGRAM_APP_SECRET=...
   ```
4. Under **Business login settings**, add the OAuth redirect URL `{APP_URL}/api/v1/oauth/instagram/callback`.
5. **Webhooks**: callback URL `{APP_URL}/api/v1/webhooks/meta`, verify token = any long random string, also set as `META_WEBHOOK_VERIFY_TOKEN`. Subscribe to fields `comments`, `messages`, `messaging_postbacks`, `messaging_seen`, `message_reactions`.
   Webhook payloads for Instagram Login apps are signed with the Instagram app secret; 2K Automation accepts either the Meta app secret or the Instagram app secret.
6. Add yourself as an Instagram tester (**App roles → Roles → Instagram testers**) and accept the invite in the Instagram app (Settings → Website permissions → Apps and websites). In development mode only testers can connect.
7. In 2K Automation: **Channels → Instagram → Connect**. The app exchanges the code for a 60-day long-lived token (stored encrypted), subscribes the account to webhooks and refreshes the token automatically (`channels:refresh-tokens`, daily).
8. **App Review** (required before other people's accounts can connect): request **Advanced Access** for `instagram_business_basic`, `instagram_business_manage_comments` and `instagram_business_manage_messages`. Provide a screencast showing: connecting an account, a comment keyword automation replying publicly, the private reply arriving, and the inbox. Complete **Business Verification** for the Meta business.

## 2. Facebook Messenger (Pages)

1. In the same Meta app, add **Facebook Login for Business** and **Messenger**.
2. Set `META_APP_ID` and `META_APP_SECRET` (App settings → Basic).
3. Valid OAuth redirect URI: `{APP_URL}/api/v1/oauth/facebook/callback`.
4. Messenger → Webhooks: callback `{APP_URL}/api/v1/webhooks/meta` with the same verify token; fields `messages`, `messaging_postbacks`, `message_deliveries`, `message_reads`, and Page `feed` for comments.
5. Connect from **Channels → Facebook Messenger**; choose the Pages to share. Page tokens obtained from a long-lived user token do not expire.
6. App Review: `pages_messaging`, `pages_manage_metadata`, `pages_read_engagement`, `pages_manage_engagement`, `pages_show_list`, `business_management`. Request **Human Agent** only if your team replies manually after 24 h — it may never be used for automated messages (enforced by `MessagingPolicy`).

## 3. WhatsApp Business (Cloud API)

1. In the Meta app add **WhatsApp**; create or attach a WhatsApp Business Account (WABA) and a phone number.
2. Quick path (your own number): create a **System User** in Business Settings with `whatsapp_business_management` + `whatsapp_business_messaging`, generate a permanent token, then in **Channels → WhatsApp** enter the *Phone number ID*, *WABA ID* and token.
3. For onboarding customers' numbers use **Embedded Signup v4** (v2/v3 are deprecated): create a Login for Business configuration and set `WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID`; the API endpoint `POST /api/v1/channels/whatsapp` accepts the returned `code`, `waba_id` and `phone_number_id`.
4. Webhooks: field `messages` on the WhatsApp product, same callback URL.
5. Create and get **message templates** approved in WhatsApp Manager; use the *Send WhatsApp template* step for messages outside the 24-hour window.

## 4. TikTok

What is officially possible today (see compliance doc §4): reading and replying to comments on the connected business account's **own videos** via the TikTok API for Business. Direct messages are allowlist-only and region-restricted, so 2K Automation never sends TikTok DMs. Use a public reply that points to your link in bio, Instagram or WhatsApp.

1. Apply at https://business-api.tiktok.com/portal → create an app requesting comment management scopes.
2. Set `TIKTOK_APP_ID`, `TIKTOK_APP_SECRET`; register redirect `{APP_URL}/api/v1/oauth/tiktok/callback` and webhook `{APP_URL}/api/v1/webhooks/tiktok`.
3. Endpoints marked **UNVERIFIED** in `ChannelConnector` / `TikTokClient` must be confirmed against the portal once access is granted.

## 5. Email

Add an SMTP provider in **Email → Providers** (Amazon SES, Resend, Postmark, Mailgun and others all offer SMTP). Campaigns only reach contacts with recorded marketing consent; every email includes a signed one-click unsubscribe link.

## 6. AI

Set `ANTHROPIC_API_KEY` (default model `claude-opus-5-5`) and/or `OPENAI_API_KEY` in `backend/.env`, or let each workspace add its own key in **AI Assistant**. Without a key, a built-in knowledge-base matcher answers and hands over when unsure.
