# ADR-0003: Draft tables, immutable published releases, cached server rendering with a last-good fallback
Date: 2026-11-21
Status: Proposed (takes effect only with CEO approval of Stage 0)

## Context
- FR-22: admins preview drafts and publish; a failed publish must leave the live site unchanged; an "unpublished changes" indicator. NFR-08: a publish can be rolled back and the public site stays up when the backend is down. NFR-06: published changes visible within 60 seconds. NFR-01/NFR-04: fast, server-rendered pages.
- FR-14/FR-15: edit the live week's menu as a draft; prepare next week as a draft; schedule its go-live (default Sunday evening, Q-24) so it becomes live with no admin action; edit or cancel the schedule without touching the live menu. FR-06: never show an empty menu.
- Production deployments are done only by the CEO, so content changes must never require a build or deployment.
- FR-27/FR-29: statuses that change with the date (expired, renewal due, overdue).

## Decision
1. **Draft-first content.** Editors write to working tables that visitors never read.
2. **Publish = a new immutable release.** `publish_content()` validates the drafts and, in one transaction, stores the complete public content as a JSON document in `content_releases` and makes it current. A failure changes nothing. **Rollback** re-points to an earlier release. The "unpublished changes" indicator compares the checksum of the draft document with the current release.
3. **Menu weeks carry their own release.** Publishing or scheduling a week snapshots its 21 slots with a go-live time. The live menu is defined as the released week with the latest go-live time that is not in the future. Draft / scheduled / published / past are derived from that time, not stored, so a scheduled menu is live at its go-live time by definition.
4. **Public pages are server-rendered and cached by the web app.** They are refreshed (a) immediately when an admin publishes, (b) by a Supabase Cron notifier that calls `/api/revalidate` when a scheduled go-live time passes, and (c) by a 60-second timed re-check as a backstop.
5. **Last-good fallback.** The public content reader saves each successful result to the host's persistent disk and uses that copy when the backend fails or times out. Public routes have no dependency on sessions or admin code.
6. **Preview** uses the framework's draft mode: the real public page components render from draft data fetched with the admin's session, with a banner, `noindex` and no caching.
7. **Date-dependent statuses are computed on read** in database views, never written by a job.
8. **The build contains no content.** Pages are rendered at runtime, so the same artifact runs in staging and production.

## Alternatives considered
| Option | Why not chosen |
|---|---|
| Static site regenerated on each publish | Needs a build and production deploy per content change (CEO-only under Option B, or production credentials in CI); minutes, not seconds; scheduled go-live needs timed builds |
| Public pages read live tables with an `is_published` flag per row | No atomic publish across several edits, no rollback, harder preview, and public queries would touch the tables being edited |
| Fully dynamic rendering on every request | Public site would fail whenever the backend is down (NFR-08) and be slower (NFR-01) |
| Client-side fetching of content in the browser | Poor SEO and slow-network performance; site blank when the backend is down |
| A scheduled job flips the menu status at go-live | If the job fails, the menu does not change. With the derived rule the job only refreshes a cache |
| A nightly job writes "expired"/"overdue" into rows | Wrong until the job runs, wrong if it fails, and two sources of truth |
| Headless CMS (third-party) for content | Another vendor, account and cost; content model is small; operations data would still need the database |

## Consequences
- Positive: publishing is atomic, auditable and reversible; visitors never see half-edited content; menu go-live does not depend on a job; the public site survives backend outages for text, prices, menu and ordering.
- Positive: each release is a full snapshot, so "what changed" (FR-23) is a comparison of two releases.
- Negative: two places to reason about for menus (working slots and released snapshot); the editor must make clear when a scheduled or live week differs from its working copy.
- Negative: if the cron notifier fails, the first visitor after a scheduled go-live can see the previous menu once (backstop refresh follows).
- Negative: during a backend outage, images not already in the app's image cache show alt text only.
- To verify in the Stage 2 spike (task T2.1) on the chosen host: cache survives restart, on-demand refresh is immediate, no content is baked at build, pg_cron/pg_net webhook works. If the host is changed to Vercel (ADR-0001 alternative), point 5 relies on the platform's durable page cache instead of a file on disk.
- Publish validation rules (placeholders, unpriced plans) live in the database function and must be kept in step with the PRD acceptance criteria.
