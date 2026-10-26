# 2K Automation: Platform Compliance and API Reference

Researched 2026-10-26 against official docs (developers.facebook.com, developers.tiktok.com).
Rule: official APIs only. No scraping, no unofficial APIs, no automated logins.
Anything not confirmed in an official doc page during research is marked **UNVERIFIED**.

---

## 0. Quick values (for code/config)

| Item | Value |
|---|---|
| Meta Graph API version | `v26.0` (shown as "Latest Graph API Version: v26.0" in Meta docs) |
| Instagram (Instagram Login) API host | `https://graph.instagram.com/v26.0` |
| Facebook / Messenger / WhatsApp / IG-with-FB-Login host | `https://graph.facebook.com/v26.0` |
| Meta webhook signature | Header `X-Hub-Signature-256: sha256=<hex>`; HMAC-SHA256 over the **raw request body**, key = **App Secret** |
| Meta webhook verify | GET `hub.mode=subscribe`, `hub.verify_token`, `hub.challenge` -> respond 200 with raw `hub.challenge` |
| TikTok OAuth token endpoint | `POST https://open.tiktokapis.com/v2/oauth/token/` |
| Throttling codes (Meta) | `4`, `17`, `32`, `613`, `80001`, `80002`, `80006`, `80008` (WA mgmt); WhatsApp-specific: see section 3 |

Make the Graph version a single config value (`META_GRAPH_VERSION=v26.0`); Meta versions roughly every quarter, and each version is supported for about 2 years (support window **UNVERIFIED** for v26.0 specifically).

---

## 1. Instagram (priority 1)

### 1.1 Which product
Use **Instagram API with Instagram Login** ("Business Login for Instagram"):
- Host `graph.instagram.com`, Instagram User access token, no Facebook Page needed.
- The account must be an Instagram **professional** account (Business or Creator).
- An app can use Facebook Login **or** Instagram Login for Instagram, not both (App Review page).
- Alternative: "Instagram API with Facebook Login" (host `graph.facebook.com`, needs a linked FB Page, Page token, `instagram_basic`, `instagram_manage_comments`, `instagram_manage_messages`, `pages_show_list`, `pages_read_engagement`, `pages_manage_metadata`). Pick this only if you want one token flow shared with Messenger.

### 1.2 OAuth (Instagram Login)

| Step | Endpoint |
|---|---|
| Authorize | `GET https://www.instagram.com/oauth/authorize?client_id=..&redirect_uri=..&response_type=code&scope=..&state=..` |
| Code -> short-lived token | `POST https://api.instagram.com/oauth/access_token` (form: `client_id`, `client_secret`, `grant_type=authorization_code`, `redirect_uri`, `code`) |
| Short -> long-lived (60 days) | `GET https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=..&access_token=..` |
| Refresh long-lived | `GET https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=..` |

- Long-lived token: 60 days (`expires_in` about 5183944 s). Refresh only if at least 24 h old and not expired; once expired it cannot be refreshed and the user must re-auth. Schedule refresh (for example every 30-45 days).
- Scopes (current names):
  - `instagram_business_basic`
  - `instagram_business_manage_comments`
  - `instagram_business_manage_messages`
  - `instagram_business_content_publish` (not needed for our core feature)
- Old names `business_basic`, `business_manage_comments`, `business_manage_messages`, `business_content_publish` were deprecated on 2025-01-27. Do not use them.

### 1.3 App Review / access level
- **Standard Access**: only accounts you own or manage and that have a role on the app. OK for dev and testing.
- **Advanced Access** (required for a SaaS serving other businesses, i.e. "Tech Provider"): needs App Review for each permission: `instagram_business_basic`, `instagram_business_manage_comments`, `instagram_business_manage_messages`, plus the **Human Agent** feature if used.
- Submission needs: at least one successful API call per permission, a screencast per permission showing the end-to-end flow (English UI preferred), a privacy policy URL, a 1024x1024 icon, a category, a business email, test instructions and credentials. Web is the only platform that supports Instagram Login.
- **Business verification**: not mentioned on the IG App Review page. Meta generally requires business verification for Advanced Access apps serving other businesses. **UNVERIFIED** for IG Login specifically; plan to complete it.

