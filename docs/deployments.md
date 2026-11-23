# Deployments
## Environments
| Env | URL | Hosting | How to deploy | Rollback |
|---|---|---|---|---|
| staging (preview) | https://tiffinbox-website2.vercel.app | Vercel Hobby, project `tiffinbox-website2`; database = Supabase staging `plkkvkonhigiuigkxklr` (synthetic data only) | push to `stage3/backend` (Vercel Git integration). Env names set in Vercel by the Engineering Lead: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `APP_ENV=staging`, `REVALIDATE_SECRET`, `SESSION_SIGNING_SECRET` | Vercel dashboard: promote the previous deployment |

Limits of this host: Hobby plan is non-commercial (not for the client's launch); request bodies over about 4.5 MB fail (admin allows 8 MB images); the last-good content file and the sign-in throttle are per-instance and not durable.

## Deploy log
| Date | Env | Commit/tag | Approved by (APPROVALS ref) | Result |
|---|---|---|---|---|
| 2026-11-23 | staging (preview) | `437da9c` (`stage3/backend`); migrations 12-14 applied by the Engineering Lead with `supabase db push`; release v7 published by the Engineering Lead | n/a: staging preview | CR-003 + CR-004 live. Checked by curl against the spec of 23 Nov 2026: Home (Rs 500 delivered, Try 3 days Rs 4,800), five plans with tags and Student Rs 750-800, late-night card, breakfast Rs 550, Who's eating examples (775 / 2,025 / 2,950), delivery table rows, Customize example Rs 880, 12 FAQ, footer QR and Urdu name, no question codes on public pages. Not checked: QR scan on a phone, visual review on a real phone |
| 2026-11-23 | staging (preview) | `622b46c` (`stage3/backend`) | n/a: staging preview, not a release; set up by the Engineering Lead | Vercel status success. curl smoke check: health 200; six public pages 200 with content from Supabase; `/admin*` redirect to login; forged session cookies refused; security headers present; robots disallow all; `/api/revalidate` 401 without the secret. Admin sign-in on this host confirmed by the Engineering Lead in the browser (human check) |
