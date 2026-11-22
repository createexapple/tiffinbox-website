# Backend and integration (Stage 3: T3.2, T3.3, T3.5)

Status 2026-11-22: **implemented on branch `stage3/backend`, uncommitted. Unit tests, the mock e2e suite and a real-server fallback check ran. NOTHING was run against the real staging Supabase project** (no `.env.local` and no admin account were available to the agent). Everything below marked "untested against Supabase" must be exercised by the Engineering Lead with the steps in section 9 before it is relied on. Not verified by a human; not security-reviewed (T3.6).

Design decisions: ADR-0002 (Supabase + RLS), ADR-0003 (draft, release, cache). Database: `docs/database.md`. Contract: `docs/api/openapi.yaml`. There is no separate API server: the Next.js app is the only server we run.

## 1. What runs where

| Place | What | Notes |
|---|---|---|
| Browser | Public pages (HTML), admin screens (React) | Holds **no Supabase key, URL or token**. Admin screens call server actions of this app only. |
| Next.js server (this repo) | `proxy.ts` (auth gate for `/admin`), server actions `src/admin/server/*`, public reader `src/content/reader.ts`, route handlers `app/api/*` and `app/admin/preview` | Uses the **publishable key** plus the signed-in admin's own session. The Supabase secret / service-role key is not used anywhere. |
| Supabase | Auth (email + password), PostgreSQL with RLS, views and functions (`docs/database.md`), Storage (`media` bucket) | The final gate: every table is default-deny and every admin function re-checks `app.is_admin()`. |
| Host disk | The last-good content file (`LAST_GOOD_CONTENT_PATH`) and the Next.js data cache | Lets public pages survive a Supabase outage (NFR-08). |

## 2. Environment variables

Names are in `.env.example` (placeholders only). Real values live in `.env.local` (git-ignored), the host's settings, or CI secrets. Nothing in the repo prints a value.

