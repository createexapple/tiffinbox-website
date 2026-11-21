# CREATEEX TECH — MILESTONE APPROVAL

**Project name:** Tiffin Box — marketing website + admin dashboard (`createexapple/tiffinbox-website`)

**Current stage:** 0 — Requirements & Architecture

**Build version or artifact reference:** tag `stage0-v1` (documents only; there is no build)

**Git commit:** the head commit of this pull request (`develop`). Stage 0 content was written in `1eae2f5` on `stage0/requirements`, merged through PR #1.

**Completed work:**
- Intake record and the client's 7-page brief filed in `intake/`.
- `docs/PRD.md` v0.2: 30 functional requirements with acceptance criteria, 12 non-functional requirements, 24 screens (7 public, 17 admin), 8 user journeys, 26 assumptions, 36 open questions for the client.
- `docs/traceability.md`: one row per requirement.
- `docs/change-requests.md`: CR-001 (content admin) and CR-002 (customers, subscriptions, payments). Both are **Proposed**. Neither is in the client's brief; both came from Engineering Lead instructions in the working session.
- `docs/architecture.md` v0.1, `docs/api/openapi.yaml` (outline), ADR-0001 stack and hosting, ADR-0002 data store and auth, ADR-0003 publishing and rendering (all **Proposed**).
- Effort estimate (PRD section 12), in working days: six-page site alone 15-23; CR-001 adds 22-34; CR-002 adds 17-29; total with both 54-86. Estimates, not commitments; calendar time, CEO gates and client waiting are excluded.
- Proposed running cost for production: about USD 39-40 a month (Supabase Pro 25, Azure App Service B1 about 13, domain 1-2). The Azure and domain figures are from the architect's recollection, not verified this session.

**Preview or test build:** none — no application code exists.

**Tests executed:** not run — there is no code to test. Document checks only: `openapi.yaml` loads as YAML with no missing references; every FR and NFR has a row in the architecture's requirement table; every screen appears in a journey (grep checks by the authoring agents).

**Tests passed:** not applicable

**Tests failed:** not applicable

**Known defects:** none logged (`docs/bugs.md` is empty). Known gaps in the documents: the two Mermaid diagrams in the architecture were not rendered; the OpenAPI outline was not run through an OpenAPI validator; colour-contrast figures in NFR-03 are hand calculations.

**Outstanding work:**
- Client answers to 36 open questions. Blocking for design: Q-01 (confirm the admin scope), Q-02 (admin users and roles), Q-12 (logo files), Q-15 (is static page text admin-editable), Q-18 (green or gold button), Q-25 (which meals the Menu page shows per plan), Q-28 (skip and pause tracking), Q-29 (office invoices), Q-31 (daily delivery lists).
- Blocking for launch: WhatsApp number, domain, order hours, final prices (Student plan Rs 550-600 vs the Rs 575 the weekly price implies; monthly price; team discount), delivery boundary, food photos, About story, refund rule, PFA registration, customer-data retention.
- PRD items the architect flagged for correction: iOS floor in NFR-10 (recommend 16.4+), status precedence in FR-27, period definition in FR-29, meaning of "active subscribers" in FR-30, no "forgot password" in FR-13.
- A security-engineer read of architecture sections 7 and 8.5 has not been done.

**Technical risks:**
1. Scope is unconfirmed by the client: the admin dashboard is not in the brief and is about 72% of the estimated effort.
2. Personal and payment-record data could be exposed by a wrong database access rule or a compromised admin account. Mitigations are designed (default-deny rules, rule tests in CI, security reviews) but nothing is built.
3. Hosting behaviour is unproven: page caching on Azure App Service and speed from Lahore are assumptions, to be tested in a one-day spike at the start of Stage 2.
4. Billing rules (monthly period, grace days, partial payments) may not match how the owner works.
5. Launch depends on client inputs and accounts that do not exist yet (logo, photos, prices, number, domain, hosting owner and budget).

**Decisions inside this approval:** approving this PR accepts the PRD scope including CR-001 and CR-002, and the proposed architecture (one Next.js app plus Supabase, no separate API server; Azure App Service; Supabase Pro for production). If any of these should change, choose Request changes and say which.

**Engineering Lead verification:** _(Engineering Lead fills: what they personally checked, date)_

**CEO decision required:**
1. APPROVE — Move to the next stage.
2. REQUEST CHANGES — Revise the current stage.
3. HOLD — Stop the project.

**How to decide:** on this PR in GitHub, choose **Approve** or **Request changes**; comment **HOLD** to stop.
Approving by chat or WhatsApp does not count. Any new commit after your review needs a new review.
