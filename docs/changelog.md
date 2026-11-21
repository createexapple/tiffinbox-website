# Changelog
All notable changes. Format: Keep a Changelog.

## [Unreleased]
### Added
- 2026-11-21: Stage 0 package — intake, PRD v0.2 (30 FR, 12 NFR, 24 screens, 36 open questions), traceability, CR-001 and CR-002 (Proposed), architecture v0.1, OpenAPI outline, ADR-0001..0003 (Proposed). Documents only; no application code.
- 2026-11-21: Stage 1 design — design system, tokens, static clickable prototype (S-01..S-07, A-01..A-17), screens and assumptions docs. No application code.
- 2026-11-22: Stage 2 frontend — Next.js app, public site (FR-01..12) and 17 admin screens (FR-13..30) on labelled mock data; 150 unit and 133 e2e tests. No backend, no real auth.
- 2026-11-22: Stage 3 database — 11 migrations (19 tables with RLS, audit, publishing, menu, operations, status views), rollbacks, seeds, 606 database assertions on local PostgreSQL. Not yet applied to Supabase.
- 2026-11-22: Stage 3 backend — Supabase auth and guard, server actions for all admin areas, public read path with 60 s cache and last-good fallback, publish/rollback/preview, media pipeline, six new settings fields. 253 unit tests; staging integration NOT RUN.
