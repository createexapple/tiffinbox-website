# Change Requests
| ID | Date | Requested by | Change | Impact (time/cost/scope) | CEO decision | Status |
|---|---|---|---|---|---|---|
| CR-001 | 2026-11-21 | Engineering Lead (verbal, session instruction); not in the client brief | Add an admin dashboard for content management (login, weekly menu incl. scheduling, plans & prices, custom dishes, add-ons, FAQ, site settings, image upload, preview/publish) to the six-page public website. | Scope: adds FR-13..FR-23 and screens A-01..A-11 beyond the brief. Time: 22-34 working days on top of 15-23 for the six-page site (architect estimate, PRD section 12; not a commitment). Cost: for the CEO to price. Client has not yet confirmed the admin dashboard. | Pending | Proposed |
| CR-002 | 2026-11-21 | Engineering Lead (session instruction, issued after CR-001) | Extend the admin dashboard to track customers (incl. office teams), subscriptions and manually recorded payments, plus an overview (active subscribers, payments due, expiring plans). Staff-entered only: no customer login, no online payment (both stay out of scope). Skip/pause tracking, invoice generation, WhatsApp receipts, delivery lists and admin roles remain open questions (Q-28 to Q-31, Q-02), not in scope. | Scope: adds FR-24..FR-30, screens A-12..A-17, NFR-12 (personal-data protection), and elevates FR-23 to Should. Introduces storage of personal and financial data (security review, backups, retention). Time: 17-29 working days on top of CR-001, assuming CR-001 is approved (architect estimate, PRD section 12; not a commitment). Cost: for the CEO to price. Client has not confirmed it (Q-01). | Pending | Proposed |

## CR-003 — Admin-managed logo and page photos (Proposed)
- **Requested by:** Engineering Lead, working session 2026-11-23. Not in the client's brief.
- **Change:** the admin can place an uploaded image as the header logo, the Home main photo, the Menu page photo and the About page photo (FR-21 previously covered the image library only; the PRD treated the logo as a supplied file, Q-12).
- **Impact:** one migration (`20261123000012_page_image_slots.sql`, allowed slot keys only), content layer, three public pages, header, admin Images screen. No new tables, policies or roles.
- **Status:** implemented on `stage3/backend`; needs CEO acceptance with the Stage 3 milestone.

