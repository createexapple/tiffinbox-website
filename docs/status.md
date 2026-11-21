# Status
- Current stage: 3 — Backend & Integration (in progress)
- Last approved stage: 2 — milestone PR #10, `verify-approval.sh` PASS (CEO merge on `325ab63`), `approvals/APPROVALS.md` row 7
- Updated: 2026-11-22

## In progress (branch `stage3/backend`, one writer at a time)
| Task | FRs | Owner | State |
|---|---|---|---|
| T3.1 Schema migrations, RLS, audit triggers, seeds, database tests (content + access) | FR-13..23, NFR-07, 12 | database-engineer | implemented; 606 DB assertions pass on local PostgreSQL 16; NOT yet run on Supabase |
| T3.4 Operations schema: customers, subscriptions, periods, payments, status views, tests | FR-24..30 | database-engineer | implemented; covered by the same 606 assertions; NOT yet run on Supabase |
| T3.2 Auth, guard, content server actions, media pipeline | FR-13..21 | backend-developer | implemented; unit tests and mock e2e pass; NOT RUN against real Supabase (no local env file, no admin account) |
| T3.3 Publish, preview, rollback, menu scheduling, public read path on real data | FR-06, 14, 15, 22 | backend-developer | implemented; unit tests and mock e2e pass; NOT RUN against real Supabase (no local env file, no admin account) |
| T3.5 Operations server actions and screens on real data; overview | FR-24..30 | backend-developer | implemented; unit tests and mock e2e pass; NOT RUN against real Supabase (no local env file, no admin account) |
| T3.6 RLS and auth review | NFR-07, 12 | security-engineer | pending |

## Blockers
- Staging Supabase project `tifanbox` (ref `plkkvkonhigiuigkxklr`, Free plan, Tokyo) was created by the Engineering Lead on 2026-11-22. Repo linked; 11 migrations and both seeds applied by the Engineering Lead on 2026-11-22 (terminal output, no errors). The local env file does not exist yet and no admin account exists, so the app has never talked to it.
- GitHub Actions has never run on this repo (empty run list); cause not investigated.
- T2.1 hosting spike still not done (no staging host).