### 1.4 Webhooks
- Configure the callback URL and verify token in App Dashboard. Verification is a GET with `hub.mode=subscribe`, `hub.verify_token`, `hub.challenge`; echo `hub.challenge` with 200.
- Every POST is signed: `X-Hub-Signature-256: sha256=<hmac_sha256(raw_body, APP_SECRET)>`. Compare in constant time (`hash_equals`). Note: Meta computes the signature over the escaped-unicode payload. Always hash the raw bytes and never re-serialized JSON.
- **Subscribe each connected account** (per user, after OAuth):
  ```
  POST https://graph.instagram.com/v26.0/me/subscribed_apps
       ?subscribed_fields=comments,messages,messaging_postbacks
       &access_token=<IG_USER_TOKEN>
  -> {"success": true}
  ```
- Fields (Instagram Login) and required permissions:

| Field | Permissions |
|---|---|
| `comments` (also delivers @mentions) | `instagram_business_basic`, `instagram_business_manage_comments` |
| `live_comments` | same as comments |
| `messages`, `messaging_postbacks`, `messaging_optins`, `messaging_referral`, `messaging_seen`, `message_reactions`, `messaging_handover`, `standby` | `instagram_business_basic`, `instagram_business_manage_messages` |
| `message_echoes` | `instagram_business_basic` + manage_comments (as listed in the docs) |

- **Comment payload** (the IG examples page says that under Business Login `field`/`value` sit **directly on the entry**, not in `changes[]`; Facebook-Login-style payloads use `entry[].changes[]`. The sample below uses `changes[]`; support both shapes):
  ```json
  {"object":"instagram","entry":[{"id":"<IG_ACCOUNT_ID>","time":1730000000,
    "changes":[{"field":"comments","value":{
      "id":"<COMMENT_ID>",
      "from":{"id":"<IGSID>","username":"<USERNAME>"},
      "text":"LINK",
      "media":{"id":"<MEDIA_ID>","media_product_type":"REELS"},
      "parent_id":"<PARENT_COMMENT_ID if reply>"}}]}]}
  ```
  Parse defensively: accept both `entry[].changes[]` and `entry[].field/value`. `parent_id` presence is **UNVERIFIED** (expected on replies). `media_product_type` values: `FEED`, `REELS`, `STORY`, `AD` (exact enum **UNVERIFIED**).
- **Message payload**:
  ```json
  {"object":"instagram","entry":[{"id":"<IG_ACCOUNT_ID>","time":1730000000,
    "messaging":[{"sender":{"id":"<IGSID>"},"recipient":{"id":"<IG_ACCOUNT_ID>"},
      "timestamp":1730000000,"message":{"mid":"<MID>","text":"hi"}}]}]}
  ```
  Postback: `"postback":{"mid":"..","title":"<button title>","payload":"<payload>"}`.
  Echoes (`message.is_echo: true`) and self-comments (`from.id == account id`) must be ignored to avoid loops.

### 1.5 Sending (Instagram Login, host `graph.instagram.com/v26.0`, `Authorization: Bearer <IG_USER_TOKEN>`)

**(a) Public reply to a comment**
```
POST /{ig_comment_id}/replies
{"message":"Sent you a DM!"}
-> {"id":"<NEW_COMMENT_ID>"}
```
Limits: top-level comments only (a reply to a reply lands on the top-level thread); no replies to hidden comments; no replies on live video comments (use a private reply).

**(b) Private reply (comment -> DM)**
```
POST /{ig_account_id}/messages   (or /me/messages)
{"recipient":{"comment_id":"<COMMENT_ID>"},"message":{"text":"Here is your link: https://..."}}
-> {"recipient_id":"<IGSID>","message_id":"<MID>"}
```
**(c) Standard DM (inside the 24 h window)**
```
POST /{ig_account_id}/messages
{"recipient":{"id":"<IGSID>"},"message":{"text":"..."}}
```
Text must be UTF-8, at most 1000 bytes. Links go in `text`.

**(e) Buttons / quick replies**
- Quick replies: `message.quick_replies[]` with `{"content_type":"text","title":"<=20 chars","payload":".."}`. Max 13. Only `text` is supported (`user_email` and `user_phone_number` are disabled on IG).
- Button template: 
  ```json
  {"recipient":{"id":"<IGSID>"},"message":{"attachment":{"type":"template","payload":{
    "template_type":"button","text":"<=640 chars",
    "buttons":[{"type":"web_url","url":"https://..","title":"Open link"},
               {"type":"postback","title":"More","payload":"MORE"}]}}}}
  ```
  1-3 buttons; types `web_url` and `postback` only. A generic template is also available.
