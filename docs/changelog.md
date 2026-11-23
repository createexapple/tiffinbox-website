# Changelog
All notable changes. Format: Keep a Changelog.

## [Unreleased]
### Added
- 2026-11-21: Stage 0 package — intake, PRD v0.2 (30 FR, 12 NFR, 24 screens, 36 open questions), traceability, CR-001 and CR-002 (Proposed), architecture v0.1, OpenAPI outline, ADR-0001..0003 (Proposed). Documents only; no application code.
- 2026-11-21: Stage 1 design — design system, tokens, static clickable prototype (S-01..S-07, A-01..A-17), screens and assumptions docs. No application code.
- 2026-11-22: Stage 2 frontend — Next.js app, public site (FR-01..12) and 17 admin screens (FR-13..30) on labelled mock data; 150 unit and 133 e2e tests. No backend, no real auth.
- 2026-11-22: Stage 3 database — 11 migrations (19 tables with RLS, audit, publishing, menu, operations, status views), rollbacks, seeds, 606 database assertions on local PostgreSQL. Not yet applied to Supabase.
- 2026-11-22: Stage 3 backend — Supabase auth and guard, server actions for all admin areas, public read path with 60 s cache and last-good fallback, publish/rollback/preview, media pipeline, six new settings fields. 253 unit tests; staging integration NOT RUN.
- 2026-11-22: Staging integration run against Supabase staging: 100/100 (anon read/deny checks). Admin sign-in confirmed by the Engineering Lead in the browser; staging e2e admin flows still not run.
- 2026-11-22: Stage 3 security review (`docs/security/stage3-security-review.md`): no Critical/High; 4 Medium, 8 Low, 2 Info.
- 2026-11-23: CR-003 admin-placed logo and page photos (migration 12). CR-004 site content and pricing aligned with the app spec of 23 Nov 2026 (migration 13, `supabase/seed/03_app_spec_content.sql`, all six public pages, footer QR, Urdu name). 286 unit, 631 database assertions (local), 137 mock e2e. Migrations 12-14 applied to Supabase staging by the Engineering Lead; release v7 published; live site verified against the spec by curl.
- 2026-11-24: CR-004 addenda — public site rebuilt to the supplied design: one page with section navigation (old addresses redirect), light and dark schemes, bundled Urdu badge logo, hero illustration, Menu day tabs, plan cards with Choose buttons, Who's eating panel, Customize meal builder, WhatsApp order messages. 314 unit, 631 database assertions (local), 156 mock e2e. Admin unchanged.
### Security
- 2026-11-22: SEC-01 fixed — idle/absolute session limits now come from the signed token and an HMAC-signed activity cookie (`SESSION_SIGNING_SECRET` required on deployed environments). SEC-04 partly fixed — baseline security headers on all responses; a nonce-based script CSP is still open. 260 unit tests. Not yet re-verified by the security engineer; real-token sign-in after the change not yet confirmed.
