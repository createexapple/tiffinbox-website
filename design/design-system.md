# Tiffin Box design system (Stage 1, draft for CEO review)

Files: `design/tokens.css` (tokens, light + dark), `design/prototype/assets/site.css` (components as built in the prototype), `design/contrast-check.mjs` (contrast script). Brand source: client brief p5. Status: draft; nothing here is client-approved. No logo or photos received, so a labelled placeholder is used (Q-12, Q-13).

## 1. Colour
| Token | Value | Use |
|---|---|---|
| `--green-800` | #1F5134 | Brand deep green: headings, links, primary and WhatsApp buttons, focus ring on light |
| `--green-900` | #163D27 | Pressed/hover, footer, admin top bar |
| `--green-100` | #E3EEE7 | Tint: current nav item, selected option, note boxes |
| `--gold-500` | #F2B441 | Accent FILL only (badge, chip, gold button with dark-green label); text or ring ONLY on deep green |
| `--gold-100` | #FDF0D0 | Tint for prototype banner and `tag` labels |
| `--cream-50` | #FAF6EE | Page background; label on green buttons |
| `--cream-100` | #F2EBDC | Sunken sections, placeholders |
| `--cream-200` | #E4DAC3 | Decorative dividers only, disabled fill |
| `--brown-600` | #A9561A | Eyebrow/accent text on cream-50 and white only |
| `--brown-800` | #7A3C0E | Brown text on tinted or sunken backgrounds |
| `--ink-900 / 700 / 600` | #1D2A22 / #3F4B43 / #55615A | Body / secondary / muted text |
| `--line-strong` | #76705F | Form-control borders (3:1+) |
| Status pairs | ok #14602F on #DDF1E4; warn #7A4A00 on #FFEFC7; err #A3221B on #FBE4E1; info #1F4E79 on #E1ECF7; neutral #3F4B43 on #ECE6D8 | Badges, alerts |

Rules: gold is never text or an edge on cream or white (1.71:1). Gold buttons carry a dark-green label and sit on green or are used sparingly. The WhatsApp/Order button is deep green with a cream label (8.53:1), which resolves Q-18 provisionally (assumption AS-02). Status is never colour alone: every badge has a word plus a distinct marker shape (circle, square, triangle, diamond).

Dark mode: defined in `tokens.css` (follows the OS, `data-theme` overrides). It is a proposal, not a PRD requirement; all dark pairs are checked below.

## 2. Typography
Space Grotesk Bold for headings (`--font-head`), Inter 400/500/600/700 for body. No Urdu webfont: the Urdu brand name lives only in the logo asset (A-05). Prototype links Google Fonts; production self-hosts a Latin subset (architecture sec. 3). Sizes are rem so browser text-size and large-text settings scale everything; layouts use no fixed heights on text.

| Token | Size | Use |
|---|---|---|
| `--fs-xs` | 13px | Labels, tags (minimum) |
| `--fs-sm` | 14px | Hints, table headers |
| `--fs-base` | 16px | Body (line-height 1.6) |
| `--fs-lg` / `--fs-xl` | 18 / 20px | Lead text, h3/h4 |
| `--fs-2xl` | 24px | Admin h1, section titles |
| `--fs-3xl` | 28 to 36px fluid | Page h1 on content pages, h2 |
| `--fs-4xl` | 36 to 56px fluid | Home h1 |

## 3. Spacing, radius, touch
Spacing scale (4px base): 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80 (`--sp-1`..`--sp-20`). Gutters 16px at 360, 24px at 768, 32px at 1280. Content width 1152px; reading width 704px. Radius: 6 (sm), 12 (md), 20 (lg), pill. Touch targets: minimum 44px (`--tap`), 48px for primary actions (`--tap-lg`). Breakpoints: 768 (`48em`), 960 (`60em`, inline nav), 1024 (`64em`, admin sidebar), 1280.

