# Status
- Current stage: 3 — Backend & Integration (in progress)
- Last approved stage: 2 — milestone PR #10, `verify-approval.sh` PASS (CEO merge on `325ab63`), `approvals/APPROVALS.md` row 7
- Updated: 2026-11-23

## In progress (branch `stage3/backend`, one writer at a time)
| Task | FRs | Owner | State |
|---|---|---|---|
| T3.1 Schema migrations, RLS, audit triggers, seeds, database tests (content + access) | FR-13..23, NFR-07, 12 | database-engineer | implemented; 606 DB assertions pass on local PostgreSQL; applied to Supabase staging by the Engineering Lead; staging anon checks 100/100 (`docs/test-results/stage3/staging-integration-2026-11-22.txt`) |
| T3.4 Operations schema: customers, subscriptions, periods, payments, status views, tests | FR-24..30 | database-engineer | as T3.1 |
| T3.2 Auth, guard, content server actions, media pipeline | FR-13..21 | backend-developer | implemented; 260 unit tests pass; admin sign-in on local + staging DB confirmed by the Engineering Lead in the browser BEFORE the SEC-01 change; sign-in after the SEC-01 change confirmed by the Engineering Lead on the Vercel staging host (2026-11-23, human check, no saved evidence); staging e2e admin flows NOT RUN |
| T3.3 Publish, preview, rollback, menu scheduling, public read path on real data | FR-06, 14, 15, 22 | backend-developer | implemented; public read path confirmed on staging (local and Vercel); publish/rollback/menu on staging NOT tested |
| T3.5 Operations server actions and screens on real data; overview | FR-24..30 | backend-developer | implemented; admin pages load for a signed-in admin (HTTP 200); create/edit flows on staging NOT tested |
| T3.6 RLS and auth review | NFR-07, 12 | security-engineer | done: `docs/security/stage3-security-review.md` (0 Critical/High, 4 Medium, 8 Low, 2 Info). SEC-01 fixed, SEC-04 partly fixed (5d7d47a); fixes not yet re-verified by the reviewer. SEC-02 (sign-up off on staging) unconfirmed. SEC-03 (staff = owner) needs a product decision |

## Staging host
- Vercel Hobby, project `tiffinbox-website2`, https://tiffinbox-website2.vercel.app, tracks `stage3/backend`. Set up by the Engineering Lead 2026-11-23; smoke-checked by curl the same day (see `docs/deployments.md`). Preview only: not the approved production host (ADR-0001 = Azure App Service).

## Blockers
- **Repo visibility:** `createexapple/tiffinbox-website` became PUBLIC on 2026-11-22/23 (was private). Contains the client brief and the security review. Engineering Lead asked to set it back to private; still public at last check (2026-11-23).
- A copy repo `createexapple/tiffinbox-website2` (private, `main` only) was created by the Vercel import; unused, to be deleted by the Engineering Lead.
- GitHub Actions has never run on this repo (empty run list); cause not investigated.
- Supabase staging Auth settings (sign-up off, password length 12) not confirmed (SEC-02).
