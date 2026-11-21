# CREATEEX TECH — MILESTONE APPROVAL

**Project name:** Tiffin Box — marketing website + admin dashboard (`createexapple/tiffinbox-website`)

**Current stage:** 2 — Frontend

**Build version or artifact reference:** tag `stage2-v1`; app version `0.1.0` in `package.json`. No hosted build.

**Git commit:** the head commit of this pull request (`develop`). Frontend work is in `4a51ecd` (public site) and `2b0b8ec` (admin) on `stage2/frontend`.

**Completed work:**
- One Next.js 16.4.6 + TypeScript (strict) app at the repo root, plain CSS from the approved design tokens, fonts self-hosted at build.
- Public site, FR-01..FR-12: Home, Menu, Plans & Pricing, Customize, How it works, About & Contact, 404 and error pages; shared header, persistent WhatsApp button, end-of-page Order block, Instagram link; per-page SEO tags, sitemap, robots. Indexing is off by default.
- Admin, FR-13..FR-30: 17 screens (login, dashboard, menu editor, plans, dishes, add-ons, FAQ, settings, media, preview & publish, change history, customers, customer detail and form, subscription form, payments list, payment form), with validation and the states in the PRD inventory.
- All content and records come from clearly labelled mock data behind typed read/repository interfaces, ready to be replaced by Supabase at Stage 3.

**What is mock, by design at this stage:**
- Admin sign-in is not real authentication: no password is checked or stored.
- Nothing is saved: admin changes live in memory and are lost on reload.
- Publish, preview of drafts, rollback and menu scheduling are simulated.
- Status and money rules run in a frontend stand-in module; at Stage 3 they move to database views.
- Logo, photos, WhatsApp number, order hours and website are labelled placeholders.

**Preview or test build:** no hosted URL — no staging account exists (Q-03). Local only: `npm ci && npm run build && npm start`, then `http://localhost:3000` and `/admin`. Screenshots: `docs/test-results/stage2/screenshots/` (15 public, 60 admin, at 360px and 1280px).

**Tests executed:** (run 2026-11-22 on the commit above; outputs in `docs/test-results/stage2/`)
- `npm run lint`, `npm run typecheck`, `npm run build`
- `npm test` — 150 unit tests in 12 files
- `npm run test:e2e` — 133 Playwright tests, Chromium only (51 opt-in screenshot tests skipped)
- `npm audit`

**Tests passed:** lint, typecheck and build clean; 150 of 150 unit; 133 of 133 e2e; audit reports 0 vulnerabilities.

**Tests failed:** none in the final run. Defects found and fixed during the stage: Escape did not close the mobile menu; customers list overflowed at 360px.

**Known defects:** none logged in `docs/bugs.md`. Known limitations:
- Not tested: Safari/WebKit, Firefox, Samsung Internet, real devices (NFR-10); page speed / Lighthouse (NFR-01); automated accessibility scan, keyboard-only and screen-reader passes (NFR-03).
- No e2e test for: add-ons and FAQ screens (share code with the tested dishes screen), subscription edit/renew save, media picker selection, the public error fallback and empty states.
- Design-vs-build comparison is partial: 3 public and 3 admin screenshots compared by the developer, Home, Dashboard and Customers checked in a browser by the orchestrator. The other screens were not compared by eye.
- The public Student plan shows "Rs 550–600" with a "confirmed price needed" tag (Q-08); FR-07 says an unresolved price must not be published.
- No Open Graph share image (no logo or photo received).
- Opening a customer URL directly after a reload shows "not found" because mock data is in memory.

**Outstanding work:**
- Hosting spike (T2.1) and staging deploy pipeline (T2.2) were NOT done: no staging Azure or Supabase access. Page caching on the host, the outage fallback and speed from Lahore remain unproven and move to Stage 3 start.
- Deviations from the prototype for decision: only live-week menu edits count as unpublished changes; no notes field on the customer form; no per-slot menu photos; dues filtered by status and date only.
- Client inputs and answers still missing (logo, photos, WhatsApp number, hours, prices, open questions).
- Stage 3 needs: a staging Supabase project the team may use, and a decision on who owns the production accounts.

**Technical risks:**
1. Hosting assumptions untested (see above); if Azure App Service caching does not behave as designed, the host or approach changes.
2. Real authentication, access rules and data protection (NFR-07, NFR-12) do not exist yet; nothing here may be exposed publicly or given real customer data.
3. Next.js 16.4 is recent; the build fetches Google Fonts at build time and needs outbound network in CI and on the host.
4. Mock status/money logic must be replaced, not copied, by the database rules at Stage 3, or the two could disagree.

**Engineering Lead verification:** _(Engineering Lead fills: what they personally checked, date)_

**CEO decision required:**
1. APPROVE — Move to the next stage.
2. REQUEST CHANGES — Revise the current stage.
3. HOLD — Stop the project.

**How to decide:** on this PR in GitHub, choose **Approve** or **Request changes**; comment **HOLD** to stop. Merging this PR yourself also counts as approval (approval workflow, section 2).
Approving by chat or WhatsApp does not count. Any new commit after your review needs a new review.