- Whether a button template is allowed as the **private reply** body on IG is **UNVERIFIED** (the Messenger private reply docs show a button template; the IG docs show text only). Default to text + URL for the private reply, then use buttons after the user replies.

### 1.6 Instagram policy rules (implement as hard guards)

| Rule | Value |
|---|---|
| Private reply deadline | Within **7 days** of comment creation (Live: only during the broadcast) |
| Private replies per comment | **Exactly one**. Store `comment_id` as unique and never retry after success. |
| After the private reply | No further messages until the user replies. Their reply opens a **24 h** standard window. |
| Standard window | 24 h from the user's last message/action (up to 7 days for a first message from Click-to-Direct ads) |
| Human Agent | Separate **7-day** window for *human* responses only (requires the Human Agent feature via App Review). Never use it for bot/automated messages. |
| Message tags on IG | Only Human Agent is relevant. Some tags are Messenger-only. |
| Private reply rate limit | **750 calls/hour per IG account** for post/reel comments; 100/s for Live comments |
| Send API rate limit | 100 calls/s per account for text/links/reactions/stickers; 10/s audio/video (a conflicting doc figure says 300/s, so use 100) |
| Conversations API | 2 calls/s per account |
| Platform BUC (non-messaging) | Calls/24h = 4800 x number of impressions |
| Group messaging | Not supported |
| Requests folder | Threads inactive >30 days are not returned |

Product-level do-nots (Meta Platform Terms + messaging policy; **follow-gating** is not named explicitly in the docs we read, so treat it as **UNVERIFIED but high risk**; do not ship "must follow to get link" checks):
- No messaging users who never interacted (no cold DMs, no bulk DM to followers).
- No automated messages outside the 24 h window, and no tag abuse.
- No sending private replies to comments older than 7 days or more than once.
- No automation of logins, likes, follows, or story viewing. Story mention/reply DMs are user-initiated messages and can be answered normally (story features **UNVERIFIED** for our scope).
- Disclose automation where required by law (recommended always).

Sources:
- https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login
- https://developers.facebook.com/docs/instagram-platform/private-replies
- https://developers.facebook.com/documentation/instagram-platform/webhooks/setup
- https://developers.facebook.com/documentation/instagram-platform/webhooks/fields
- https://developers.facebook.com/documentation/instagram-platform/webhooks/examples
- https://developers.facebook.com/documentation/instagram-platform/comment-moderation.md
- https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/messaging-api.md
- https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/messaging-api/quick-replies.md
- https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/messaging-api/button-template.md
- https://developers.facebook.com/documentation/instagram-platform/app-review.md
- https://developers.facebook.com/docs/graph-api/overview/rate-limiting

---

## 2. Facebook Messenger (priority 2)

### 2.1 Product and OAuth
Messenger Platform with **Facebook Login for Business** -> Page access token.

| Step | Endpoint |
|---|---|
| Login dialog | `https://www.facebook.com/v26.0/dialog/oauth?client_id=..&redirect_uri=..&state=..&scope=..` (FB Login for Business can use `config_id` instead of `scope`) |
| Code -> user token | `GET https://graph.facebook.com/v26.0/oauth/access_token?client_id=..&redirect_uri=..&client_secret=..&code=..` |
| Long-lived user token (~60 days) | `GET https://graph.facebook.com/v26.0/oauth/access_token?grant_type=fb_exchange_token&client_id=..&client_secret=..&fb_exchange_token=..` |
| Page tokens | `GET https://graph.facebook.com/v26.0/{user-id}/accounts` with a long-lived user token -> long-lived Page tokens **do not expire** |
| Debug token | `GET https://graph.facebook.com/debug_token?input_token=..&access_token=<app_token>` |

Scopes: `pages_show_list`, `pages_manage_metadata`, `pages_messaging`, `pages_read_engagement`, `business_management`; plus `pages_manage_engagement` (public comment replies) and `pages_read_user_content` (reading comments; requirement **UNVERIFIED**). The user must be able to perform the `MESSAGING` and `MODERATE` tasks on the Page. All of these need **Advanced Access via App Review** plus **Business Verification** for a multi-tenant app (business verification requirement: standard Meta practice, **UNVERIFIED** on the pages read).

