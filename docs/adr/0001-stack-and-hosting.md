# ADR-0001: One Next.js app + Supabase, no separate API server; web app hosted on Azure App Service
Date: 2026-11-21
Status: Proposed (takes effect only with CEO approval of Stage 0)

## Context
- Product: a six-page mobile-first marketing site and a private admin dashboard for content (CR-001) and staff-entered customers, subscriptions and payments (CR-002). `docs/PRD.md` v0.2.
- Small business, tight and so far unknown hosting budget (Q-03). Under 1,000 customers, a handful of admins, low traffic.
- NFR-01 fast on low-end Android and slow 4G; NFR-04 server-rendered HTML; NFR-06 published changes visible within 60 seconds; NFR-08 public site stays up when the admin/backend is down; NFR-12 personal and payment data protected at the server/database.
- Company rules: official stack only unless justified; production credentials held only by the CEO; CI must not hold production secrets; production is deployed by the CEO from a checksummed artifact (`docs/playbook/production-release-runbook.md`); GitHub branch protection is not available.
- Menu and prices change weekly and must not need a code deployment.

## Decision
1. **One web application: Next.js (App Router) + React + TypeScript strict**, containing the public site and the admin dashboard under `/admin`. Newest framework major in vendor support at Stage 2 start, versions pinned.
2. **One managed backend: Supabase** (details in ADR-0002).
3. **No separate API server** (no NestJS/Express). Admin mutations are Next.js server actions; multi-step operations are PostgreSQL functions; access control is row-level security. This deviates from the coding standard "NestJS preferred for new backends". Justification: there is no backend to build beyond data access rules. The only client is our own web app, there are no third-party integrations or other consumers in v1, and a second service would add a second deployable, a second secret set, a second thing for the CEO to deploy by hand, and an estimated 8 to 12 working days. If online ordering, payments or a mobile app are added later, a NestJS API can be introduced in front of the same database without changing the data model.
4. **Vite is not used**; Next.js builds everything.
5. **Hosting of the web app: Azure App Service, Linux, Basic B1, single always-on instance**, in a region near the Supabase region; staging on a separate App Service in a Createex subscription. Production subscription owned by the CEO or client (Q-03).
   - The app is deployed as a zip artifact built by GitHub Actions from a `release-*` tag. The artifact holds no environment values and no content, so the same file is tested on staging and deployed by the CEO.
   - Page cache, image cache and the last-good content file live on the App Service persistent `/home` storage.

## Alternatives considered
| Option | Why not chosen |
|---|---|
| **Vercel (Pro, USD 20/month)** for the web app | Technically the easiest fit for Next.js (built-in durable page cache, global CDN, least operations work; would save an estimated 1 to 2 days in Stage 5 and remove risk T1). **Not on the company's official hosting list, so it needs CEO/client approval.** Also: deploys are triggered by Git pushes, which conflicts with CEO-only production deploys unless automatic production deploys are switched off and the CEO promotes builds manually from a CEO-owned account; the Hobby (free) tier is, to the architect's recollection of Vercel's terms, not permitted for commercial sites (not confirmed in this session). Remains the recommended fallback if the Stage 2 spike on Azure fails |
| Firebase App Hosting (in the official list) | Cheapest (usage within the no-cost limits at this traffic; Blaze plan required). Default is scale-to-zero with a non-durable page cache, so after every cold start the app would have to rebuild pages from the backend, which weakens NFR-08, and the admin would see cold-start delays. Keeping one instance warm removes the price advantage. Its handling of on-demand page refresh could not be verified in this session |
| Azure Static Web Apps | Hybrid Next.js support is limited/preview to the architect's knowledge; server-side admin and on-demand refresh are not dependable there |
| Static export rebuilt on every publish | Each menu or price change would be a build and a production deploy, which under Option B needs the CEO, or production deploy credentials in CI (forbidden). Also takes minutes, missing NFR-06, and scheduled go-live would need a timed rebuild |
| Separate public site and admin SPA (two apps) | Two builds and deploys; preview could not reuse the real page components. No benefit at this size |
| NestJS API + React SPA + Postgres | Heavier in every dimension (see Decision 3) |
| No-code site builder / WordPress | Outside the official stack; weaker control of personal data; not considered further |

## Consequences
- Positive: one codebase, one deploy, one backend; monthly cost about USD 39 to 40 with Supabase Pro (see `docs/architecture.md` section 12); the deploy matches the production runbook exactly; fixed, predictable bill.
- Negative: single instance and no CDN edge. First-byte time from Lahore and page-cache behaviour on App Service are unproven and must be measured in the Stage 2 spike (task T2.1) before feature work. If the spike fails, this ADR is superseded by one choosing Vercel (with approval) or adding a CDN.
- Negative: the team operates an App Service (restarts, storage, TLS binding, logs) instead of a fully managed frontend platform.
- The coding-standard deviation (no NestJS) is deliberate and recorded here.
- Azure B1 price (about USD 13/month) is the architect's recollection; the pricing page did not show prices in this session. devops-engineer to confirm before the CEO quotes.
