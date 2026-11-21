# Traceability
Stage 0 state (2026-11-21): requirements only. Nothing is designed, built or tested. API / Tests / Implemented / Tested / CEO accepted columns are intentionally empty. Priorities and sources: see `docs/PRD.md` section 4. Stage 2 update (2026-11-22): FR-01..FR-12 rows filled only where a test exists (public site, mock content, Chromium only, unit evidence in `docs/test-results/stage2/unit.txt`). Not verified by a human; CEO accepted column untouched.

| FR | Screens | API endpoints | Tests | Implemented | Tested (evidence) | CEO accepted |
|---|---|---|---|---|---|---|
| FR-01 Logo top-left + navigation | S-01..S-07 | | e2e `public-site.spec.ts`: one H1/landmarks, logo link, desktop + mobile nav (7 pages) | Yes, uncommitted on `stage2/frontend` (mock content) | e2e (chromium) docs/test-results/stage2/e2e.txt | |
| FR-02 Persistent WhatsApp button | S-01..S-07 | | e2e: persistent WhatsApp button on every page, placeholder note, no broken wa.me; unit `whatsapp.test.ts` | Yes, uncommitted on `stage2/frontend` (mock content) | e2e + unit; real wa.me link untested (no number, Q-04) | |
| FR-03 End-of-page green Order on WhatsApp button | S-01..S-07 | | e2e: Order on WhatsApp is last block above footer on every page; unit `whatsapp.test.ts` | Yes, uncommitted on `stage2/frontend` (mock content) | e2e + unit | |
| FR-04 Instagram link on every page | S-01..S-07 | | e2e: Instagram link, new tab, rel noopener on every page | Yes, uncommitted on `stage2/frontend` (mock content) | e2e | |
| FR-05 Home page content | S-01 | | e2e: Home headline, tagline, "Meals from Rs 300", 3 steps; unit `derive.test.ts`, `content.test.ts` | Yes, uncommitted on `stage2/frontend` (mock content) | e2e + unit | |
| FR-06 Menu page (this week's menu) | S-02 | | e2e: week label, 7 day rows, Customize link; unit `derive.test.ts` (current-week rule) | Yes, uncommitted on `stage2/frontend` (mock content) | e2e + unit; no-current-menu alert not e2e-tested | |
| FR-07 Plans & Pricing page | S-03 | | e2e: 4 plans, one most popular, weekly price, 5% saving, breakfast add-on | Yes, uncommitted on `stage2/frontend` (mock content) | e2e; Student price still unresolved (Q-08) | |
| FR-08 Customize page (dishes + add-ons) | S-04 | | e2e: dishes + add-ons with prices | Yes, uncommitted on `stage2/frontend` (mock content) | e2e; empty-state not e2e-tested | |
| FR-09 How it works page | S-05 | | e2e: delivery and skip table from settings | Yes, uncommitted on `stage2/frontend` (mock content) | e2e | |
| FR-10 About & Contact page | S-06 | | e2e: placeholders shown, contact list; FAQ present | Yes, uncommitted on `stage2/frontend` (mock content) | e2e | |
| FR-11 FAQ display | S-06 | | e2e: FAQ toggles by mouse and keyboard, 44px summary | Yes, uncommitted on `stage2/frontend` (mock content) | e2e | |
| FR-12 404 / error page | S-07 | | e2e: unknown URL returns 404 with H1 and Home link | Yes, uncommitted on `stage2/frontend` (mock content) | e2e; error fallback (data failure) untested | |
| FR-13 Admin login / logout / password | A-01, A-02, A-08 | | | | | |
| FR-14 Edit this week's menu | A-03 | | | | | |
| FR-15 Draft and schedule next week's menu | A-03, A-02 | | | | | |
| FR-16 Plans, prices and pricing rules | A-04 | | | | | |
| FR-17 Custom dishes | A-05 | | | | | |
| FR-18 Add-ons | A-06 | | | | | |
| FR-19 FAQ management | A-07 | | | | | |
| FR-20 Site settings | A-08 | | | | | |
| FR-21 Image upload / media | A-09, A-03, A-05 | | | | | |
| FR-22 Preview and publish | A-10, A-02 | | | | | |
| FR-23 Change history (Should) | A-11 | | | | | |
| FR-24 Customer records (create/edit/archive) | A-12, A-13, A-14 | | | | | |
| FR-25 Customer list, search, filter, detail | A-12, A-13 | | | | | |
| FR-26 Subscriptions (create/edit/renew) | A-13, A-15 | | | | | |
| FR-27 Subscription status and renewals due | A-12, A-13, A-15, A-08 | | | | | |
| FR-28 Record payments manually | A-13, A-16, A-17 | | | | | |
| FR-29 Payment status paid/unpaid/overdue and dues | A-12, A-13, A-16 | | | | | |
| FR-30 Dashboard overview | A-02 | | | | | |

Open dependencies that may change rows: Q-01 (confirm v1 admin scope), Q-15 (editable static copy), Q-25 (menu per plan), Q-28 to Q-31 (skip/pause tracking, office invoices, receipts, delivery lists: not FRs; would add FRs via change request), Q-02 (admin roles).