### 2.2 Webhooks
- Same handshake and `X-Hub-Signature-256` HMAC-SHA256 (App Secret).
- Subscribe each Page: `POST https://graph.facebook.com/v26.0/{page-id}/subscribed_apps?subscribed_fields=messages,messaging_postbacks,feed&access_token=<PAGE_TOKEN>`.
- Messaging fields: `messages`, `messaging_postbacks`, `message_reactions`, `message_reads`, `message_deliveries`, `message_echoes`, `message_edits`, `messaging_referrals`, `messaging_seen`, `messaging_handovers`, `standby`.
- **Page comments arrive on the `feed` field** (requires `pages_manage_metadata` granted by a Page admin with MODERATE):
  ```json
  {"object":"page","entry":[{"id":"<PAGE_ID>","time":1730000000,"changes":[{"field":"feed","value":{
    "item":"comment","verb":"add","comment_id":"<COMMENT_ID>","post_id":"<PAGE_POST_ID>",
    "parent_id":"<POST_OR_COMMENT_ID>","from":{"id":"<USER_ID>","name":".."},
    "message":"LINK","created_time":1730000000}}]}]}
  ```
- Message payload: `object:"page"`, `entry[].messaging[]` with `sender.id` (PSID), `recipient.id` (Page ID), `timestamp`, `message.mid`, `message.text` (same shape as IG).

### 2.3 Sending (`https://graph.facebook.com/v26.0`, Page token)
- (a) Public reply: `POST /{comment-id}/comments` `{"message":".."}` -> `{"id":".."}` (needs `pages_manage_engagement`, MODERATE task).
- (b) Private reply: `POST /{page-id}/messages` `{"recipient":{"comment_id":"<COMMENT_ID>"},"message":{...}}` (or `recipient.post_id` for visitor posts). Button template is allowed in the body (shown in docs).
- (c) DM: `POST /{page-id}/messages` `{"recipient":{"id":"<PSID>"},"messaging_type":"RESPONSE","message":{"text":".."}}`.
- Human Agent: `{"recipient":{"id":"<PSID>"},"messaging_type":"MESSAGE_TAG","tag":"HUMAN_AGENT","message":{...}}`. The literal strings `MESSAGE_TAG`/`HUMAN_AGENT` were not visible on the fetched pages (**UNVERIFIED** literal, long-standing values).
- (e) Quick replies (`message.quick_replies[]`, max 13, title up to 20 chars, **UNVERIFIED** for Messenger), button template (1-3 buttons), generic template, persistent menu.

### 2.4 Policy
| Rule | Value |
|---|---|
| Standard window | 24 h after a user action (up to 7 days after a Click-to-Messenger ad first message). Promotional content is allowed inside the window. |
| Private reply | 1 message per comment/visitor post, within 7 days. You can continue only after the user responds (then 24 h window). |
| Tags | **`CONFIRMED_EVENT_UPDATE`, `ACCOUNT_UPDATE`, `POST_PURCHASE_UPDATE` return error 100 starting 2026-04-27.** Do not use them. Human Agent (7 days, human only) remains. |
| Outside window alternatives | Sponsored Messages (paid, Messenger only), One-Time Notification (Beta, user opt-in, single use, token valid up to 1 year; availability **UNVERIFIED**) |
| Responsiveness (automated bots) | Must respond to **all** user input and respond **within 30 seconds** |
| Disclosure | Disclose automated service where law requires it (recommended always) |
| Enforcement | Violation notices go to the Page Support Inbox. Messaging is limited if not fixed within 7 days. |
| Rate limits | Send API 300 calls/s per Page (text/links), 10/s audio/video; Messenger BUC calls/24h = 200 x engaged users; Conversations API 2/s per Page; Pages BUC 4800 x engaged users / 24 h |
| Send errors | `10` permission (check `pages_messaging`), `100` invalid param, `190` token expired, `551` / `1545041` user unavailable (blocked or deactivated), `613` rate limit |