## 4. Components (as built in the prototype)
| Component | Spec |
|---|---|
| Header + nav | White bar, logo placeholder top-left (links Home), six links. Under 960px: "Menu" toggle opens a full-width list (44px rows, current page = green tint + left bar + `aria-current`). From 960px inline, current = underline. Skip link first. |
| Persistent WhatsApp button | Fixed bottom-right pill, 48px high, deep green, cream label "WhatsApp" + chat icon, 2px cream ring, z-index above content. `body` has 88px bottom padding so it never covers the footer or the end-of-page button when scrolled to the end. Generic chat glyph (not the WhatsApp trademark). Link: `https://wa.me/<number from settings>?text=HI` (prototype opens a note). |
| End-of-page Order button | Last block above the footer: heading, one line, 48px deep-green button "Order on WhatsApp", full width up to 22rem. |
| Buttons | Primary/WhatsApp (green), secondary (green outline), gold (dark-green label, on green bands), danger (red), ghost (link style). All 44px+, 3px focus ring with 3px offset. |
| Cards | White, 1px border, 20px radius, soft shadow. |
| Plan card | 2px strong border; "Most popular" = 3px green border, raised shadow, gold badge with star + words. Price in Space Grotesk, weekly price at the bottom. Grid 1 / 2 / 4 columns (360 / 768 / 1024+). |
| Menu table to mobile | Real `<table>` on 768+. Under 768 each day becomes a card: day as heading, meals as label/value rows (CSS `data-label`), no horizontal scroll. Decision for FR-06 "Stage 1 decision". |
| FAQ accordion | Native `<details>/<summary>`, 44px+ summary, plus/minus marker, keyboard operable without JavaScript. |
| Form fields | Label above, 48px controls, 2px `--line-strong` border, hint below, error = icon + text + left bar (not colour alone), required marked with an asterisk and screen-reader text. |
| Status badges | Subscription: Active (green, circle), Paused (neutral, square), Upcoming (blue, triangle), Expired (red, diamond), plus "Renewal due" (amber, triangle). Payment: Paid (green), Unpaid (amber), Overdue (red, diamond). Content: Live, Scheduled, Draft. |
| Alerts | Info / success / warning / error with icon, bold title, optional actions; error uses `role=alert`. |
| Toast | Dark bar, check icon, message + link; `role=status`. Shown as state frames in the prototype. |
| Confirm dialog | Centered 28rem sheet, title, consequence in plain words, "Keep/Cancel" left of the destructive button (red). Opens via CSS `:target` in the prototype; production uses a real modal with focus trap. |
| Admin shell | Dark-green top bar (logo placeholder, unpublished-changes pill, log out). From 1024px a 240px sidebar with grouped links; under 1024px a "Menu" button opens the same list. Form pages have a sticky bottom action bar. |
| Tables (admin) | Desktop table with sticky-looking header, numbers right-aligned, totals in `tfoot`. Under 768px each row becomes a card with labelled lines. Overdue rows tinted and labelled. |
| Tabs | `role=tablist`, arrow-key navigation, 44px tabs, 4px green underline. |
| Placeholders | Dashed border box labelled "client photo" or "logo placeholder"; prototype banner on every page states what is missing. |

## 5. Accessibility notes
- Contrast: table below, all pairs computed. Disabled controls are exempt from the 4.5:1 rule (their pair is still listed).
- Focus: 3px solid ring, offset 3px; gold ring on green bands.
- Keyboard: skip link, native details, tab arrows, no hover-only content.
- Large text: rem sizing, flexible containers; to be verified at 200% in Stage 2 (not yet tested, see report).
- `lang="en"` on pages; `lang="ur"` is reserved for the logo's Urdu name (not typed in this prototype).
- Reduced motion: shimmer and smooth scroll are disabled.

## 6. Contrast table (computed)
Command: `node design/contrast-check.mjs` (exit code 0 = every pair passes). Thresholds: text 4.5:1, UI boundaries and focus rings 3:1 (WCAG 2.1 AA). Relative luminance per WCAG 2.1.

