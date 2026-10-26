# Architecture

## Request flow

```
Browser ──► Next.js (src/app/api/backend/[...path]) ──► Laravel /api/v1
             adds Authorization from httpOnly cookie
             adds X-Workspace-Id from workspace cookie
```

The Sanctum token lives only in an httpOnly, SameSite=Lax cookie set by `src/app/api/auth/[action]`. Browser JavaScript never sees it. `src/proxy.ts` performs optimistic redirects; Laravel is the authority.

## Tenancy & permissions

Every tenant table carries `workspace_id`. `ResolveWorkspace` middleware resolves the workspace from the header (or the user's current workspace), verifies membership and exposes the role. Controllers always query through `Model::forWorkspace()`. Role abilities live in `App\Enums\WorkspaceRole` (owner › admin › editor › agent › viewer) and are mirrored in `frontend/src/hooks/use-session.ts` to hide UI.

## Automation engine

```
POST /webhooks/meta ─ verify X-Hub-Signature-256 (HMAC-SHA256, constant time)
  └► MetaPayloadNormalizer → InboundEvent[] (one per comment/message/postback/status)
       └► WebhookRecorder: insert webhook_events (dedupe_key UNIQUE) → ProcessWebhookEvent job
            └► EventIngestor
                 ├ contact / post / comment / conversation / message upserts
                 ├ waiting run for this contact? → FlowExecutor::resume(input)
                 ├ TriggerMatcher (priority, keywords, post scope, once-per-contact)
                 │    └► FlowExecutor::start → ExecuteAutomationRun job
                 └ else AI auto-reply (if enabled) → AutoReplyService
```

**FlowExecutor** walks the React Flow graph stored on the automation. After each node it persists `current_node_id` and writes an `automation_run_steps` row, so a retried job resumes exactly where it stopped. A cache lock prevents concurrent advancement of the same run. Node results are `next(handle)`, `blocked`, `failed`, `wait(delay|reply|email)` or `end`. Delays are delayed jobs plus `automations:resume-due` (every minute) as a safety net; reply waits time out through the same command.

**Node types:** trigger, reply_comment, send_message, send_template, collect_email, ai_reply, condition (true/false), split (a/b), delay, add_tag, remove_tag, set_field, send_email, handover, end.

## Messaging policy (compliance core)

All outbound traffic goes through `MessageDispatcher`, which records a `messages` row and consults `MessagingPolicy` before any API call:

| Situation | Decision |
|---|---|
| Contact messaged in the last 24 h | standard response |
| Run came from a comment, no open window, no private reply yet, comment < 7 days | private reply (`recipient.comment_id`), comment marked |
| Private reply already used | blocked until the person replies |
| Manual reply by a teammate 24 h–7 d after last message (IG/FB) | `HUMAN_AGENT` tag; never for automation or AI |
| WhatsApp outside 24 h | blocked → approved template required |
| TikTok DM | blocked (not available to third-party apps) |
| Contact unsubscribed / channel expired | blocked |

Blocked messages are stored with the reason and shown in the run log, inbox and analytics. Private replies are throttled below Instagram's 750/hour cap.

## Reliability

* Webhook dedupe via a unique `dedupe_key`; comments and messages also unique by external id.
* Graph error codes map to `rate_limited | transient | auth | policy | invalid`. Rate limits and transient errors release the job with the platform's delay; auth errors flip the channel to `expired`.
* Queues: `webhooks` (latency-critical), `automations`, `email`.
* Every outbound message, block reason and failure is persisted; `webhook_events` keeps the outcome for the health dashboard.

## Security

* Access tokens, AI keys and SMTP credentials use Laravel's `encrypted` casts (AES-256, `APP_KEY`) and are `#[Hidden]` from serialisation.
* OAuth `state` is single-use, bound to workspace + user, 15-minute TTL.
* Rate limiters: auth (per IP + email), API, AI, webhooks.
* Audit log for logins, team changes, channel connections, automation lifecycle, consent changes, exports and erasure.
* GDPR: contact export (CSV) and erasure; append-only consent ledger with evidence; signed unsubscribe links.

## Simulation mode

`Simulator` creates a simulated Instagram channel and constructs **real Meta-shaped webhook payloads** that pass through the exact production pipeline. `PlatformClientFactory` returns `SimulatedClient` for simulated channels, so nothing reaches Meta. Simulated rows carry `is_simulated = true`, are badged in the UI and are excluded from analytics by default.
