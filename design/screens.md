# Screens, states and journeys

Open `design/prototype/index.html` to click through. Every page has a section "States on this screen (prototype only)" at the bottom; the anchor in the table (e.g. `#state-error`) jumps to that variant. Public pages are designed at 360px first and also laid out for 768 and 1280; admin pages work on phone (cards, drawer menu, sticky action bar) and desktop (sidebar, tables).

Shared on all public screens (FR-01..04): logo placeholder top-left linking Home, six-link nav (toggle under 960px), persistent WhatsApp button, green "Order on WhatsApp" block as the last content above the footer, Instagram link in the footer (`@tiffinbox.lhr`, new tab, `rel=noopener`), footer.

## Public screens
| ID | File | FRs | PRD states and where shown |
|---|---|---|---|
| S-01 Home | `s-01-home.html` | FR-01..05 | default (page); loading images `#state-loading`; placeholder content `#state-placeholders` |
| S-02 Menu | `s-02-menu.html` | FR-06 | default with updated date (page; also `#state-updated-date`); no-current-menu fallback `#state-no-current-menu` |
| S-03 Plans & Pricing | `s-03-plans.html` | FR-07 | default (page); most-popular `#state-most-popular`; extra: unconfirmed price not published `#state-unconfirmed` |
| S-04 Customize | `s-04-customize.html` | FR-08 | default (page); empty add-ons `#state-empty-addons` |
| S-05 How it works | `s-05-how-it-works.html` | FR-09 | default (page; PRD requires nothing else) |
| S-06 About & Contact | `s-06-about.html` | FR-10, 11 | FAQ collapsed `#state-faq-collapsed` (also page default); FAQ expanded `#state-faq-expanded`; extra: no FAQ `#state-faq-empty` |
| S-07 404 / Error | `s-07-404.html` | FR-12 | not found (page, `#state-not-found`); data load failure `#state-load-failure` |

## Admin screens (`design/prototype/admin/`)
| ID | File | FRs | PRD states and where shown |
|---|---|---|---|
| A-01 Login | `a-01-login.html` | FR-13 | default (page); error `#state-error`; throttled `#state-throttled`; session expired `#state-session-expired` |
| A-02 Dashboard | `a-02-dashboard.html` | FR-13, 22, 30 | default (page); empty `#state-empty`; unpublished-changes `#state-unpublished` (also top-bar pill on every admin page); scheduled menu `#state-scheduled` |
| A-03 Menu editor | `a-03-menu-editor.html` | FR-14, 15, 21 | empty `#state-empty`; draft (Next week tab, `#state-draft`); scheduled `#state-scheduled`; validation error `#state-validation-error`; saved `#state-saved`. Tabs: This week (live) / Next week |
| A-04 Plans & pricing | `a-04-plans.html` | FR-16 | default (page); validation error `#state-validation-error`; saved `#state-saved` |
| A-05 Custom dishes | `a-05-dishes.html` | FR-17, 21 | empty `#state-empty`; list (page); add/edit `#state-add-edit`; delete confirm (live dialog from any Delete button, and `#state-delete-confirm`); extras: reorder `#state-reorder`, saved |
| A-06 Add-ons | `a-06-addons.html` | FR-18 | same set as A-05 |
| A-07 FAQ | `a-07-faq.html` | FR-19 | empty; list (page); add/edit; reorder `#state-reorder`; extras: delete confirm, saved |
| A-08 Site settings | `a-08-settings.html` | FR-13 (password), 20, 27 (renewal window) | default (page); validation error `#state-validation-error`; saved `#state-saved` |
| A-09 Media library | `a-09-media.html` | FR-21 | empty `#state-empty`; uploading `#state-uploading`; error `#state-error`; in-use warning (live dialog + `#state-in-use`); extra: picker `#state-picker` |
| A-10 Preview & publish | `a-10-publish.html` | FR-22 | no changes `#state-no-changes`; changes pending (page); publishing `#state-publishing`; success `#state-success`; failure `#state-failure`; extra: publish check blocked `#state-blocked`, rollback dialog |
| A-11 Change history | `a-11-history.html` | FR-23 | empty `#state-empty`; list (page); filter by record type `#state-filtered` |
| A-12 Customers list | `a-12-customers.html` | FR-24, 25, 27, 29 | empty `#state-empty`; list (page); search/filter `#state-search`; no results `#state-no-results`; dashboard deep links `#state-active`, `#state-expiring` |
| A-13 Customer detail | `a-13-customer.html` | FR-25..29 | default (page); office team view `#state-office`; archived `#state-archived`; renewal due `#state-renewal-due`; overdue `#state-overdue`; extra: saved, archive confirm |
| A-14 Customer form | `a-14-customer-form.html` | FR-24 | new (page); new office (live toggle, `#state-new-office`); edit `#state-edit`; validation error `#state-validation-error`; duplicate-phone `#state-duplicate-phone`; saved `#state-saved` |
| A-15 Subscription form | `a-15-subscription-form.html` | FR-26, 27 | new (page); edit `#state-edit`; renew pre-filled `#state-renew`; validation error `#state-validation-error`; overlap warning `#state-overlap` |
| A-16 Payments list | `a-16-payments.html` | FR-28, 29 | empty `#state-empty`; list with totals (page, two tabs); filters `#state-filters`; overdue highlighted `#state-overdue` |
| A-17 Record payment | `a-17-payment-form.html` | FR-28 | new (page); edit/void `#state-edit-void`; validation error `#state-validation-error`; duplicate-reference `#state-duplicate-reference`; saved `#state-saved`; extra: future-date warning `#state-future-date` |