| Mode | Pair | Foreground | Background | Ratio | Need | Result |
|---|---|---|---|---|---|---|
| light | Body text on page (cream) | #1D2A22 | #FAF6EE | 13.85:1 | 4.5:1 | PASS |
| light | Body text on card (white) | #1D2A22 | #FFFFFF | 14.93:1 | 4.5:1 | PASS |
| light | Muted text on page | #55615A | #FAF6EE | 6.01:1 | 4.5:1 | PASS |
| light | Muted text on card | #55615A | #FFFFFF | 6.47:1 | 4.5:1 | PASS |
| light | Muted text on sunken cream | #55615A | #F2EBDC | 5.45:1 | 4.5:1 | PASS |
| light | Secondary text (ink700) on sunken | #3F4B43 | #F2EBDC | 7.70:1 | 4.5:1 | PASS |
| light | Heading / link green on page | #1F5134 | #FAF6EE | 8.53:1 | 4.5:1 | PASS |
| light | Heading / link green on card | #1F5134 | #FFFFFF | 9.19:1 | 4.5:1 | PASS |
| light | Green text on green tint | #1F5134 | #E3EEE7 | 7.72:1 | 4.5:1 | PASS |
| light | Ink text on green tint | #1D2A22 | #E3EEE7 | 12.55:1 | 4.5:1 | PASS |
| light | Brown accent text on page | #A9561A | #FAF6EE | 4.83:1 | 4.5:1 | PASS |
| light | Brown accent text on card | #A9561A | #FFFFFF | 5.21:1 | 4.5:1 | PASS |
| light | Dark brown text on sunken cream (use instead of brown600 there) | #7A3C0E | #F2EBDC | 7.13:1 | 4.5:1 | PASS |
| light | Dark brown on gold tint (notes, banner) | #7A3C0E | #FDF0D0 | 7.48:1 | 4.5:1 | PASS |
| light | Ink on gold tint | #1D2A22 | #FDF0D0 | 13.19:1 | 4.5:1 | PASS |
| light | PRIMARY BUTTON / WhatsApp: cream label on deep green | #FAF6EE | #1F5134 | 8.53:1 | 4.5:1 | PASS |
| light | Primary button: white label on deep green | #FFFFFF | #1F5134 | 9.19:1 | 4.5:1 | PASS |
| light | Primary button hover: cream on green900 | #FAF6EE | #163D27 | 11.26:1 | 4.5:1 | PASS |
| light | Hero/footer accent: gold text on deep green | #F2B441 | #1F5134 | 4.98:1 | 4.5:1 | PASS |
| light | Footer accent: gold text on green900 | #F2B441 | #163D27 | 6.57:1 | 4.5:1 | PASS |
| light | Gold button/badge: green900 label on gold | #163D27 | #F2B441 | 6.57:1 | 4.5:1 | PASS |
| light | Gold button/badge: ink label on gold | #1D2A22 | #F2B441 | 8.09:1 | 4.5:1 | PASS |
| light | Footer body: cream200 on green900 | #E4DAC3 | #163D27 | 8.73:1 | 4.5:1 | PASS |
| light | Footer body: cream50 on green800 | #FAF6EE | #1F5134 | 8.53:1 | 4.5:1 | PASS |
| light | Danger button: white on red | #FFFFFF | #A3221B | 7.49:1 | 4.5:1 | PASS |
| light | Error text on white | #A3221B | #FFFFFF | 7.49:1 | 4.5:1 | PASS |
| light | Error text on page | #A3221B | #FAF6EE | 6.95:1 | 4.5:1 | PASS |
| light | Badge success (paid, active) | #14602F | #DDF1E4 | 6.48:1 | 4.5:1 | PASS |
| light | Badge warning (unpaid, upcoming, renewal due) | #7A4A00 | #FFEFC7 | 6.56:1 | 4.5:1 | PASS |
| light | Badge danger (overdue, expired) | #A3221B | #FBE4E1 | 6.17:1 | 4.5:1 | PASS |
| light | Badge info (scheduled, upcoming) | #1F4E79 | #E1ECF7 | 7.24:1 | 4.5:1 | PASS |
| light | Badge neutral (paused, draft) | #3F4B43 | #ECE6D8 | 7.34:1 | 4.5:1 | PASS |
| light | Disabled-state text is exempt; shown for info: ink600 on cream200 | #55615A | #E4DAC3 | 4.66:1 | 4.5:1 | exempt (disabled) |
| light | Input border on white (UI 3:1) | #76705F | #FFFFFF | 4.94:1 | 3:1 | PASS |
| light | Input border on page (UI 3:1) | #76705F | #FAF6EE | 4.58:1 | 3:1 | PASS |
| light | Focus ring green on page (UI 3:1) | #1F5134 | #FAF6EE | 8.53:1 | 3:1 | PASS |
| light | Focus ring green on white (UI 3:1) | #1F5134 | #FFFFFF | 9.19:1 | 3:1 | PASS |
| light | Focus ring gold on deep green (UI 3:1) | #F2B441 | #1F5134 | 4.98:1 | 3:1 | PASS |
| light | Focus ring gold on green900 (UI 3:1) | #F2B441 | #163D27 | 6.57:1 | 3:1 | PASS |
| light | Primary button edge vs page (UI 3:1) | #1F5134 | #FAF6EE | 8.53:1 | 3:1 | PASS |
| light | Prototype state-frame label: white on ink700 | #FFFFFF | #3F4B43 | 9.14:1 | 4.5:1 | PASS |
| light | Toast: white on ink900 | #FFFFFF | #1D2A22 | 14.93:1 | 4.5:1 | PASS |
| light | Toast link: gold-tint on ink900 | #F5CF73 | #1D2A22 | 9.99:1 | 4.5:1 | PASS |
| light | Placeholder text: ink700 on sunken cream | #3F4B43 | #F2EBDC | 7.70:1 | 4.5:1 | PASS |
| light | Admin top bar: cream50 on green900 | #FAF6EE | #163D27 | 11.26:1 | 4.5:1 | PASS |
| light | Admin top bar pill: green900 on gold | #163D27 | #F2B441 | 6.57:1 | 4.5:1 | PASS |
| light | Admin top bar muted: cream200 on green900 | #E4DAC3 | #163D27 | 8.73:1 | 4.5:1 | PASS |
| light | Overdue row: ink900 on error tint | #1D2A22 | #FBE4E1 | 12.29:1 | 4.5:1 | PASS |
| light | Overdue row link: green800 on error tint | #1F5134 | #FBE4E1 | 7.57:1 | 4.5:1 | PASS |
| dark | Body text on bg | #F3EEE1 | #0F1B15 | 15.26:1 | 4.5:1 | PASS |
| dark | Body text on card | #F3EEE1 | #17271E | 13.47:1 | 4.5:1 | PASS |
| dark | Muted text on bg | #B8C4BB | #0F1B15 | 9.81:1 | 4.5:1 | PASS |
| dark | Muted text on card | #B8C4BB | #17271E | 8.66:1 | 4.5:1 | PASS |
| dark | Muted text on raised card | #B8C4BB | #1F3328 | 7.46:1 | 4.5:1 | PASS |
| dark | Green-ish link/heading text on bg | #8FD0A6 | #0F1B15 | 9.88:1 | 4.5:1 | PASS |
| dark | Green-ish link/heading text on card | #8FD0A6 | #17271E | 8.73:1 | 4.5:1 | PASS |
| dark | Accent (brown-light) text on bg | #F0A56A | #0F1B15 | 8.67:1 | 4.5:1 | PASS |
| dark | Accent (brown-light) text on card | #F0A56A | #17271E | 7.65:1 | 4.5:1 | PASS |
| dark | Primary button: cream on deep green | #FAF6EE | #1F5134 | 8.53:1 | 4.5:1 | PASS |
| dark | Gold button: dark green label on gold | #143823 | #F2B441 | 7.03:1 | 4.5:1 | PASS |
| dark | Gold text on bg | #F2B441 | #0F1B15 | 9.58:1 | 4.5:1 | PASS |
| dark | Badge success | #8EDBA7 | #1E3B2A | 7.49:1 | 4.5:1 | PASS |
| dark | Badge warning | #F5CF73 | #3C3015 | 8.65:1 | 4.5:1 | PASS |
| dark | Badge danger / error text | #FF9C93 | #442220 | 6.97:1 | 4.5:1 | PASS |
| dark | Error text on card | #FF9C93 | #17271E | 7.75:1 | 4.5:1 | PASS |
| dark | Badge info | #9CC7F0 | #1D3248 | 7.39:1 | 4.5:1 | PASS |
| dark | Primary hover: cream on #2A6A45 | #FAF6EE | #2A6A45 | 6.00:1 | 4.5:1 | PASS |
| dark | Badge neutral | #D5DDD7 | #2B3B31 | 8.55:1 | 4.5:1 | PASS |
| dark | Danger button: dark label on light red | #442220 | #FF9C93 | 6.97:1 | 4.5:1 | PASS |
| dark | Warning note: gold-tint text on dark tint | #F5CF73 | #3C3015 | 8.65:1 | 4.5:1 | PASS |
| dark | Input border on card (UI 3:1) | #7F9487 | #17271E | 4.82:1 | 3:1 | PASS |
| dark | Input border on bg (UI 3:1) | #7F9487 | #0F1B15 | 5.46:1 | 3:1 | PASS |
| dark | Green button edge vs bg (UI 3:1) | #6FB58A | #0F1B15 | 7.28:1 | 3:1 | PASS |
| dark | Focus ring gold on bg (UI 3:1) | #F2B441 | #0F1B15 | 9.58:1 | 3:1 | PASS |
| dark | Focus ring gold on card (UI 3:1) | #F2B441 | #17271E | 8.46:1 | 3:1 | PASS |

Forbidden combinations (must NOT be used for text / UI edges):
| Pair | Foreground | Background | Ratio |
|---|---|---|---|
| Gold text on cream page | #F2B441 | #FAF6EE | 1.71:1 |
| Gold edge/border on cream (UI) | #F2B441 | #FAF6EE | 1.71:1 |
| Gold text on white | #F2B441 | #FFFFFF | 1.85:1 |
| Cream label on gold button | #FAF6EE | #F2B441 | 1.71:1 |
| Brown #A9561A text on sunken cream #F2EBDC | #A9561A | #F2EBDC | 4.39:1 |

Checked 75 pairs; failures: 0

Note: the PM's rough numbers in NFR-03 hold: gold on cream is 1.71:1 (FAIL), gold on deep green 4.98:1, green on cream 8.53:1, brown on cream 4.83:1. One extra finding: brown #A9561A on the sunken cream #F2EBDC is 4.39:1 (FAIL), so brown text is limited to cream-50 and white, and brown-800 is used on sunken or tinted backgrounds.