Sources:
- https://developers.facebook.com/docs/messenger-platform/send-messages/
- https://developers.facebook.com/documentation/business-messaging/messenger-platform/send-messages.md
- https://developers.facebook.com/docs/messenger-platform/discovery/private-replies
- https://developers.facebook.com/documentation/business-messaging/messenger-platform/policy.md
- https://developers.facebook.com/documentation/business-messaging/messenger-platform/webhooks.md
- https://developers.facebook.com/documentation/business-messaging/messenger-platform/overview
- https://developers.facebook.com/docs/graph-api/webhooks/reference/page/
- https://developers.facebook.com/docs/graph-api/reference/object/comments/
- https://developers.facebook.com/docs/facebook-login/guides/advanced/manual-flow
- https://developers.facebook.com/docs/facebook-login/guides/access-tokens/get-long-lived

---

## 3. WhatsApp Business (Cloud API) (priority 3)

### 3.1 Product and onboarding
- WhatsApp **Cloud API** (Meta-hosted). As a SaaS we act as a **Tech Provider** and onboard customers with **Embedded Signup**. Tech Providers use **business tokens** exclusively.
- Embedded Signup: `FB.login({config_id, response_type:'code', override_default_response_type:true})` with the JS SDK at `v26.0`. It returns the WABA ID, phone number ID, and an exchangeable `code` (**30-second TTL**, exchange immediately server-side via `GET /v26.0/oauth/access_token?client_id&client_secret&code`; exchange endpoint **UNVERIFIED** for ES v4).
- **Embedded Signup v2 and v3 are deprecated on 2026-10-15. Implement v4.**
- Post-signup server calls:
  1. Subscribe the app to the WABA: `POST /v26.0/{WABA_ID}/subscribed_apps` (Bearer business token).
  2. Register the number: `POST /v26.0/{PHONE_NUMBER_ID}/register` `{"messaging_product":"whatsapp","pin":"123456"}` (6-digit 2-step PIN). Skip this for numbers coexisting with the WhatsApp Business app.
