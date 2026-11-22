# Deployments
## Environments
| Env | URL | Hosting | How to deploy | Rollback |
|---|---|---|---|---|
| staging (preview) | https://tiffinbox-website2.vercel.app | Vercel Hobby, project `tiffinbox-website2`; database = Supabase staging `plkkvkonhigiuigkxklr` (synthetic data only) | push to `stage3/backend` (Vercel Git integration). Env names set in Vercel by the Engineering Lead: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `APP_ENV=staging`, `REVALIDATE_SECRET`, `SESSION_SIGNING_SECRET` | Vercel dashboard: promote the previous deployment |

Limits of this host: Hobby plan is non-commercial (not for the client's launch); request bodies over about 4.5 MB fail (admin allows 8 MB images); the last-good content file and the sign-in throttle are per-instance and not durable.

## Deploy log
| Date | Env | Commit/tag | Approved by (APPROVALS ref) | Result |
|---|---|---|---|---|
| 2026-11-23 | staging (preview) | `622b46c` (`stage3/backend`) | n/a: staging preview, not a release; set up by the Engineering Lead | Vercel status success. curl smoke check: health 200; six public pages 200 with content from Supabase; `/admin*` redirect to login; forged session cookies refused; security headers present; robots disallow all; `/api/revalidate` 401 without the secret. Admin sign-in on this host NOT yet tested |