| Name | Required | Purpose |
|---|---|---|
| `SUPABASE_URL` | yes | Project URL, for example `https://<ref>.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | yes | Publishable (formerly anon) key. Identifies the project only; RLS decides what it can do |
| `APP_ENV` | on every deployed host | `staging` or `production`. The test mock backend is refused when it is `staging` or `production` |
| `REVALIDATE_SECRET` | for `/api/revalidate` | At least 16 random characters. While unset the endpoint answers 503 |
| `SESSION_SIGNING_SECRET` | on every deployed environment | At least 32 random characters (`openssl rand -hex 32`). Signs the admin "last active" cookie (security review SEC-01). When `APP_ENV` is `staging` or `production` and this is unset, admin sign-in is refused. Not needed locally |
| `LAST_GOOD_CONTENT_PATH` | recommended on a host | Persistent path (Azure App Service: under `/home`). Default: the OS temp dir |
| `ADMIN_IDLE_MINUTES`, `ADMIN_SESSION_HOURS` | optional | Idle timeout (default 30) and absolute lifetime (default 12), FR-13. To be confirmed with the client |
| `APP_VERSION` | optional | Shown by `GET /api/health` |
| `SITE_URL`, `SITE_ALLOW_INDEXING` | as before | Unchanged from Stage 2 |
| `TIFFINBOX_TEST_MOCK_BACKEND` | tests only | `1` serves the in-memory mock (`src/admin/mock`, `src/content/mock.ts`) so unit and e2e tests need no network. Read at request time (the build is the same artifact). Ignored when `APP_ENV` is `staging` or `production`. Never set it on a host |
| `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD` | staging e2e only | A staging admin account created by the Lead. Without both, the authenticated staging specs skip with a clear message |

Only `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` are needed to run the app against staging.

## 3. How authentication works (FR-13, NFR-07, NFR-12)

Three server-side layers; the browser is never trusted.

1. **`proxy.ts`** (Next.js 16 `proxy`, matches `/admin` only, so the public site never depends on it). For every admin **page** request it refreshes the Supabase session (`getClaims`, which verifies the token signature), applies the idle and absolute limits, and redirects to `/admin/login` (`?reason=expired` after a timeout). Link prefetches do not count as activity. Server-action requests pass through; layer 2 decides for them.
2. **`requireAdmin()` / `requireAdminPage()`** (`src/lib/auth/session.ts`) run at the top of **every admin page and every server action** (actions via `runAction`, `src/admin/server/run.ts`). They do not trust the cookie: they ask Supabase Auth to verify the token (`getUser`), check the idle and absolute limits, and read the user's own `admin_users` row, which must have `is_active = true` (the same test as the database's `app.is_admin()`). A signed-in user who is not an active admin gets nothing. An action with no valid admin returns "signed out", and the browser goes to `/admin/login?reason=expired`.
3. **PostgreSQL RLS** (`docs/database.md` sec. 3) holds even if layers 1 and 2 have a bug.

Sign-in (`signInAction`): email and password are validated again on the server, then Supabase `signInWithPassword`. Every failure (unknown email, wrong password, an account that is not an admin) shows the same message, **"Email or password is not correct."** Throttling: 5 failures in 10 minutes per account and per caller address lock that key for 10 minutes ("Too many attempts. Please wait ..."), in memory on one instance, in addition to Supabase Auth's own rate limits (a 429 from Auth shows the same message). Keys are hashed; no email, password or address is logged. If the backend is down the screen says "Sign-in is not available right now."

Session: HTTP-only, `SameSite=Lax`, `Secure` in production cookies (`@supabase/ssr`). Two extra cookies hold the login time and last activity for the 12 hour and 30 minute limits (`tb_login_at`, `tb_active_at`; the limits are the app's own control on top of Supabase's). Logout revokes this session's refresh token and clears the cookies.

Password change (`changePasswordAction`): needs the current password (verified on a throw-away client so the real session is untouched), minimum 12 characters, typed twice; then Supabase `updateUser`. Wrong attempts are throttled like sign-in. Supabase's own leaked-password check is a Pro feature (architecture sec. 7).

## 4. Public read path and publishing (FR-06, FR-22, NFR-06, NFR-08)

- Public pages call only `src/content/index.ts`. `getContentSnapshot()` reads `get_public_content()` with the **anon** client (no cookies, so pages stay cacheable). The result is cached with Next's data cache under the tag `public-content` for **60 seconds**, so a publish is visible within a minute even if every notification fails.
- On success the document is also written to the last-good file. If the backend fails, times out (3 s) or returns something malformed, the last-good copy is served. With no copy and no backend, pages show the designed error state ("Kuch masla ho gaya.") inside the normal chrome, never a crash. "Nothing published yet" is also the error state (the last-good file is deliberately not used then).
- Public pages render per request (`force-dynamic`); the build contains no content and no environment values.
- **Publish** (`publishAction`): `publish_content()` validates the drafts and, in one transaction, writes an immutable release and repoints the live site; a failure changes nothing. Pending edits to the **live menu week** are released with it (`release_menu_week(publish_now)`), because menu weeks carry their own releases. Then the cache tag is expired at once (`updateTag`) and the content is read back to confirm the new version (`visibleOnSite` in the result; if false the screen says visitors will see it within a minute).
- **Rollback** (`rollbackAction`): `rollback_release(version)`; drafts untouched; same cache expiry.
- **Preview** (FR-22): the Publish screen and the Menu screen link to `GET /admin/preview?to=<page>[&week=<uuid>]`, which turns on Next.js draft mode for the signed-in admin and redirects to the public page. With draft mode on **and** a valid admin session, the page renders from `get_draft_content()` (admin only in the database) with a yellow "Preview" bar and `noindex`. The draft-mode cookie alone grants nothing. "Exit preview" (`?disable=1`) turns it off.
- **Menu scheduling** (FR-15): `release_menu_week(schedule | cancel_schedule)`. A scheduled menu is live at its go-live time by the database rule, with no job; the page cache catches up within 60 seconds. The optional Supabase Cron notifier that calls `POST /api/revalidate` at go-live (`supabase/ops/menu_go_live_cron.sql`) is **not set up and untested**; it needs `REVALIDATE_SECRET` in Supabase Vault and the app URL.
- `POST /api/revalidate`: `Authorization: Bearer <REVALIDATE_SECRET>`, optional body `{"reason":"menu_go_live"|"smoke_test"}`, 30 requests a minute per address, 503 when no secret is configured. `GET /api/health`: `{status, version}`, no backend call.

## 5. Media (FR-21)

`uploadMediaAction` (raised server-action body limit 9 MB in `next.config.ts`): alt text required; the bytes are **decoded** with `sharp` (a GIF, SVG or script renamed `.jpg` is refused), only JPEG, PNG and WebP, at most 8 MB and 6000 px on the longest side, re-encoded to a master of at most 2000 px (EXIF, GPS and other metadata are dropped), at most 2 MiB (large PNG becomes WebP), stored in the public `media` bucket under its SHA-256 name, then the `media` row is inserted. This differs from architecture sec. 8.5 (signed upload to `media-incoming` first): the file goes to the server action directly, so the private `media-incoming` bucket is unused. `deleteMediaAction` refuses an image that is in the live release or a scheduled menu, or on a menu slot; draft uses (dishes, page images) are detached after the confirmation in the dialog. Not transactional across Storage and the database (a failed row insert removes the stored file).

## 6. Contract changes applied (docs/database.md sec. 10)

Day index 0..6 to 1..7; `live` to `published`; phone `03XXXXXXXXX` to `+923XXXXXXXXX`; RPC names and parameter names; `dashboard_overview` and `change_history` views; PT400 to field errors (or "blocked" for publish), PT403 to "forbidden", PT404 to "not found"; statuses, balances and totals come from the views (`subscription_status`, `period_payment_status`, `customer_summary`, `dashboard_overview`). All mapping is in `src/admin/server/mappers.ts` and `errors.ts`. The former front-end stand-in maths for statuses and money now lives only in `src/admin/mock/` (`status-rules.ts`, `ledger.ts`) for the test mock; production code does not import it. What stays in the front end is formatting, form suggestions (default end date and amount) and the payments list total. The Plans screen shows the database-computed monthly price (read from the draft document) instead of recomputing it.

## 7. Code map

| Path | What |
|---|---|
| `proxy.ts` | Auth gate for `/admin` |
| `src/lib/env.ts`, `src/lib/supabase/server.ts`, `src/lib/auth/*`, `src/lib/request.ts` | Config, Supabase clients (server only), guard, session policy, throttling |
| `src/admin/server/*.ts` | Server actions by area: `auth`, `content` (+ `collections`), `menu`, `media` (+ `media-processing`), `publishing`, `overview`, `customers`, `subscriptions`, `payments`; shared `run`, `result`, `errors`, `mappers`, `audit`, `pending` |
| `src/admin/actions-repository.ts` | The browser-side `AdminRepository` that calls the actions |
| `src/admin/mock/*` | Test-only in-memory repository |
| `src/content/*` | Public reader, document mapper, last-good file |
| `app/api/health`, `app/api/revalidate`, `app/admin/preview` | Route handlers |
| `scripts/staging-integration.mjs`, `scripts/verify-offline-fallback.mjs` | Integration checks |

## 8. Commands and evidence (`docs/test-results/stage3/`)

| Command | What it covers |
|---|---|
| `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` | Static checks, unit tests, production build |
| `npm run db:test` | 606 SQL assertions on a local PostgreSQL 16 (not Supabase) |
| `npm run test:e2e` | Mock e2e suite (Chromium) with `TIFFINBOX_TEST_MOCK_BACKEND=1` set by the Playwright config |
| `npm run test:fallback` | Real production server, backend pointed at a closed port: last-good fallback, designed error state, admin guard without configuration. No Supabase needed |
| `npm run test:staging` | **Needs `.env.local`.** Public role against the staging project: `get_public_content()` works; reads of customers, payments, subscriptions, site_settings (and every other table and view) refused; writes refused; admin functions refused. Prints `missing` and exits 2 (NOT RUN) when the environment is incomplete |
| `npm run test:e2e:staging` | **Needs `.env.local`; the admin flows need `E2E_ADMIN_*`.** Starts the app on the real backend; public pages and the admin guard need no credentials; the admin specs skip with a clear message without them |

## 9. Steps for the Engineering Lead (staging)

**A. Environment.** Create `.env.local` in the repo root with `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` (names are in `.env.example`; paste values yourself, never into chat). Optionally `REVALIDATE_SECRET` (`openssl rand -base64 32`) and `LAST_GOOD_CONTENT_PATH`.

**B. Supabase Auth settings (dashboard, staging project).** Authentication > Sign In / Providers: turn **off** "Allow new users to sign up" (architecture sec. 7: admin accounts are created by the project owner), and under Email set the minimum password length to 12 (matches the app's rule). This was not verified by the agent.

**C. Create the first admin user.**
1. Supabase dashboard > Authentication > Users > **Add user** > Create new user. Enter the admin's email and a strong password (you type it; nobody else sees it). Tick **Auto Confirm User**.
2. Copy the new user's **User UID**.
3. Dashboard > SQL Editor (runs as the project's `postgres` role, no database password needed), run (replace the UID and name):
   ```sql
   insert into public.admin_users (user_id, display_name, role)
   values ('<USER-UID>', 'Owner Name', 'owner');
   ```
4. Check: `select user_id, display_name, role, is_active from public.admin_users;` shows the row with `is_active = true`.
5. `npm run dev`, open `http://localhost:3000/admin`, sign in. The Dashboard should show figures from the synthetic seed. A user in Authentication **without** a row in `admin_users` can sign in to Supabase but gets the same "Email or password is not correct." and no data.
6. For the staging e2e specs, create a **second** account the same way (role `staff`, display name `E2E`), and put `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` in `.env.local` yourself.

**D. Run the checks that were NOT RUN here**, in this order, and save the output to `docs/test-results/stage3/`: `npm run test:staging`, `npm run test:e2e:staging`, then walk through: sign in, edit a plan price, Preview, Publish, open the public site (visible within a minute), Roll back, schedule a menu week, upload a real JPEG (check the stored file has no EXIF), record a payment and void it, open Change history. Also confirm in the Supabase dashboard that Storage bucket `media` exists with the policies from migration 10.

## 10. Known limitations and untested

- **Untested against Supabase:** sign-in, `getClaims` refresh, cookies, every server action against PostgREST (column lists, embeds, RPC parameter names were checked against the migrations by reading, not by running), the error mapping from real PostgREST errors, Storage upload and delete, `get_draft_content` preview, cache expiry timing (the 60 second window), `updateTag` read-back, the Cron notifier. Unit tests use fakes.
- Throttling and rate limits are in memory: they reset on restart and do not span instances (one instance planned). Supabase's own limits are the control that cannot be bypassed.
- Idle and absolute session limits are enforced by this app's cookies; a user could keep their own cookie fresh, but the Supabase session itself still expires. Set Supabase's own session time-box (Pro) as the second control.
- Lists read up to 5000 rows per query (customers, payments, dues, history 500); beyond that they would need real pagination in the screens (sizing assumption is under 1000 customers).
- The publish check list comes from the database's `publish_errors` (placeholders, unpriced plans); it has no separate alt-text item because the database already requires alt text on every image.
- A content publish releases the live menu week's pending edits in a second call; if that call fails, the content release stays live and the screen says so.
- Image delete is not transactional across Storage and the database; a menu slot photo cannot be detached from the UI (no screen sets one yet).
- Real photos are not yet shown on the public pages (they use the labelled placeholders); the data and URLs exist (`dishes.image`, `page_images`). Wiring `next/image` needs the Storage host in `images.remotePatterns` and a decision on the optimiser.
- `anonymise_customer` exists in the database but no screen calls it yet. Billing periods are not listed in Change history (derived from the subscription).
- The "give a reason when the amount differs from the plan price" rule for subscriptions stays in the browser form; the server enforces the hard rules only.
- Password reset by email (Q-02) is not built; a forgotten password is reset in the Supabase dashboard.
- Search runs on the server over rows read page by page (customer text never goes into a URL), not as an indexed query; fine at the sizing assumption.