- Permissions: `whatsapp_business_management`, `whatsapp_business_messaging` (plus `business_management`). Advanced Access, App Review, Business Verification, and becoming a Tech Provider are required (exact names per https://developers.facebook.com/documentation/business-messaging/whatsapp/permissions.md, page not fetched, so **UNVERIFIED** detail).
- Subscribe to the `account_update` webhook (fires on completed signup).

### 3.2 Webhooks
- Same handshake. `X-Hub-Signature-256: sha256=<hmac_sha256(raw_body, APP_SECRET)>`.
- Object `whatsapp_business_account`. Field `messages` (inbound messages **and** statuses), plus `message_template_status_update`, `account_update`, etc.
  ```json
  {"object":"whatsapp_business_account","entry":[{"id":"<WABA_ID>","changes":[{"field":"messages","value":{
    "messaging_product":"whatsapp",
    "metadata":{"display_phone_number":"..","phone_number_id":"<PHONE_NUMBER_ID>"},
    "contacts":[{"profile":{"name":".."},"wa_id":"<WA_ID>"}],
    "messages":[{"from":"<WA_ID>","id":"wamid..","timestamp":"1730000000","type":"text","text":{"body":"LINK"}}]}}]}]}
  ```
  Status updates come in `value.statuses[]` (sent/delivered/read/failed).

### 3.3 Sending: `POST https://graph.facebook.com/v26.0/{PHONE_NUMBER_ID}/messages`, Bearer token
- Free-form text (only inside the 24 h customer service window):
  ```json
  {"messaging_product":"whatsapp","recipient_type":"individual","to":"+16505551234",
   "type":"text","text":{"preview_url":true,"body":"Here is your link: https://..."}}
  ```
  Body max 4096 chars.
- Template (required outside the window; must be an approved template):
  ```json
  {"messaging_product":"whatsapp","to":"+16505551234","type":"template",
   "template":{"name":"link_delivery","language":{"code":"en_US"},
     "components":[{"type":"body","parameters":[{"type":"text","text":"https://..."}]}]}}
  ```
  (`name` and `language` confirmed as required. The `components` shape is long-standing but **UNVERIFIED** on fetched pages.)
- Interactive reply buttons (in window): up to **3** reply buttons. `{"type":"interactive","interactive":{"type":"button","body":{"text":".."},"action":{"buttons":[{"type":"reply","reply":{"id":"a","title":".."}}]}}}`. List messages up to 10 rows (**UNVERIFIED**). `cta_url` interactive type is **UNVERIFIED** (not in fetched schema enum).

### 3.4 Policy
| Rule | Value |
|---|---|
| Customer service window | 24 h from the user's last message **or call**, reset on each new message |
| Outside window | **Only pre-approved templates** (categories: marketing, utility, authentication). Pricing is per template message by category. |
| Template review | Up to 24 h |
| Marketing caps | Per-user marketing template limits apply (Meta can silently not deliver) |
| Opt-in | Must have the user's opt-in before business-initiated (template) messages (WhatsApp Business Policy) |
| Message TTL | 30 days (auth templates 10 min) |
| Throttling | BUC `80008` (management API). Cloud API send errors `130429` (throughput), `131056` (pair rate limit), `131047` (re-engagement: >24 h, template needed), `131026` (undeliverable). **UNVERIFIED** on fetched pages (long-standing codes). Default throughput is about 80 msg/s per number (**UNVERIFIED**). |
| Comment trigger | WhatsApp has no public comments. Triggers are inbound keywords, click-to-WhatsApp ads, `wa.me` links/QR codes. |

Sources:
- https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages
- https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview
- https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/create-webhook-endpoint.md
- https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples
- https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/implementation.md
- https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/get-started-for-tech-providers
- https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing
- https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/marketing-templates/per-user-limits/

---

## 4. TikTok (priority 4)

### 4.1 What is officially available (honest summary)

| Capability | Status |
|---|---|
| Login Kit / Display API (developers.tiktok.com) | Available. Read user profile and the user's own videos. **No comment read/reply, no DMs.** |
| Content Posting API | Available (publish videos). Not needed for the core feature. |
| Comments on a business account's own videos | Exposed via **TikTok API for Business** (business-api.tiktok.com, "Accounts"/Business API: list comments, reply, hide, delete for TikTok Business Accounts). Exact paths (believed `/open_api/v1.3/business/comment/list/` and `/business/comment/reply/create/`) and scopes (`comment.list`, `comment.list.manage`) are **UNVERIFIED**: the portal was not fetchable/indexed during research. Access requires an approved developer app on TikTok for Business. |
| Comment webhooks (real time) | **UNVERIFIED**. Plan for polling with backoff if no webhook is granted. |
| Direct messages: **Business Messaging API** | Partner/allowlist access, region-limited. Third-party integrators (Infobip, Chatwoot, Wati) report it is **not available for accounts registered in the US, EEA, Switzerland, UK** (and India per Wati). Conversations must be **user-initiated**. Reported window is 48 h with limited message counts (Qiscus: 10 messages per 48 h, text/image only). **All UNVERIFIED** from official TikTok docs. |
| "Comment -> private DM" equivalent (like IG private replies) | **Not available** in any official TikTok API we could confirm. |

### 4.2 OAuth (Login Kit v2)
- Authorize: `https://www.tiktok.com/v2/auth/authorize/?client_key=..&scope=..&response_type=code&redirect_uri=..&state=..` (**UNVERIFIED**, not on the fetched page; PKCE required for mobile/desktop).
- Token: `POST https://open.tiktokapis.com/v2/oauth/token/` (form: `client_key`, `client_secret`, `code`, `grant_type=authorization_code`, `redirect_uri`).
- Refresh: same endpoint, `grant_type=refresh_token`, `refresh_token`.
- Lifetimes: access token **24 h**; refresh token **365 days**.
- Login Kit scopes: `user.info.basic`, `video.list`, `video.publish`/`video.upload` (names **UNVERIFIED** here).
- TikTok for Business OAuth (for comments/messaging): separate portal auth (`business-api.tiktok.com/open_api/v1.3/tt_user/oauth2/token/`, **UNVERIFIED**).

### 4.3 Webhooks
- developers.tiktok.com webhooks: header `TikTok-Signature: t=<timestamp>,s=<signature>`, HMAC-SHA256 of `"{t}.{raw_body}"` keyed with the **client secret**. Reject stale timestamps. **UNVERIFIED** (from prior knowledge, not re-confirmed). Documented events relate to authorization removal and video publish, **not comments or DMs** (**UNVERIFIED**).

### 4.4 Compliant alternatives for the "comment LINK" flow on TikTok
1. If Business API comment access is approved: poll the comments on the creator's own videos, then post a **public comment reply** ("Check the link in our bio / DM us 'LINK'"). No auto-DM.
2. Push users to a channel that allows the DM: "Comment LINK, or DM us LINK" (if Business Messaging is enabled in the region, reply to the inbound DM), or send them to a link-in-bio landing page, IG, or WhatsApp `wa.me` link.
3. Manual-assist mode: show matched comments in our inbox and let a human reply in the TikTok app (no automation of the TikTok client).
4. Never: scrape comments, use unofficial/private endpoints, or automate logins/browsers.

Sources:
- https://developers.tiktok.com/doc/oauth-user-access-token-management
- https://developers.tiktok.com/doc/login-kit-web (authorize URL, UNVERIFIED)
- https://developers.tiktok.com/doc/webhooks-overview (UNVERIFIED)
- https://business-api.tiktok.com/portal/docs (Business API; not fetchable during research)
- Third-party (non-authoritative): https://www.infobip.com/docs/tiktok, https://developers.chatwoot.com/self-hosted/configuration/features/integrations/tiktok, https://documentation.qiscus.com/omnichannel-chat/tiktok-direct-message

---

## 5. Email (priority 5)

| Requirement | Implementation |
|---|---|
| Consent | Collect explicit opt-in (unchecked checkbox) when capturing an email from a DM/landing page. Store timestamp, source (e.g. `ig_comment:<id>`), IP/user agent, and the consent text version. |
| Double opt-in | Recommended (strongly for EU/UK, Germany in practice): send a confirmation link and only mark `subscribed` after the click. |
| Transactional vs marketing | The one-off "here is the link you asked for" email is transactional. Any follow-up nurture is marketing and needs consent. |
| CAN-SPAM (US) | Accurate From/Subject, identify as an ad where applicable, **physical postal address**, clear unsubscribe that works for at least 30 days, honor it within **10 business days**, no charge or login to unsubscribe. |
| GDPR / UK GDPR / ePrivacy | Lawful basis (consent for marketing), privacy notice link, right to access/erase, data processing agreement with the ESP, record of consent, withdrawal as easy as giving consent. |
| CASL (Canada) | Express consent, sender ID, unsubscribe processed within 10 business days. |
| Deliverability (Gmail/Yahoo bulk sender rules) | SPF, DKIM, DMARC on the sending domain; **one-click unsubscribe** (`List-Unsubscribe` + `List-Unsubscribe-Post: List-Unsubscribe=One-Click`, RFC 8058); keep spam rate under 0.3%. |
| Suppression | Global suppression list (unsubscribes, hard bounces, complaints) checked before every send. |

Sources: https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business, https://gdpr-info.eu/art-7-gdpr/ (conditions for consent), https://support.google.com/a/answer/81126 (Gmail sender guidelines), RFC 8058.

---

## 6. Cross-platform implementation checklist (2K Automation)

1. **Webhook controller**: verify the signature over raw body first (Laravel: `$request->getContent()`), return 200 fast, and queue processing. Handle duplicates by idempotency key (`comment_id` / `mid` / `wamid`). Meta retries failed deliveries.
2. **Private-reply guard**: `private_replies(comment_id UNIQUE, sent_at)`; refuse if `now - comment.created_time > 7d` or a row exists.
3. **Window tracker** per contact per channel: `last_inbound_at`; allow free-form only if within 24 h (WA: 24 h customer service window; IG/FB: 24 h standard window); otherwise block (IG/FB) or require a template (WA).
4. **Loop prevention**: ignore echoes, own comments, and own replies.
5. **Rate limiter** per account: IG private replies 750/h, IG Send 100/s, Messenger Send 300/s; read the `X-App-Usage` / `X-Business-Use-Case-Usage` headers. On codes `4, 17, 32, 613, 80001, 80002, 80006` use exponential backoff (honor `estimated_time_to_regain_access` in BUC headers).
6. **Token jobs**: refresh IG tokens before 60 days; detect `190` -> mark the connection as `needs_reauth`.
7. **Feature flags per platform/region** (TikTok DMs off by default; enable only after official approval).
8. **No follow-gating, no cold DMs, no tag abuse, no login automation.** Keep automation disclosure text in the default flows.
