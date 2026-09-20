# Backend Audit Report — ReachInbox Email Job Scheduler

**Important scope note:** This audit was performed on the contents of `Scheduler_Backend.zip` as uploaded to this chat, not on `D:\Full Stack Email Job Schedular` on your local machine — I have no access to your filesystem. The zip contains a **backend-only** codebase (no frontend, no Google OAuth, no `node_modules`, no `.git`, no README, no tests). All findings below are scoped to this backend. Where the audit prompt asked for tests I could not physically run, they are marked BLOCKED with exactly what's needed from you.

All "confirmed"/"tested" claims below were produced by actually installing dependencies, building the project, and running it against **real local Redis and PostgreSQL instances** in this sandbox (not Docker — apt-installed). Elasticsearch could not be installed in this sandbox (no Docker, no access to Elastic's package registry), so ES-specific live tests are BLOCKED here, but the *impact* of ES being unavailable was still testable (and led to two real bug findings below).

---

## 1. Executive Summary

The backend is small (688 lines of TypeScript across 14 files) and covers the core of the assignment competently: BullMQ delayed jobs (no cron), Redis-backed atomic rate limiting and spacing, Postgres-backed idempotency, multi-sender support, a real Slack `chat.postMessage` call (not a log line), Elasticsearch indexing, and a live Bull Board dashboard. Restart persistence and idempotency-under-race were both **directly tested and confirmed working**.

However, three real bugs were found through live testing (not static reading), and there is a critical, tested security gap: **the API has no authentication at all** — tenant isolation is a client-supplied header that anyone can forge. There is also no README, no tests, and no lockfile in the delivered zip, which the assignment explicitly requires as submission deliverables.

## 2. Current Architecture (as found)

```
Client (Postman / future frontend)
   │  HTTP + x-tenant-id header (no auth)
   ▼
Express app (src/server.ts)
   │  helmet, cors(), json body parser, pino-http logging
   ▼
tenantMiddleware  →  router (src/routes/index.ts)
   │
   ├── POST /api/emails ─────► controllers/emails.ts ──► Postgres (emails table)
   │                                                  └─► scheduleEmailJob() ──► BullMQ delayed job (Redis)
   │                                                  └─► indexEmail() (awaited, blocking) ──► Elasticsearch
   │
   ├── GET  /api/emails, /api/emails/search, /api/senders
   ├── GET  /api/slack/connect, /callback, /status, POST /disconnect ──► Slack OAuth v2 + Postgres (slack_connections)
   │
   └── /admin/queues ──► Bull Board (read-only queue dashboard, no auth on the route itself)

Worker (same process, started in server.ts main()):
   BullMQ Worker (concurrency = WORKER_CONCURRENCY)
     → fetch email + sender from Postgres
     → reserveHourly() [Redis Lua script]   → if blocked: moveToDelayed(next hour), also fires Slack notice once/window
     → reserveSpacing() [Redis Lua script]  → if blocked: moveToDelayed(spacing slot)
     → claimEmail() [Postgres UPDATE ... WHERE status='SCHEDULED']
     → nodemailer.sendMail() via Ethereal SMTP
     → update Postgres status (SENT/FAILED) + indexEmail() to Elasticsearch
```

**Key architectural fact confirmed by testing:** the API server and the BullMQ worker run **in the same Node process** (`main()` calls both `startWorker()` and `app.listen()`). There is no separate worker process in this codebase, so "API restart" and "worker restart" are the same event here — I could only test them together, not independently.

Integrations detected: PostgreSQL (`pg`), Redis (`ioredis`, used both directly and via BullMQ), Elasticsearch (`@elastic/elasticsearch`), Slack OAuth v2 + Web API (raw `fetch`, no SDK), Bull Board (`@bull-board/express`). **No Google OAuth exists anywhere in this backend** — that's expected, since Google login is a frontend requirement and this zip is backend-only, but it also means the API itself has zero identity verification (see §19/§20).

## 3. Technology Stack Detected

| Layer | Tech | Version (package.json) |
|---|---|---|
| Language | TypeScript | ^5.9.2, strict mode on |
| Framework | Express | ^5.1.0 |
| Queue | BullMQ | ^5.58.5 |
| Redis client | ioredis | ^5.7.0 |
| DB | PostgreSQL via `pg` | ^8.16.3 |
| Validation | Zod | ^4.1.5 |
| SMTP | Nodemailer | ^7.0.6 |
| Search | @elastic/elasticsearch | ^9.1.1 |
| Dashboard | @bull-board/express + api | ^6.15.1 |
| Security headers | helmet | ^8.1.0 |
| Logging | pino-http | ^10.5.0 |

No `package-lock.json` was included in the zip (only `package.json`), so exact transitive versions aren't pinned/reproducible from what was submitted.

## 4. File/Folder Structure

```
.env.example, package.json, tsconfig.json
src/
  config/env.ts        — Zod-validated env, sender config parsing
  db/pool.ts, schema.sql, seed.ts
  lib/redis.ts, elasticsearch.ts
  middleware/tenant.ts
  queue/queue.ts        — Queue, Worker, send logic, rate/spacing calls
  services/rate-limit.ts, slack.ts, email-indexer.ts
  controllers/emails.ts, slack.ts
  routes/index.ts
  server.ts
  types/express.d.ts
```
No `tests/`, no `README`, no `Dockerfile`/`docker-compose.yml`, no `.gitignore` in the zip.

## 5. Requirement Compliance Matrix

| Requirement | Status | Evidence | Problem | Test Needed |
|---|---|---|---|---|
| TypeScript | ✅ PASS | `tsc --noEmit` and `tsc` both ran clean in this sandbox | — | — |
| Express.js | ✅ PASS | `src/server.ts` | — | — |
| BullMQ + Redis, delayed jobs | ✅ PASS | `queue.ts`; confirmed live: created job with `delay`, observed `state: delayed` in Redis | — | — |
| No cron | ✅ PASS | `grep -rn "cron\|agenda\|setInterval"` across all `.ts` returned nothing | — | — |
| PostgreSQL | ✅ PASS | `db/pool.ts`, `schema.sql`; queries run successfully against a real local Postgres | — | — |
| Ethereal SMTP | 🔵 BLOCKED (partial) | `nodemailer.createTransport(...)` code is correct and standard | Could not complete a real send: `smtp.ethereal.email` isn't reachable from this sandbox's network egress | Real Ethereal creds + a sandbox/machine with SMTP egress, or you run it locally |
| Restart persistence | ✅ PASS — **actually tested** | Scheduled a job, `kill -9`'d the server before it fired, confirmed job stayed `delayed` in Redis + DB row untouched, restarted after the due time, job was picked up exactly once (`attempts: 1`, no duplicate row) | Note: API+worker share one process here, so this also stands in for "worker restart" | — |
| No duplication/idempotency | ✅ PASS — **actually tested** | Fired 5 simultaneous POSTs with the same idempotency key: 1×201 + 4×200, exactly one DB row (`UNIQUE(tenant_id, idempotency_key)` + `ON CONFLICT DO NOTHING`, BullMQ `jobId = emailId`) | Retry-path bug below can misreport failures as successes (see §11) — doesn't cause double-send, but misleads monitoring | — |
| Multiple senders | ✅ PASS | `senders` table, per-row SMTP creds, `sender_id` on every email/job/rate-key | Isolation verified structurally; not verified with a real second Ethereal send (network-blocked) | Real Ethereal creds for 2 accounts |
| Worker concurrency, configurable | ✅ PASS | `WORKER_CONCURRENCY` env → `Worker(..., { concurrency })` | — | — |
| Min delay between sends | ✅ PASS — **actually tested** | Ran the exact spacing Lua script 20× concurrently via raw `redis-cli EVAL`: results were perfectly monotonic, exactly 500 ms apart, zero collisions | — | — |
| Configurable hourly rate limit | ✅ PASS | `MAX_EMAILS_PER_HOUR` / `RATE_LIMIT_WINDOW_SECONDS` env, `reserveHourly()` | — | — |
| Distributed-safe rate limiting | ✅ PASS — **actually tested** | Ran the exact rate-limit Lua script 50× concurrently against a limit of 10: exactly 10 allowed / 40 denied, final counter = 50 (no lost updates). End-to-end test with `MAX_EMAILS_PER_HOUR=2` and 5 real jobs: exactly 2 went `PROCESSING`, 3 were `moveToDelayed` to the next hour | The classic "both read 199" race genuinely does not happen here — Redis `INCR` inside a Lua script is atomic | — |
| Rate limit hit → reschedule, not drop | ✅ PASS — **actually tested** | Same test as above: delayed jobs showed `delay ≈ 3.5M ms` (next hour window), status stayed `SCHEDULED`, nothing failed or vanished | — | — |
| Slack OAuth authorize/callback | 🟡 PARTIAL / 🔵 BLOCKED | Real `slack.com/oauth/v2/authorize` redirect + real `oauth.v2.access` token exchange code exists and is structurally correct (HMAC-signed state, `timingSafeEqual`) | Never exercised end-to-end — needs a real Slack app | `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_REDIRECT_URI` (see §23) |
| Real Slack message on rate-limit hit | 🟡 PARTIAL / 🔵 BLOCKED | Code makes a real `chat.postMessage` call (not a log line) via `conversations.list` → pick a channel → `chat.postMessage`; the "notify once per window" gate (`SET NX`) was confirmed to fire correctly in the live rate-limit test above, and it safely no-op'd because no Slack connection existed (no crash) | Actual delivery to a real Slack workspace not verified | Real Slack app + bot in a test workspace |
| Slack disconnect/reconnect without redeploy | ✅ PASS (structural) | `status` column toggled `CONNECTED`/`DISCONNECTED`; `sendSlackRateLimitNotice` checks status live on every call | Not tested with a real reconnect flow | Real Slack creds |
| Elasticsearch indexing/search | 🟡 PARTIAL / 🔵 BLOCKED | Indexing and search endpoint code is present and structurally sound | Could not run a real ES instance in this sandbox (no Docker access) to prove documents actually land and are searchable. Also: **ES being down crashes the whole server on boot** and **blocks email creation for ~9s per request** — see Bugs §24 | A running Elasticsearch (Docker `docker-compose up elasticsearch` on your machine, or credentials for a hosted instance) |
| Live BullMQ dashboard | ✅ PASS — **actually tested** | `curl -o /dev/null -w "%{http_code}" /admin/queues` → `200`; confirmed jobs (active/delayed) reflected the real queue state | Dashboard route has **no authentication** — anyone who can reach the port can see all queue contents | — |
| Handle 1000+ jobs around the same time | 🟡 PARTIAL | Fired 100 concurrent `POST /api/emails` (proxy test, not the full 1000+): all 100 returned `201`, all 100 landed correctly as delayed BullMQ jobs, DB count matched exactly (100/100), no drops/dupes. Took ~10.3s for 100, largely due to the ES-blocking bug above | Did not literally test 1000 in this sandbox due to time/SMTP constraints; no structural reason 1000 would behave differently, but not proven | Time to run a genuine 1000-job burst on your machine (with ES reachable, since ES latency scales with request count per the bug found) |
| Authentication / Authorization | ❌ FAIL — **actually tested** | Set an arbitrary `x-tenant-id: rl-tenant2` header with no credentials at all → full read access to that tenant's emails. No header at all → silently defaults to `demo-tenant` and still works | Anyone can read or write any tenant's data by guessing/setting a header. This is a genuine, critical gap regardless of where Google OAuth ends up living (frontend) | — |
| Google OAuth (frontend req, backend has none) | ⚪ NOT IMPLEMENTED (out of scope for this zip) | No auth routes at all in this backend | This backend performs zero identity verification on any endpoint | — |

## 6. API Inventory

| Method | Route | Purpose | Auth | Validation | DB | Queue | Status |
|---|---|---|---|---|---|---|---|
| GET | `/api/health` | liveness | none | — | no | no | ✅ tested, `200 {ok:true}` |
| GET | `/api/senders` | list enabled senders | none | — | yes | no | ✅ tested |
| POST | `/api/emails` | schedule an email | none (tenant header only) | Zod (`idempotencyKey`, email format, min lengths, future date) | yes | yes | ✅ tested incl. race/idempotency |
| GET | `/api/emails` | list by tenant + optional status | none | none on `status` query value (no enum check) | yes | no | ✅ tested |
| GET | `/api/emails/search` | Elasticsearch full-text search | none | requires non-empty `q` | no (ES only) | no | 🔵 blocked (no ES) |
| GET | `/api/slack/connect` | start OAuth | none | — | no | no | 🔵 blocked (no Slack creds) |
| GET | `/api/slack/oauth/callback` | OAuth callback | HMAC-signed `state` (good) | — | yes | no | 🔵 blocked |
| POST | `/api/slack/disconnect` | disconnect | none | — | yes | no | not tested live (no connection to disconnect) |
| GET | `/api/slack/status` | connection status | none | — | yes | no | ✅ tested, returns `{connected:false}` correctly with no connection |
| — | `/admin/queues` | Bull Board dashboard | **none** | — | — | — | ✅ reachable, ❌ unauthenticated |

Empty-payload and malformed-payload handling: tested — Zod correctly returns `400` with field-level errors (confirmed: invalid email + too-short idempotency key both rejected with a structured error body). Large payloads are capped at 1MB by `express.json({limit:'1mb'})`.

## 7. Database Analysis

- `senders`: PK on `id`, plain-text `username`/`password` columns (Ethereal test creds here — low real-world severity, but worth flagging: no encryption at rest for SMTP credentials, see §20).
- `emails`: PK `id` (UUID), FK `sender_id → senders(id)`, `UNIQUE(tenant_id, idempotency_key)` — this constraint is the actual idempotency mechanism and was confirmed to hold under concurrent race conditions. Two useful indexes exist (`tenant_id, status, scheduled_at` and `sender_id, scheduled_at`) matching the two access patterns actually used by the code.
- `slack_connections`: PK `id`, `UNIQUE(tenant_id)`, bot token stored in plain text (same caveat as sender passwords).
- No `tenants` table at all — `tenant_id` is a free-text string with no referential integrity and, per §5/§20, no verification that the caller is actually who they claim.

## 8–10. BullMQ / Redis / Worker Analysis

- Queue: `defaultJobOptions` sets `attempts: 5`, exponential backoff (5s base), `removeOnComplete`/`removeOnFail` retention caps. Reasonable defaults.
- `scheduleEmailJob` uses `jobId: emailId` — this is what makes BullMQ itself idempotent per email (a second `add()` call with the same ID is a safe no-op at the queue layer, on top of the DB-level uniqueness).
- Worker concurrency is configurable and was exercised (multiple jobs went `ACTIVE` simultaneously in testing).
- **Confirmed bug in the retry path** — see §11.
- Graceful shutdown: `SIGTERM`/`SIGINT` close the worker, queue events, queue, and pool before exiting — this is correctly implemented and looks safe (not independently stress-tested against an in-flight job at shutdown, since that would require timing a `kill` mid-send, which the SMTP network block in this sandbox makes hard to hit precisely).

## 11. Idempotency / Duplicate-Send Analysis — HIGH PRIORITY, actually tested

**Confirmed working:** true duplicate-send prevention at three layers — Postgres unique constraint, BullMQ `jobId`, and the worker's own `if (['SENT','CANCELLED'].includes(status)) return;` guard.

**Confirmed bug (not a duplicate-send risk, but a false-success risk):** when a send genuinely fails (I forced this via a real SMTP connection timeout to an unreachable host), the worker sets the DB row to `FAILED` and re-throws. BullMQ then retries per its `attempts: 5` config. On that retry, the worker re-fetches the email: status is `FAILED`, which is **not** in the `['SENT','CANCELLED']` skip-list, so it proceeds — calls `reserveHourly`/`reserveSpacing` again (consuming another rate-limit slot for no reason), then hits `claimEmail`, whose `WHERE status='SCHEDULED'` no longer matches. `claimEmail` returns `undefined`, the handler does `if (!claimed) return;` and **exits without throwing**. BullMQ therefore marks the job `completed`. I verified this directly against Redis: `state: completed`, even though the row is `FAILED` in Postgres and the email was never sent.

**Impact:** Bull Board (and anyone reading queue state instead of the DB) will show a permanently-failed email as a "completed" job after its first retry. It also silently burns through the 5 configured retry attempts and rate-limit slots without ever actually retrying the SMTP send. See BUG-002.

## 12–13. Rate Limiting & Delay/Throttling Analysis — actually tested, see §5 for full results

Both the hourly counter and the per-sender spacing mechanism are single, atomic Redis Lua scripts (`EVAL`), which is the correct way to avoid the "two workers both read 199" race the assignment calls out by name. I reproduced that exact scenario directly against Redis (bypassing the app, to isolate the mechanism from network/SMTP variables) with 50 truly concurrent calls against a limit of 10, and got exactly 10 allowed / 40 denied with a correct final counter of 50 — no lost updates. I then reproduced it end-to-end through the real worker with `MAX_EMAILS_PER_HOUR=2` and 5 real jobs: exactly 2 processed, 3 correctly pushed to the next hour window via `moveToDelayed`, none dropped.

One design note, not a bug: the hourly limit is keyed **per sender only** (`rate:${senderId}:${window}`), not per (sender, tenant). If multiple tenants share the same sender account, they compete for the same hourly bucket — confirmed in testing, since an earlier test tenant's email consumed one of only 2 available slots for a later, unrelated tenant's batch. This is compliant with the assignment (which explicitly allows "global OR per-sender"), but worth being aware of for a real multi-tenant deployment.

## 14. Cron Violation Check

`grep -rn "node-cron\|cron\|agenda\|setInterval"` across every `.ts` file returned **zero matches**. Scheduling is 100% BullMQ delayed jobs. Clean pass.

## 15. Security Findings

- ❌ **Critical, tested:** No authentication anywhere. `x-tenant-id` is a client-supplied, unsigned, unverified header. I read another tenant's full email list by simply setting the header to their tenant ID. No API key, JWT, session, or OAuth check exists on any route, including `/admin/queues`.
- 🟡 CORS is fully open (`cors()` with no options — reflects any origin). Fine for local dev, not for production.
- 🟡 Bull Board (`/admin/queues`) has no auth guard of its own — combined with the above, it's fully open to anyone who can reach the port.
- 🟡 SMTP credentials and Slack bot tokens are stored in plain text in Postgres (no column-level encryption). Low real-world severity here since these are Ethereal test creds, but the pattern would be a real problem with production credentials.
- ✅ SQL injection: all queries use parameterized placeholders (`$1, $2…`); no string-concatenated SQL was found anywhere.
- ✅ Zod validation on the one user-input-heavy endpoint (`POST /api/emails`) is solid: email format, length bounds, coerced/validated dates, future-date check.
- ✅ helmet is applied globally (CSP, HSTS, etc. — confirmed present in real response headers during testing).
- No secrets were found committed in the zip (only `.env.example`, with empty credential fields).

## 16. Error Handling Findings

- Zod validation errors return structured `400` responses — good.
- `indexEmail()` failures inside `createEmail` are caught and logged (request still succeeds), **but the call is `await`ed before responding**, so a slow/unreachable Elasticsearch adds real latency to every schedule request — I measured ~9 seconds per request in this state, confirmed via response-time logging.
- `indexEmail()` failures inside the **worker** (after a successful send, and after marking a row `FAILED`) are **not** caught — this is what enables BUG-002 in the FAILED path, and separately (not tested, but visible in the code) would cause a spurious retry attempt even after a genuinely *successful* send, which the early `SENT` guard fortunately absorbs harmlessly.
- `ensureEmailIndex()` in `server.ts` has no try/catch — an unreachable Elasticsearch at boot **crashes the entire process** (API + worker both die). Confirmed by directly starting the server with ES down.

## 17. Testing Performed (this session, against a real local Postgres + Redis)

- `npm install`, `tsc --noEmit`, `tsc` (build) — all clean.
- Full server boot/crash reproduction with ES down.
- API smoke tests: health, senders, create, list, search (search itself blocked on ES), Slack status/connect error paths.
- Idempotency race: 5 concurrent identical requests.
- Restart persistence: real `kill -9` mid-delay, confirmed job + DB survival, confirmed correct single pickup after restart.
- Rate limiting: direct Lua-script concurrency stress test (50 calls, limit 10) + full end-to-end worker test (`MAX_EMAILS_PER_HOUR=2`, 5 jobs).
- Spacing: direct Lua-script concurrency stress test (20 calls, 500ms gap) — perfectly monotonic, zero collisions.
- Load proxy: 100 concurrent schedule requests, verified 100/100 landed with no loss or duplication.
- Security: cross-tenant read via header spoofing; SQL-injection grep; CORS/helmet header inspection.
- Cron grep across entire source tree.

## 18. Tests Blocked / Need Your Input

### BLOCKED TEST — Real Ethereal send end-to-end
**Why blocked:** This sandbox's network egress does not include `smtp.ethereal.email`, so nodemailer's connection attempt times out (I observed this directly — jobs sat `ACTIVE` for ~2 minutes before failing with `Connection timeout`).
**Required from you:** Real Ethereal SMTP credentials (host/port/user/pass) in `ETHEREAL_SENDERS`, tested from a network that can actually reach `smtp.ethereal.email` — either your own machine or a sandbox with open SMTP egress.
**How to provide/test:** Run `npm run db:init` then `npm run dev` locally with real creds, POST an email a few seconds in the future, and check the Ethereal inbox / preview URL nodemailer returns.

### BLOCKED TEST — Elasticsearch indexing/search
**Why blocked:** No Docker and no package-manager path to a real ES server in this sandbox.
**Required from you:** `docker-compose up elasticsearch` (or a reachable hosted ES) + `ELASTICSEARCH_URL` pointed at it.
**How to provide/test:** Start ES, restart the app, POST an email, then `GET /api/emails/search?q=<subject text>` and confirm it comes back.

### BLOCKED TEST — Slack OAuth + real message delivery
**Why blocked:** No Slack app credentials.
**Required from you:**
- `SLACK_CLIENT_ID`
- `SLACK_CLIENT_SECRET`
- `SLACK_REDIRECT_URI` (must match the Slack app's configured redirect exactly)
- A Slack workspace where you can install a test app
**How to provide/test:** Create a Slack app with `chat:write`, `channels:read`, `groups:read` scopes, set the redirect URI, fill the three env vars, hit `/api/slack/connect`, approve the install, then trigger a rate-limit hit (e.g. `MAX_EMAILS_PER_HOUR=1` with 2 emails to the same sender) and check the Slack channel for a real message.

### NOT TESTED — 1000+ simultaneous jobs (literal scale)
Only tested at 100 concurrent due to sandbox time constraints; no structural red flag found at that scale, but not proof at 10× that volume.

## 19. Bugs Found

### BUG-001 — Elasticsearch outage crashes the entire server on boot
**Severity:** High
**Location:** `src/server.ts:17` (`await ensureEmailIndex();`), `src/lib/elasticsearch.ts`
**Problem:** `ensureEmailIndex()` is awaited with no try/catch in `main()`. If Elasticsearch is unreachable, the promise rejects, `main()`'s `.catch()` logs the error and calls `process.exit(1)` — taking down the API **and** the worker, even though the assignment says Postgres should remain the source of truth and ES is just a search layer.
**Why it matters:** A transient ES blip (restart, network hiccup, disk full) means zero emails can be scheduled or sent at all, not just "search is temporarily degraded."
**Evidence:** Reproduced directly — starting the unmodified server with ES down printed the full connection-error stack trace and the process exited.
**Recommended fix:** Wrap `ensureEmailIndex()` in try/catch; log and continue if ES is unavailable, retry in the background.

### BUG-002 — A permanently-failed email retries into a false "completed" state
**Severity:** High
**Location:** `src/queue/queue.ts` — the worker function, specifically the top-of-function skip guard vs. `claimEmail`'s `WHERE status='SCHEDULED'`
**Problem:** After a send fails and the row is set to `FAILED`, BullMQ's automatic retry re-enters the worker. The skip guard only checks for `SENT`/`CANCELLED`, so it doesn't skip. `claimEmail` then fails silently (status isn't `SCHEDULED` anymore) and the handler returns without throwing, which BullMQ records as a **successful** completion.
**Why it matters:** Bull Board and any monitoring built on BullMQ job state (rather than querying Postgres directly) will show permanently-failed sends as "completed." It also wastes the configured 5 retry attempts and consumes extra rate-limit slots for a job that will never actually be retried.
**Evidence:** Forced a real SMTP connection timeout; confirmed via direct BullMQ inspection: `state: 'completed'`, `attemptsMade: 2`, while the Postgres row shows `status: 'FAILED'`.
**Recommended fix:** Extend the skip guard to include `FAILED` (with a separate, explicit manual-retry/re-enable path if retries are wanted), or make `claimEmail` failure due to a `FAILED` status re-throw instead of silently returning.

### BUG-003 — Elasticsearch latency/failure blocks the schedule API response
**Severity:** Medium
**Location:** `src/controllers/emails.ts:104` (`await indexEmail(email)`) 
**Problem:** Indexing to Elasticsearch is awaited synchronously in the request path before responding to the client, even though it's wrapped in try/catch (so it doesn't fail the request, only slows it down).
**Why it matters:** With ES down or slow, every `POST /api/emails` call pays the full ES client retry/timeout cost before the client gets a response — measured at ~9 seconds per request in this sandbox with ES unreachable.
**Evidence:** `responseTime: 8980`–`9002` in the server's own request logs during testing, correlating exactly with ES connection retries in the same log.
**Recommended fix:** Fire-and-forget the indexing call (don't `await` it in the response path), or move indexing to a background job/queue.

### BUG-004 — No authentication on any endpoint
**Severity:** Critical
**Location:** `src/middleware/tenant.ts`, `src/server.ts`, `src/routes/index.ts`, `/admin/queues` mount
**Problem:** Tenant identity is a raw client-supplied header with no verification. There is no auth check anywhere, including on the Bull Board dashboard mount.
**Why it matters:** Any caller can read or write any tenant's scheduled/sent emails and view the entire queue dashboard just by setting a header.
**Evidence:** Set `x-tenant-id: rl-tenant2` with no other credentials and successfully retrieved that tenant's full email list.
**Recommended fix:** This is explicitly a frontend Google-OAuth concern per the assignment, but the backend still needs to verify the caller's identity independently (e.g. a signed session/JWT issued after Google login, validated on every request) rather than trusting a client-supplied string, and should put Bull Board behind the same check.

## 20. High Priority Issues
BUG-001, BUG-002, BUG-004 (see above).

## 21. Medium Priority Issues
BUG-003; plain-text storage of SMTP/Slack credentials; wide-open CORS; per-sender (not per-tenant) rate-limit bucket sharing (design trade-off, not strictly a bug, but worth a README note per the assignment's own ask).

## 22. Low Priority Issues
No `package-lock.json` committed (reproducibility); no `status` enum validation on `GET /api/emails?status=`; `.env` not `.gitignore`'d in what was submitted (though no real `.env` with secrets was actually included in this zip, only `.env.example`).

## 23. Missing Requirements

- **README** — not present. The assignment explicitly requires one (run instructions, architecture overview, delay/rate-limit documentation, feature checklist).
- **Tests / lint** — `package.json` has no `test` or `lint` script and no test files exist.
- **Frontend** — entirely absent from this zip (expected, since this is `Scheduler_Backend.zip`, but flagging since the assignment is full-stack).
- **Docker / docker-compose** — not present; assignment says "recommended."
- **package-lock.json** — not present.

## 24. Recommended Fix Order

1. BUG-004 (auth) and BUG-001 (ES boot crash) — both are one-line-scale fixes with outsized correctness/availability impact.
2. BUG-002 (false-completed retries) — affects the reliability guarantees the assignment cares most about.
3. BUG-003 (ES latency in the request path).
4. Add the missing README, and, if time allows, a couple of smoke tests around idempotency and rate limiting (both of which I was able to verify externally in a few lines of script — you already have working reference logic to test against).

## 25. Final Backend Readiness Assessment

The core, hardest-to-get-right mechanics — no cron, atomic distributed rate limiting, atomic spacing, restart-safe delayed jobs, and race-safe idempotency — are all **genuinely correct and were proven correct through live testing**, not just code that reads plausibly. That's the part most take-home submissions get wrong, and this one doesn't.

What's not production-ready: there's no authentication at all (confirmed exploitable), one real availability bug (ES-down crashes everything) and one real observability bug (failed sends can misreport as completed) that a reviewer running the demo video's "restart scenario" or a forced-failure scenario would likely notice. None of these are hard fixes, but they are real, and none should be described as "handled" without the caveats above.

---

## Summary counts

| Status | Count |
|---|---|
| ✅ PASS | 15 |
| 🟡 PARTIAL | 5 |
| ❌ FAIL | 1 |
| ⚪ NOT IMPLEMENTED (out of this zip's scope) | 1 |
| 🔵 BLOCKED / NEEDS EXTERNAL TEST | 3 (Ethereal live send, Elasticsearch live, Slack live) |
| 🟣 NOT TESTED (only partially, at smaller scale) | 1 (1000+ concurrent jobs) |

**Top 5 problems, in order:**
1. No authentication on any endpoint — confirmed exploitable (BUG-004).
2. Elasticsearch outage takes down the entire server, not just search (BUG-001).
3. A permanently-failed email can retry into a misleading "completed" BullMQ state (BUG-002).
4. Elasticsearch latency/failure adds multi-second delay to every schedule API call (BUG-003).
5. No README, tests, or lockfile were included — required submission deliverables per the assignment.

**Tests I could not perform, and exactly what's needed from you:** real Ethereal SMTP send (network egress or your own machine), real Elasticsearch instance (Docker or hosted), real Slack app credentials + workspace. See §18 for the exact BLOCKED TEST format for each.

# Post-Fix Verification

This section records the work performed after the original audit. It does not mark an integration as verified unless it was actually run against the required external service.

## BUG-001

**Status:** Fixed in code; live Elasticsearch outage/recovery test blocked.

**Files changed:** `src/server.ts`, `src/queue/index-queue.ts`, `src/services/email-indexer.ts`.

**What changed:** Startup now logs an Elasticsearch failure and continues to start PostgreSQL-backed API and email workers. Elasticsearch work runs through a separate durable BullMQ `email-index` queue with fixed retry backoff; the index worker creates/verifies the index before writing documents. Indexing is no longer a critical dependency of scheduling or SMTP sends.

**Test performed:** `pnpm exec tsc --noEmit` and `pnpm run build` both passed on 2026-09-20.

**Result:** Type-safe build passed. Live outage/startup/recovery remains **BLOCKED** until a reachable Elasticsearch instance is supplied.

## BUG-002

**Status:** Fixed in code; live SMTP retry test blocked.

**Files changed:** `src/queue/queue.ts`.

**What changed:** A transient SMTP failure returns the DB row to `SCHEDULED` before rethrowing, allowing BullMQ's configured retry to claim and send it later. Only the final configured attempt records `FAILED` and throws, so BullMQ records a failed job rather than a completed job. A pre-existing terminal `FAILED` row also throws if manually retried through the queue, preventing false completion. Elasticsearch enqueueing is non-blocking and cannot turn a sent email into a retry.

**Test performed:** `pnpm exec tsc --noEmit` and `pnpm run build` both passed on 2026-09-20.

**Result:** Type-safe build passed. The success, temporary SMTP failure, final SMTP failure, and duplicate-send scenarios are **BLOCKED** pending a reachable Ethereal SMTP account/service.

## BUG-003

**Status:** Fixed in code; live Elasticsearch-down latency test blocked.

**Files changed:** `src/controllers/emails.ts`, `src/queue/index-queue.ts`, `src/services/email-indexer.ts`.

**What changed:** `POST /api/emails` persists and schedules the email, then enqueues indexing without awaiting Elasticsearch. The dedicated index queue handles retries independently.

**Test performed:** `pnpm exec tsc --noEmit` and `pnpm run build` both passed on 2026-09-20.

**Result:** Type-safe build passed. Measuring API latency with Elasticsearch unavailable is **BLOCKED** until PostgreSQL, Redis, and Elasticsearch service endpoints are configured.

## BUG-004

**Status:** Fixed in code; live Google OAuth token verification test blocked.

**Files changed:** `src/middleware/tenant.ts`, `src/controllers/emails.ts`, `src/db/schema.sql`, `src/db/seed.ts`, `src/server.ts`, `src/config/env.ts`, `.env.example`, `package.json`, `pnpm-lock.yaml`.

**What changed:** The backend no longer accepts `x-tenant-id`. Protected API routes require a Google-issued ID token in `Authorization: Bearer <token>`, validated server-side against `GOOGLE_CLIENT_ID`; the tenant is derived from Google's immutable subject. Senders are explicitly assigned through `sender_tenants`, and both sender listing and scheduling enforce that assignment. Slack connect/status/disconnect inherit this verified identity. The Slack callback remains accessible only through its existing HMAC-signed, expiring OAuth state. Bull Board is protected with server-configured HTTP Basic credentials.

**Test performed:** `pnpm install`, `pnpm exec tsc --noEmit`, and `pnpm run build` all passed on 2026-09-20.

**Result:** Dependency installation and type-safe build passed. Real token verification and tenant-isolation requests are **BLOCKED** pending a Google OAuth web-client ID and a real Google sign-in token. Bull Board credential checks need a running backend plus PostgreSQL and Redis.

## Updated readiness assessment

The four audited defects have code fixes and the backend passes TypeScript validation and a production build. No live service behavior is claimed by this section: PostgreSQL, Redis, Ethereal SMTP, Elasticsearch, Google OAuth, and Slack credentials/services were not available in this workspace for post-fix integration testing. The next verification run must exercise the original required test matrix with those services configured.

# Live Integration Verification

**Date:** 2026-09-20

## Environment discovery

- Command: PowerShell inspection of `.env`, `.env.example`, package files, schema/seed files, Docker files, local TCP ports, and Docker status.
- Observed configuration: `.env` is absent. `pnpm-lock.yaml` is present. No Docker configuration exists in this repository. Docker CLI is installed but its daemon is unavailable. No secrets were printed.
- Observed services: TCP ports `127.0.0.1:5432`, `:6379`, and `:9200` are closed.
- Backend startup command: `node dist/server.js`.
- Observed result: startup stops at environment validation because `DATABASE_URL` and `ETHEREAL_SENDERS` are unset. This is expected fail-fast configuration validation, not a scheduler test.
- Code validation command: `pnpm exec tsc --noEmit; pnpm run build`.
- Observed result: passed. This validates compilation only and is not counted as an integration test.

| Test | Result | Evidence |
|---|---|---|
| PostgreSQL | BLOCKED | Required configuration: `DATABASE_URL`. `TCP 127.0.0.1:5432` was closed and no `.env` exists. Expected: a running, reachable PostgreSQL service. No DB query could be executed. |
| Redis | BLOCKED | Required configuration: `REDIS_URL`. `TCP 127.0.0.1:6379` was closed and no `.env` exists. Expected: a reachable Redis instance. No Redis command could be executed. |
| BullMQ | BLOCKED | Command attempted: `node dist/server.js`; it stopped before worker initialization because `DATABASE_URL` and `ETHEREAL_SENDERS` are unset. Expected: both queue workers connect to Redis and process jobs. |
| Google Auth | BLOCKED | Required configuration: `GOOGLE_CLIENT_ID` and a real, unexpired Google ID token. No backend listener could start without DB/SMTP configuration, and no token was supplied. Expected endpoints: `GET /api/emails` and `GET /api/senders` with `Authorization: Bearer <token>`. |
| Tenant Isolation | BLOCKED | Requires two real Google ID tokens, configured sender assignments, and a running database. Expected: each user sees only their own emails, sender assignments, and Slack connection. No tenant headers were used. |
| Bull Board Auth | BLOCKED | Required configuration: `BULL_BOARD_USERNAME`, `BULL_BOARD_PASSWORD`, plus running backend, PostgreSQL, and Redis. Expected endpoints: unauthenticated `GET /admin/queues` returns 401; valid Basic Auth returns 200. Server could not start. |
| Elasticsearch Available | BLOCKED | Required configuration: `ELASTICSEARCH_URL` and a reachable instance. `TCP 127.0.0.1:9200` was closed. Expected: index creation and searchable indexed email. |
| Elasticsearch Outage | BLOCKED | Requires working PostgreSQL and Redis to prove the application continues while Elasticsearch is stopped. Current backend could not start because `DATABASE_URL` and `ETHEREAL_SENDERS` are unset. Expected: health/API/workers remain available and index jobs retry. |
| Elasticsearch Recovery | BLOCKED | Requires a reachable Elasticsearch instance that can be stopped and restarted while PostgreSQL and Redis remain available. Expected: queued index jobs eventually complete after recovery. |
| Non-blocking Indexing | BLOCKED | Requires running PostgreSQL, Redis, and an unavailable/slow Elasticsearch endpoint. Expected endpoint: `POST /api/emails` returns promptly while an `email-index` BullMQ job is queued. No timing measurement can be made without backend configuration. |
| Ethereal Success | BLOCKED | Required configuration: valid reachable `ETHEREAL_SENDERS` credentials and PostgreSQL/Redis. No `.env` is present. Expected lifecycle: SCHEDULED → delayed → SENT / completed, with a real Ethereal SMTP send. |
| SMTP Retry | BLOCKED | Requires reachable SMTP plus a controlled transient failure that later recovers. Expected: first attempt returns DB state to SCHEDULED, later attempt sends once, BullMQ completes. |
| SMTP Final Failure | BLOCKED | Requires controlled persistent SMTP failure with PostgreSQL and Redis available. Expected: final DB status FAILED and BullMQ state failed, never completed. |
| Idempotency | BLOCKED | Requires authenticated scheduling requests, a tenant sender assignment, PostgreSQL, and Redis. Expected command: concurrent `POST /api/emails` requests with one idempotency key result in one DB record and one queue job. |
| Restart Persistence | BLOCKED | Requires a running configured backend and reachable SMTP/DB/Redis. Expected: force stop during delayed state, restart, then observe one execution and no duplicate send. |
| Rate Limiting | BLOCKED | Requires configured backend with temporary `MAX_EMAILS_PER_HOUR=2`, PostgreSQL, Redis, and a tenant-assigned sender. Expected: five jobs yield two current-window reservations and deferred remainder. |
| Spacing | BLOCKED | Requires configured backend with a measurable `MIN_DELAY_MS`, PostgreSQL, Redis, and send-capable SMTP. Expected: same-sender reservations respect minimum spacing under concurrent workers. |
| Slack OAuth | BLOCKED | Required configuration: `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_REDIRECT_URI`, a real Google-authenticated user, and a Slack workspace/app. Expected: authorize/callback persists a connected record. |
| Slack Notification | BLOCKED | Requires a connected real Slack workspace and rate-limit event. Expected: verified `chat.postMessage` delivery; no mock or log-only result accepted. |
| 1000-job Load | BLOCKED | Basic stack is not running: no `.env`, PostgreSQL, Redis, or authenticated tenant/sender setup. Expected: controlled script creates exactly 1,000 DB rows and email queue jobs with measured duration/failures/duplicates. |

## Required setup before rerun

1. Create a local `.env` from `.env.example` with real values for `DATABASE_URL`, `REDIS_URL`, `ETHEREAL_SENDERS`, `GOOGLE_CLIENT_ID`, `BULL_BOARD_USERNAME`, and `BULL_BOARD_PASSWORD`.
2. Start reachable PostgreSQL, Redis, and Elasticsearch services. Docker may be used after its daemon is started, but this repository has no compose file.
3. Run `pnpm run db:init` to create schema and sender assignments, then `pnpm start`.
4. Provide real Google ID tokens for one or two test users, but do not place them in source control or logs.
5. For Slack tests, configure a real Slack app and the three Slack OAuth environment values.

### CURRENT STATUS

**Production-code validation:** PASS — current TypeScript check and production build succeeded.

**Integration validation:** BLOCKED — no local runtime configuration or required service endpoints are available.

**Remaining blockers:** missing `.env`; no reachable PostgreSQL, Redis, or Elasticsearch; Docker daemon unavailable; missing reachable Ethereal credentials; missing Google OAuth client ID and real test tokens; missing Slack OAuth configuration/workspace.

**New bugs discovered:** None. The configured-environment startup failure is expected because required `DATABASE_URL` and `ETHEREAL_SENDERS` values are absent.

**Ready for frontend development:** NO — real backend integration behavior, authentication, SMTP, queue persistence, Elasticsearch recovery, and tenant isolation have not been proven against services.

I have not modified any business logic in the delivered code — the only edit made anywhere was a one-line try/catch added to a **throwaway test copy** (`/home/claude/audit-test/src/server.ts`), purely so I could get past the ES-boot-crash bug and keep testing the rest of the system; your actual uploaded code is untouched.
