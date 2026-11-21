# CREATEEX TECH — MILESTONE APPROVAL

**Project name:** Tiffin Box — marketing website + admin dashboard (`createexapple/tiffinbox-website`)

**Current stage:** 1 — UI/UX Design

**Build version or artifact reference:** tag `stage1-v1` (design files and a static prototype; there is no build)

**Git commit:** the head commit of this pull request (`develop`). Design work is in `1708db6` on `stage1/design`.

**Completed work:**
- Design system: `design/design-system.md`, `design/tokens.css` — brand colours and fonts from the brief, type scale, spacing, components, status badges, accessibility notes.
- Clickable static prototype: 7 public pages (S-01..S-07) and 17 admin screens (A-01..A-17), linked from `design/prototype/index.html`. Public pages use the brief's copy, prices and sample menu.
- `design/screens.md`: FRs and required states per screen, journeys J1..J8 mapped to pages.
- `design/assumptions.md`: 27 design assumptions, each tied to an open client question, plus decisions not tied to a question.
- `docs/design.md`: index of the above.

**Preview or test build:** no hosted link. In the repo: `design/prototype/index.html` (open in a browser after cloning). No Figma file and no Claude Design artifact exist.

**Tests executed:** no automated test suite (there is no application code). Checks run on 2026-11-21:
1. Contrast script `node design/contrast-check.mjs` — 75 colour pairs.
2. Designer's link checker over the prototype — 25 pages, 846 local links.
3. Horizontal-overflow check at 360px width in a browser — all 24 screens linked from the index.
4. Visual check in a browser — 5 of 24 screens (Home, Menu, Customers at phone width; Dashboard, Plans at desktop width); no console errors on those.

**Tests passed:** 1: 0 failures. 2: 0 problems (designer's report; not re-run after the review fixes, which changed no links). 3: 0 pages overflow after fixes. 4: no defects seen on the 5 screens.

**Tests failed:** 3 initially failed on 16 admin screens (top bar and table actions wider than the screen); fixed in CSS and re-checked. The prototype also followed the device's dark mode instead of the brand cream; pinned to the light theme.

**Known defects:** none logged in `docs/bugs.md`. Not verified: 19 of 24 screens by eye; 768px width; the nav toggle, FAQ accordion, tabs and dialogs; 200% text size; keyboard navigation; older Safari (the office fields on A-14 rely on CSS `:has`, Safari 15.4+).

**Outstanding work:**
- Client inputs still missing: logo files, food photos, WhatsApp number, order hours, website address (all placeholders in the prototype).
- Client answers to the blocking-for-design questions were not received; the design rests on the PRD assumptions (see `design/assumptions.md`): Q-01, Q-02, Q-12, Q-15, Q-18, Q-25, Q-28, Q-29, Q-31.
- Copy needing review by a native speaker and the client: Roman-Urdu headlines beyond the brief, the three Home benefits, the About story.
- Not designed: delete personal data (Q-34), email password reset (Q-02), and everything out of v1 scope.
- PRD corrections flagged at Stage 0 and by the designer are still open: NFR-10 iOS floor, FR-27 status precedence and renewal window (7 days flags every weekly plan for its whole term), FR-29 period definition, FR-30 "active subscribers", FR-13 forgot password, FR-16 numeric price vs the brief's "Rs 550–600".

**Technical risks:**
1. Design may need rework once the real logo and photos arrive and the client answers the open questions (button colour, menu per plan, admin roles).
2. The Student plan shows "Rs 550–600" publicly but 575 in the admin editor; one price must be confirmed before launch.
3. Draft Roman-Urdu copy could ship unreviewed if nobody is named to approve it.
4. Added beyond the PRD: a rollback list on the publish screen (supports NFR-08) and unused dark-mode tokens. Say if either should be removed.

**Engineering Lead verification:** _(Engineering Lead fills: what they personally checked, date)_

**CEO decision required:**
1. APPROVE — Move to the next stage.
2. REQUEST CHANGES — Revise the current stage.
3. HOLD — Stop the project.

**How to decide:** on this PR in GitHub, choose **Approve** or **Request changes**; comment **HOLD** to stop. Merging this PR yourself also counts as approval (approval workflow, section 2).
Approving by chat or WhatsApp does not count. Any new commit after your review needs a new review.
