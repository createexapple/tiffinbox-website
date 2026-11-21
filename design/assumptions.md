# Design assumptions (each tied to an unanswered client question)

Nothing below is a client decision. All are marked in the prototype with a dashed "Design note", a `Q-nn` tag or a placeholder. Q-numbers are from `docs/PRD.md` section 11.

| ID | Q | What the design assumes | Where | If the answer differs |
|---|---|---|---|---|
| AS-01 | Q-01 | Admin v1 = content management plus staff-entered customers, subscriptions, payments and overview, exactly as the PRD inventory lists (A-01..A-17). | All admin pages | If the client declines CR-002, A-12..A-17 and the overview cards are dropped; A-01..A-11 stand alone. |
| AS-02 | Q-18 | "Order on WhatsApp" and the persistent button are deep green #1F5134 with a cream label (8.53:1). Gold is used only as an accent fill with a dark-green label, never as text or edge on cream. | Header, persistent button, order block | A "WhatsApp green" would need its own contrast check. |
| AS-03 | Q-12 | Logo = round green badge, gold ring, Latin text "Tiffin Box", labelled "logo placeholder". The Urdu name is not typed anywhere. | Header, footer, admin | Replace one component with the supplied SVG. |
| AS-04 | Q-13 | No photos: dashed boxes labelled "client photo" with fixed aspect ratios so real photos drop in without layout change. No stock or generated food images. | S-01, S-02, S-06, A-09 | Swap boxes for images. |
| AS-05 | Q-14 | The 3 Home benefits are draft copy built from the brief (on time, home taste, fair price). "Our story" is "[client to supply]"; the brief's mission line is shown meanwhile. Roman-Urdu headlines beyond the brief ("Khana, bina jhanjhat", "Aap ke liye", "Teen steps, ek message", "Yeh page nahi mila", "Kuch masla ho gaya", "Apna plan chunein", "Apni pasand ka khana", "Ghar se door, ghar ka swaad", "Bhook lagi? Bas HI bhejein") are my drafts and need a native-speaker review. | S-01..S-07 | Replace text. |
| AS-06 | Q-15 | Static copy (benefits, story, how-it-works steps) is developer-maintained, so there is no admin screen for it. | Admin | If the owner must edit it, add one "Page text" screen. |
| AS-07 | Q-25 | One menu table for everyone, with a note under it explaining Budget (daal or sabzi + 2 roti) and Office Lunch (lunch only). | S-02 | Per-plan menus would add plan tabs to S-02 and a plan selector to A-03. |
| AS-08 | Q-08 | Public Plans page prints "Rs 550-600" as in the brief. Admin A-04 pre-fills 575 (the figure that matches Rs 8,050 = 575 x 14) with a hint; a range is rejected by validation. Public and admin therefore differ in the prototype on purpose. | S-03, A-04 | Enter the confirmed single price. |
| AS-09 | Q-10 | No monthly price is shown publicly ("save 5% monthly" is text). In A-04 a "monthly price check" table shows 4 x weekly - 5% for the admin to verify; in A-15 the monthly amount is typed by hand. Sample monthly amounts in admin data (Rs 30,590, Rs 12,540) are computed that way and are sample data only. | S-03, A-04, A-15, A-12..A-17 | Change the formula; sample data changes. |
| AS-10 | Q-09 | Team deal is text only ("team discount and one monthly invoice"); no amount. | S-03, A-04 | Add an amount field if decided. |
| AS-11 | Q-21 | The "Rs 50-150 more" premium rule is NOT shown on Customize (FR-08); only fixed dish prices. | S-04 | One line of copy once wording is confirmed. |
| AS-12 | Q-04, Q-05, Q-06, Q-27 | WhatsApp number, order hours, website, legal name/address appear as bracketed placeholders; WhatsApp links open an explanatory note in the prototype. A-08 leaves number and hours empty and A-10 shows the publish check that blocks until they are set. | Public pages, A-08, A-10 | Fill in settings. |
| AS-13 | Q-24 | Next-week menu default go-live is Sunday 6:00 PM, shown with a note. Menu week runs Mon-Sun. | A-02, A-03 | Change default. |
| AS-14 | Q-28 | Skip/pause are explained as WhatsApp requests. In admin, "paused" is a manual status; there is no skip counter and no automatic extension. "Skips allowed per week" is a text-only setting (not in FR-20; added so the rule is not hardcoded). | S-05, A-08, A-15 | Skip tracking needs new screens and a change request. |
| AS-15 | Q-29, Q-30, Q-31 | No invoice generation, receipt generator or delivery list. Screens remind staff that receipts are sent manually on WhatsApp. | A-13, A-17 | New screens via change request. |
| AS-16 | Q-02 | One admin role. No role screens. Password change in A-08; no email password-reset flow. | A-01, A-08 | Add roles and reset flow. |
| AS-17 | Q-23 | Admin works on phone and desktop (cards on phones, sidebar from 1024px), English only. | All admin | Could simplify to desktop only. |
| AS-18 | Q-32, Q-33 | Grace days (default 0) and renewal window (default 7) are settings in A-08. Finding: with a 7-day window every weekly plan is "renewal due" for its whole life; the prototype keeps 7 per the PRD but hints at 2. | A-08, A-12, A-13 | Choose the number. |
| AS-19 | Q-34 | Archive is the default action. "Delete personal data" is mentioned as a separate, confirmed action but its screen and wording are not designed (retention rules unknown). | A-13 | Design the flow once rules exist. |
| AS-20 | Q-35 | Partial payments are allowed and shown as a balance (Office Sample Traders). | A-13, A-16, A-17 | Simplify. |
| AS-21 | Q-19 | No Urdu webfont; brand name only in the logo image. | Global | Add font if needed. |
| AS-22 | Q-22 | No analytics or cookie banner designed (site collects no personal data). | Public | Add privacy note and banner. |
| AS-23 | Q-17 | No refund wording on the site and no refund entry in payments. | S-05, S-06, A-17 | Add FAQ item and payment type. |
| AS-24 | Q-11 | Delivery area text is "Johar Town, Lahore, around UMT" plus "[delivery area text, Q-11]" on About. | S-06, A-08 | Replace text. |
| AS-25 | Q-16 | No Punjab Food Authority badge or number shown. | Footer | Add badge slot. |
| AS-26 | Q-20 | "Last time to order for next-day delivery" is an empty setting; public copy repeats the brief only ("first meal can arrive the next day"). | A-08, S-05 | Fill in. |
| AS-27 | Q-36 | No import screen for existing customer records. | Admin | New screen via change request. |

## Decisions not tied to a question (flagged for the CEO)
- DN-01 Dark mode tokens exist and are contrast-checked, but dark mode was not requested in the PRD. Remove if unwanted.
- DN-02 A-10 shows "Earlier versions / Roll back" because NFR-08 and architecture sec. 8.1 require rollback, although the PRD screen inventory lists no rollback state for A-10.
- DN-03 Extra states beyond the PRD list: S-06 "no FAQ entries", S-03 "plan not published", A-10 "publish check failed", A-13 "saved".
- DN-04 Customer search uses a POST form field; filters are not put in the URL (NFR-12). Prototype links use file names; production uses random IDs.
- DN-05 Fonts load from Google Fonts in the prototype only; production self-hosts (NFR-11).
- DN-06 Sample "today" in admin data is Sunday 22 Nov 2026; sample customers are obviously synthetic (Sample, 0300-000000x, example.test).

## Orchestrator review notes (2026-11-21)
- The prototype pages are pinned to the light (brand cream) theme with `data-theme="light"`. The dark tokens (DN-01) stay in `tokens.css` as an unrequested proposal but are not shown, so the CEO sees the brand colours whatever the device setting.
- Admin top bar wraps below 640px; it overflowed the viewport at 360px before this fix.
