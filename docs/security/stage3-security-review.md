# Stage 3 security review (T3.6) — Tiffin Box website + admin

- Date: 2026-11-22
- Reviewer: security-engineer agent (findings only; no application code, migration or test was changed)
- Branch / commit: `stage3/backend` @ `22ae83c`
- Gate context: Stage 2 is recorded as approved (`approvals/APPROVALS.md` row 7, PR #10). `scripts/verify-approval.sh` was not re-run in this review.

## 1. Scope and method

Scope: `supabase/migrations/20261122000001..000011`, `supabase/ops/menu_go_live_cron.sql`, `proxy.ts`, `next.config.ts`,
`src/lib/auth/*`, `src/lib/supabase/server.ts`, `src/lib/env.ts`, `src/lib/request.ts`, `src/admin/server/*`,
`src/admin/validation/*` (auth, common, parts of content), `src/content/{reader,last-good,read-published}.ts`,
`src/lib/whatsapp.ts`, `app/admin/**`, `app/api/**`, `.github/workflows/*`, `.gitignore`, `.env.example`, git history.
Checked against `docs/playbook/checklists/security-checklist.md` and OWASP Top 10.

Three evidence levels are used below and must not be confused:

| Level | Meaning |
|---|---|
| READ | Verified by reading the code at the cited lines. Not executed. |
| RUN | Verified by a command run in this review (command and result in section 5). |
| UNVERIFIED | Could not be checked here (section 4). |

Not done on purpose: no request was sent to the hosted staging Supabase project, no sign-up, no login attempt, no
`.env*` file was opened (only `.env.example`). `gitleaks` and `semgrep` are not installed on this machine.

## 2. Findings

No Critical or High finding. No committed secret was found.

"Blocks Stage 3 gate": **Yes** = fix (or record a written CEO risk acceptance) before the milestone PR;
**Verify** = a human check is needed before the gate, no code change expected; **No** = carry into Stage 4/5 with an owner.

| ID | Severity | Location | Evidence | What an attacker can do | Recommended fix | Blocks Stage 3 gate |
|---|---|---|---|---|---|---|
| SEC-01 | Medium | `proxy.ts:66-72`, `src/lib/auth/session.ts:66-74`, `src/lib/auth/session-policy.ts:28-33`, `src/admin/server/auth.ts:110-112` | READ | The 30 min idle / 12 h absolute limits (FR-13) are decided from two plain cookies (`tb_login_at`, `tb_active_at`) holding client-supplied epoch numbers. They are HTTP-only but not signed and not bound to the session. Anyone who holds the cookie jar (stolen session, malware, shared machine profile copy) sets both to "now" on every request and the session never expires in the app; the Supabase refresh token keeps rotating, so access is effectively unlimited until an explicit logout. Deleting the cookies is handled correctly (treated as expired); forging them is not. | Take the absolute limit from signed data: the verified JWT claims (`session_id` plus the `amr` authentication timestamp) instead of `tb_login_at`. For idle time, store `session_id.timestamp.HMAC` signed with a server-only secret (new env var), verify in both `proxy.ts` and `requireAdmin()`. Add unit tests for a forged and a replayed value. Also set Supabase's own session time-box / inactivity timeout when the plan allows it. | **Yes** (small change; or written risk acceptance with a Stage 4 exit condition) |
| SEC-02 | Medium | `docs/backend.md:96`, `docs/architecture.md:398` | UNVERIFIED | The design depends on "public sign-up is disabled" in the Supabase project. This is a dashboard setting that no one has confirmed for staging. If it is on, anyone who learns the publishable key (it is not a secret by design) can create `authenticated` accounts. RLS still gives such a user nothing (RUN locally: user D "signed in, not an admin" sees 0 rows and gets PT403/42501 everywhere), so the impact is a wider attack surface, junk accounts and abuse of the project's built-in mailer, not data exposure. | Engineering Lead confirms in the staging dashboard: sign-up off, anonymous sign-ins off, minimum password length 12, exposed API schemas do not include `app`. Record the result in `docs/deployments.md`. Add a read-only assertion on `GET /auth/v1/settings` (`disable_signup = true`) to `scripts/staging-integration.mjs` so it is re-checked on every run. | **Verify** |
| SEC-03 | Medium | `supabase/migrations/20261122000005_rls_and_grants.sql:82-158`, `20261122000009_operations_functions.sql:105`, `20261122000007_publishing.sql:177,193`, `20261122000001_foundation.sql:59-66`, `src/lib/auth/session.ts:96` | READ + RUN (db tests) | The `staff` role has exactly the same power as `owner`. Every policy and every RPC checks only `app.is_admin()`; `app.is_owner()` exists but is used nowhere and the app never looks at `role`. A staff account can publish, roll back, void payments and call `anonymise_customer()` (irreversible, and it rewrites that customer's audit history). What is sound: a staff or non-admin user cannot read other `admin_users` rows, cannot insert/update `admin_users`, and cannot make itself owner (RUN). | Decide with the PM/CEO (open question Q-02). Minimum now: require `app.is_owner()` in `anonymise_customer()` and `rollback_release()`, and state in `docs/backend.md` that v1 has one privilege level so nobody hands out "staff" accounts expecting a restriction. If roles are wanted, add owner-only policies as a logged change request. | No (Yes for the owner check on `anonymise_customer` before that function gets a UI) |
| SEC-04 | Medium | `next.config.ts:14-25` | READ | Known gap, severity confirmed. The only headers set are `X-Robots-Tag` and `Cache-Control` on `/admin`. There is no `Content-Security-Policy`, `X-Frame-Options` / `frame-ancestors`, `X-Content-Type-Options`, `Referrer-Policy`, `Strict-Transport-Security` or `Permissions-Policy`, although `docs/architecture.md:425,645` lists CSP/security headers as an NFR-07 control. Today there is no known XSS sink (section 3), so this is missing defence in depth: one future raw-HTML mistake in admin-entered content would execute in visitors' and admins' browsers with nothing to contain it. Clickjacking of `/admin` is limited by `SameSite=Lax` cookies but not prevented by a header. | Add site-wide headers in `next.config.ts`: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY` plus CSP `frame-ancestors 'none'`, `Permissions-Policy` (deny camera, microphone, geolocation), HSTS on the deployed host, and a nonce-based CSP (`default-src 'self'`; `img-src 'self' data: https://<project>.supabase.co`; no `unsafe-inline` for scripts). Add a unit/e2e assertion for the headers. | No (must be closed before Stage 4 exit and before any public URL) |
| SEC-05 | Low | `src/lib/request.ts:4-7`, `src/admin/server/auth.ts:62-78`, `src/lib/auth/throttle.ts:53-65`, `app/api/revalidate/route.ts:29` | READ | Login throttling is weaker than described. (a) The caller address is the first `X-Forwarded-For` hop, which the client controls on most proxies, so the per-address lock and the `/api/revalidate` rate limit are bypassed by changing a header. (b) The per-account key locks on the email alone, so anyone who knows the owner's email can keep the owner locked out with 5 bad attempts every 10 minutes. (c) The map evicts the oldest entries at 5000 keys, so a flood of unique emails can evict a real lock. (d) State is in memory (known gap). (e) All sign-ins reach Supabase Auth from the app server's address, so Supabase's per-IP limit is one bucket shared by every user: it still caps guessing, but a flood can lock everyone out. | Read the client address from the header the chosen host guarantees (Azure App Service: right-most `X-Forwarded-For` entry / `X-Client-IP`), never the first hop. Lock on the pair account+address and use a growing delay for the account alone. Evict only expired entries (refuse new keys when full). Move the counters to the database or the host's rate limiter in Stage 5. Recommend TOTP for the owner account (architecture sec. 7 already suggests it). | No |
| SEC-06 | Low | `supabase/migrations/20261122000010_storage.sql:20-21` | READ (policy); UNVERIFIED on real Supabase Storage | `media_public_read` grants `SELECT` on every object of the public `media` bucket to `anon` and `authenticated`. On Supabase this lets anyone with the publishable key list the whole bucket, including photos uploaded but never published. This is wider than the intended "public read of published media only". Content is food photos, so impact is low. A public bucket serves objects by URL without any `SELECT` policy. | Drop the anon/authenticated `SELECT` policy and keep a `SELECT` policy for admins only (`bucket_id = 'media' and app.is_admin()`). Add an anon "list `media` returns nothing" assertion to `scripts/staging-integration.mjs`. | No |
| SEC-07 | Low | `supabase/migrations/20261122000009_operations_functions.sql:113-128`, `20261122000003_operations_tables.sql:104,146` | READ | `anonymise_customer()` does not clear `subscription_periods.note` (free text, 200 chars) and keeps `payments.reference`; the audit redaction removes a `note` key from history rows but the live period row keeps its text. Personal remarks typed into a period note survive an anonymisation request (NFR-12). | Clear `subscription_periods.note` for the customer's subscriptions inside the function; decide and document whether `payments.reference` is kept for bookkeeping. Extend `supabase/tests/06_audit.sql`. Do this before the anonymise screen is built. | No |
| SEC-08 | Low | `supabase/migrations/20261122000010_storage.sql:22-26`, `src/admin/server/media.ts:111` | READ | The re-encode / EXIF-strip pipeline is enforced only in the server action. The storage policy lets any active admin write to the public `media` bucket directly with their own session token, so an insider can publish an unsanitised file (EXIF/GPS intact, or non-image bytes labelled `image/png`; the bucket checks only the declared type and 2 MiB). Insider-only; files are served with an image content type, so no script execution. | Accept and document for v1 (no service-role key is by design), or route writes through a narrower path: allow insert to `media` only for names matching `^[0-9a-f]{64}\.(jpg|png|webp)$` so arbitrary names cannot be planted, and keep the `media` row as the only source of public image paths. | No |
| SEC-09 | Low | `src/lib/env.ts:49-53`, `src/lib/auth/session.ts:57`, `proxy.ts:32` | READ | The test mock switch fails open: it is honoured whenever `TIFFINBOX_TEST_MOCK_BACKEND=1` and `APP_ENV` is anything other than `staging`/`production`, including unset or misspelled. On a host with both mistakes the proxy and `requireAdmin()` are skipped and `/admin` opens as a fixed owner on the in-memory sample data, and the public site shows sample content. No real data is reachable in that mode, but the site would be defaced and look breached. | Fail closed: honour the flag only when `APP_ENV` is exactly `test` (or `local`) and refuse to start when the flag is set with any other value. Add the case to `tests/unit/env.test.ts`. | No (fix before Stage 5) |
| SEC-10 | Low | `next.config.ts:12` | READ | `serverActions.bodySizeLimit: '9mb'` applies to every server action, including the unauthenticated sign-in action. The framework buffers the body before the action (and its `requireAdmin()` check) runs, so anonymous clients can make the single small instance buffer 9 MB per request. | Move the photo upload to a route handler that checks the session before reading the body and keep server actions at the 1 MB default; or cap request size and rate at the host for unauthenticated callers. | No |
| SEC-11 | Low | `src/lib/env.ts:80-85`, `src/content/last-good.ts:22-25` | READ | The last-good content file defaults to a fixed, predictable name in the OS temp directory, and the temp file name is predictable too. On a host where another local user or process can write there, a planted file is served to visitors whenever Supabase is unreachable (it passes shape validation; React still escapes it, so this is defacement, not XSS). | Require `LAST_GOOD_CONTENT_PATH` when `APP_ENV` is `staging` or `production` (no temp-dir default), create the file with mode `0600` in an app-owned directory. | No (fix before Stage 5) |
| SEC-12 | Low | `.github/workflows/ci.yml:12-13,25-26`, `.github/workflows/deploy.yml:14,21` | READ | Third-party actions are pinned by tag, not commit SHA; no `permissions:` block (default token scope); CI runs lint, typecheck and unit tests only (no `npm audit`, no build, no database tests). Known gap: Actions has never run, so none of this is enforced today. | DevOps: pin actions by SHA, add `permissions: contents: read`, add `npm audit --omit=dev --audit-level=high`, `npm run build` and `npm run db:test` (Postgres service container). Find out why no run has ever started. | No |
| SEC-13 | Info | `proxy.ts:86-93`, `src/lib/auth/session.ts:89,121` | READ | An admin deactivated while signed in keeps a valid Auth session. The database denies everything (RUN: inactive admin sees 0 rows, PT403), but the browser loops between `/admin` (page guard redirects to login) and `/admin/login` (proxy redirects signed-in users back). Not a bypass; a usability bug that hides the real reason. | On `not_admin`, sign the user out (route handler or action) before redirecting; QA to add a test. Document that deactivation should be followed by "sign out user" in the Supabase dashboard. | No |
| SEC-14 | Info | `supabase/migrations/20261122000004_audit.sql:26-37` | READ | The append-only guard covers `UPDATE` and `DELETE`, not `TRUNCATE`, and trusts the `app.audit_redaction` setting. No API role can use either (no grants, no arbitrary SQL through PostgREST; RUN). The project owner / service role in the dashboard can, which is inherent to owner access. | Optional: add a `BEFORE TRUNCATE` statement trigger. State in `docs/database.md` that dashboard-level access is outside the append-only guarantee. | No |

### Known gaps already acknowledged (severity confirmed, not re-analysed)

| Gap | Severity | Note |
|---|---|---|
| No CSP header | Medium | See SEC-04 (the gap is all security headers, not only CSP). |
| In-memory throttling | Low | See SEC-05; acceptable for one instance, not for scale-out. |
| No password-reset email flow | Low | Reset is a dashboard action by the project owner; acceptable for v1 if written into the handover. |
| Anonymise has no UI | Low | The RPC is already callable by any active admin (SEC-03, SEC-07). |
| Cron notifier untested | Low | `supabase/ops/menu_go_live_cron.sql` is not a migration and was never run; secret comes from Vault and is sent as a bearer header (READ). Must be tested on staging before use. |
| Chromium-only tests | Info | Not a security issue. |
| GitHub Actions never run | Low | No automated gate exists today (SEC-12). |

## 3. Checked and found sound

Database (READ on all 11 migrations; RUN where marked)
- RLS is enabled on all 19 tables; no policy names `anon`; anon has no table, view or sequence privilege and may execute only `public.get_public_content()` (RUN: local catalogue tests; staging anon run of today, 100/100, read from `docs/test-results/stage3/staging-integration-2026-11-22.txt`).
- A signed-in non-admin and an inactive admin are denied on every table, view, RPC and both buckets (RUN: `supabase/tests/01_rls.sql` roles C and D).
- `admin_users`: select-own only, no write grant or policy; self-promotion is refused (RUN).
- Every `SECURITY DEFINER` function sets `search_path = ''` and schema-qualifies its objects. Every `public.*` definer RPC starts with `app.is_admin()`. Internal definer functions (`do_publish`, `write_audit`, `build_content_document`, `public_content_at`, `menu_json`, notifier helpers) are not executable by `authenticated` after the lockdown migration. No dynamic SQL (`EXECUTE`/`format`) exists, so no SQL injection path in functions. No argument lets a caller choose the actor: `publish_content` passes `auth.uid()` itself; `payments.recorded_by` is not in the insert grant.
- All views are `security_invoker = true` and the functions behind them run as the caller.
- Column-level grants stop direct edits of `anonymised_at`, void fields and `customer_id` on payments (RUN: "admin cannot set anonymised_at directly"); no DELETE on operations tables; `content_releases` immutable by trigger; `audit_log` has no write grant.
- `media-incoming` is private and owner-scoped (RUN locally and anon on staging).

Application (READ)
- Only the publishable key is read (`src/lib/env.ts`); no service-role key anywhere in code or history.
- All 20 pages under `app/admin/(dashboard)` call `requireAdminPage()`; all server actions except sign-in/sign-out go through `runAction()` → `requireAdmin()`, which verifies the token with Supabase Auth (`getUser`) and the active `admin_users` row. The proxy lets `next-action` requests through, but each action re-checks, so spoofing that header gains nothing.
- No mass assignment: every insert/update builds an explicit column list from validated values; ids are UUID-checked; filter values go through supabase-js parameters; the one `ilike` escapes wildcards. Single-tenant, so no cross-tenant IDOR class.
- No open redirect: login has no `next` parameter; `/admin/preview` uses fixed allow-lists; the preview week cookie is UUID-validated; draft data needs an admin session, not just the draft-mode cookie.
- `/api/revalidate`: 503 when the secret is unset or shorter than 16 chars, constant-time comparison, fixed reason list, only expires a cache tag. `/api/health` returns no data.
- Cookies: Auth and timestamp cookies are `HttpOnly`, `SameSite=Lax`, `Secure` in production builds. CSRF: mutations are server actions (framework origin check) on Lax cookies.
- Upload: session checked first, type and size checked, bytes decoded by `sharp` (SVG/GIF rejected by decoded format), 36 MP pixel limit, re-encoded (metadata dropped), stored under a content-hash name (no path traversal), file name sanitised.
- XSS: one `dangerouslySetInnerHTML` (`src/components/public/JsonLd.tsx:6`) and it escapes `<`; WhatsApp links are built from digits only; the Instagram URL always stays on `www.instagram.com`; `<`/`>` are rejected by validators and by database CHECK constraints.
- Errors: database messages are never passed to the browser except four fixed trigger texts; logs carry event names and codes only; sign-in gives one generic message.

Secrets and dependencies (RUN)
- No secret pattern in tracked files or in all 29 commits; only `.env.example` (placeholders) was ever committed; `.env.local` and `supabase/.temp/` are git-ignored.
- `npm audit --omit=dev`: 0 vulnerabilities. `npm audit`: 0 vulnerabilities.

## 4. Not checked / unverified

- Supabase dashboard settings of the staging project: sign-up disabled, anonymous sign-in, minimum password length, leaked-password check, Auth rate limits, exposed schemas, MFA (SEC-02). A read-only check was attempted and refused by the session's permission system; it was not retried.
- Anything as an authenticated user against real Supabase (GoTrue JWTs, real Storage policy behaviour, `owner_id` semantics, SEC-06 listing). Authenticated behaviour was verified only on the local PostgreSQL emulation.
- Whether changing a password revokes the user's other sessions (Supabase behaviour, not exercised).
- Runtime behaviour of the app: no dynamic testing, no browser session, no header capture, no check of the server-action origin check behind the future Azure proxy. Host configuration (HTTPS-only, HSTS, forwarded headers) does not exist yet.
- `supabase/ops/menu_go_live_cron.sql` (never run anywhere).
- Files read only in part or by pattern search: `src/admin/server/{menu,content,mappers,audit,pending,pending-loader,overview}.ts`, `src/content/live.ts`, `src/admin/validation/{content,operations}.ts`, client components. Seeds, rollbacks and test helpers were not reviewed.
- No `gitleaks` / `semgrep` scan (tools not installed); the secret scan was pattern-based `git log -G`.
- `docs/test-results/stage3/staging-e2e-admin-flows.txt` was not read or re-run.

## 5. Commands run (all local, repo root)

| Command | Result |
|---|---|
| `git log --all -p -G<pattern>` for JWT, `sb_secret_`, `sb_publishable_`, `sbp_`, service-role assignment, private-key header, AWS key, GitHub token, Postgres URL with password, generic `password/secret/token = '...'` | Only hit: `.env.example` (placeholder `sb_publishable_xxxxxxxxxxxxxxxxxxxx`) |
| `git log --all --diff-filter=A --name-only` filtered for env/key files; `git check-ignore -v .env.local supabase/.temp` | Only `.env.example` ever committed; both paths ignored |
| `npm audit --omit=dev` | `found 0 vulnerabilities` |
| `npm audit` | `found 0 vulnerabilities` |
| `npm run db:test` (throwaway database on the local PostgreSQL socket; script refuses a remote `PGHOST`) | `assertions passed: 606`, `assertions failed: 0`, `RESULT: OK` |
| `npm test` | `Test Files 24 passed (24)`, `Tests 253 passed (253)` |

## 6. Status

All findings: **Open**. Owners: backend-developer (SEC-01, 05, 09, 10, 11, 13), database-engineer (SEC-03, 06, 07, 08, 14),
web-frontend/backend (SEC-04), devops-engineer (SEC-12), Engineering Lead (SEC-02 dashboard check).
Re-verification by security-engineer after fixes.
