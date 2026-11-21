# ADR-0002: Supabase PostgreSQL with row-level security as the data store; Supabase Auth for admins
Date: 2026-11-21
Status: Proposed (takes effect only with CEO approval of Stage 0)

## Context
- Data: site content (menu weeks, plans, dishes, add-ons, FAQ, settings, images) and, with CR-002, personal and financial records (customers, subscriptions, payments) plus an audit trail (FR-23).
- The operations data is relational: a customer has subscriptions, a subscription has periods and payments, and the dashboard needs filters, sums and date-based statuses (FR-25, FR-27, FR-29, FR-30).
- NFR-12: access control enforced server-side and at the database; no real customer data outside production; backups; audit of every change. NFR-07: hashed passwords, throttled login, expiring sessions.
- Only admins log in. Roles are not decided (Q-02); v1 assumes one role (A-06).
- Official data stores: PostgreSQL, MongoDB, Firebase, Supabase.

## Decision
1. **Supabase PostgreSQL** is the single data store for content and operations data. Schema, policies, views, functions and the cron job are SQL migrations in the repo (`supabase/migrations`).
2. **Row-level security on every table, default deny.** The public role has no table privileges; it may execute one function, `get_public_content()`. Active admins (a row in `admin_users`) get the rights listed in `docs/architecture.md` section 7. `audit_log` is append-only and written by triggers.
3. **All database access from the web app is server-side** and uses the signed-in admin's own token, so RLS always applies. The browser never calls Supabase. The service-role key is not used by the application at runtime.
4. **Supabase Auth, email + password**, public sign-up disabled. Admin accounts are created in the Supabase dashboard by the project owner. `admin_users.role` (`owner`/`staff`) exists from the start but v1 policies treat all active admins alike; a restricted role (Q-02) is added later by policy, not by schema change.
5. **Money and status rules live in the database** (constraints, views `subscription_status`, `period_payment_status`, `dashboard_overview`; functions for publish, menu release, subscription creation, void, anonymise) and are covered by database tests.
6. **Supabase Storage** for food images: a private incoming bucket and a public bucket of sanitised masters.
7. **Plans:** production on Supabase Pro in a CEO- or client-owned organisation; staging on Free in a separate Createex organisation with synthetic data only.

## Alternatives considered
| Option | Why not chosen |
|---|---|
| Firebase (Firestore + Firebase Auth) | Document store fits content but not payments/dues: no joins or sums across customers, subscriptions and payments without denormalising or extra code; security rules are harder to test for this shape; date-based status filters would need jobs |
| MongoDB (Atlas) + own API | Same relational mismatch, and needs an API server and our own auth |
| Self-managed PostgreSQL on Azure + NestJS + own auth | Meets the requirements but adds a server, password handling, backup management and 8 to 12 or more working days; Azure managed Postgres alone costs about as much as Supabase Pro |
| Content as files in the repo (no database) | Only viable if both change requests are rejected; every edit becomes a developer change and a CEO deploy |
| Browser talks to Supabase directly (client-side SDK) | Works with RLS, but exposes the token to page JavaScript and ties the artifact to one environment's keys; server-side access is simpler to reason about for personal data |
| Supabase Free for production | No automatic backups and projects pause after a week without activity (both verified on supabase.com/pricing, 2026-11-21); fails NFR-08 unless the CEO accepts the risk in writing |

## Consequences
- Positive: access control cannot be bypassed by a bug in page or action code; one vendor for database, auth, storage and cron; standard SQL keeps the data portable; daily backups on Pro.
- Negative: business rules in SQL need engineers comfortable with PostgreSQL and pgTAP; RLS mistakes are the main security risk and must be tested for every table in CI and reviewed by security-engineer (risk S1).
- Negative: Supabase Pro is about USD 25/month, the largest running cost; recovery point is up to 24 hours unless the USD 100/month point-in-time add-on is bought (not recommended).
- Admin account management happens in the Supabase dashboard in v1. In production that means the CEO or the client's account owner creates and removes admin logins and resets passwords unless email reset is enabled (Q-02), which needs an email provider approved by the CEO.
- Session idle timeout is implemented in the app; Supabase's own session time limits (Pro) are set as a second control.