Coverage gaps: none against the PRD state lists, with these notes. A-01..A-17 "loading" is not drawn as its own state (server-rendered pages; only A-09 uploading and A-10 publishing have progress). Success/empty/error states required by the role brief but not by the PRD (e.g. S-05 error, A-08 empty) are not drawn, per the PRD list. The S-01 loading state and S-07 failure state are drawn once, as frames.

## Journey walkthroughs (start at `prototype/index.html`, "Journey starting points")
| Journey | Click path |
|---|---|
| J1 New visitor decides to order | `s-01-home.html` -> "See plans" -> `s-03-plans.html` -> "Customize a meal" -> `s-04-customize.html` or "How payment works" -> `s-05-how-it-works.html`; at any step tap the WhatsApp button or end-of-page Order button (opens a prototype note) |
| J2 Check Sunday menu | `s-02-menu.html` -> "Customize your meal" -> `s-04-customize.html` -> Order on WhatsApp |
| J3 Sceptical visitor | `s-06-about.html` (story, FAQ) -> nav "How it works" -> `s-05-how-it-works.html`; Instagram link in the contact list (opens in a new tab); Order on WhatsApp |
| J4 Bad link | `s-07-404.html` -> "Go to Home" -> `s-01-home.html`, or Order on WhatsApp |
| J5 Publish weekly menu | `admin/a-01-login.html` -> Log in -> `a-02-dashboard.html` -> Menu -> `a-03-menu-editor.html` (Next week tab; "Add photo" -> `a-09-media.html`) -> "Preview & publish" -> `a-10-publish.html` -> Publish (dialog) -> `#state-success` |
| J6 Change prices, dishes, FAQ, settings | `a-02-dashboard.html` -> `a-04-plans.html` / `a-05-dishes.html` / `a-06-addons.html` / `a-07-faq.html` / `a-08-settings.html` (sidebar) -> `a-10-publish.html` -> `a-11-history.html` |
| J7 Sign up a customer, first payment | `a-02-dashboard.html` -> "Add customer" / `a-12-customers.html` (search by phone, `#state-no-results`) -> `a-14-customer-form.html` -> Save -> `a-13-customer.html` -> "Add subscription" -> `a-15-subscription-form.html` -> Save -> back to detail -> "Record payment" -> `a-17-payment-form.html` -> Save -> detail |
| J8 Follow up dues and renewals | `a-02-dashboard.html` cards (Overdue -> `a-16-payments.html#state-overdue`; Plans ending -> `a-12-customers.html#state-expiring`) -> customer (`a-13-customer.html#state-overdue`) -> "Record payment" (`a-17`) or Renew (`a-15-subscription-form.html#state-renew`) -> `a-11-history.html` |

Note: Save buttons are links that move to the next screen of the journey; no data is stored. Forms use `onsubmit="return false"`. Customer search uses a POST form field so search text never enters the URL (NFR-12).
