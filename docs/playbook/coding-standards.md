# Coding Standards (all projects)

- **TypeScript strict** for all JS projects; ESLint + Prettier; no `any` without a comment explaining why.
- **Flutter:** `flutter_lints` (or stricter `very_good_analysis` if the project already uses it); feature-first folders;
  one state-management approach per app (Riverpod or Bloc — decided in ADR, never mixed).
- **NestJS** preferred for new backends (modules, DTO validation with class-validator, guards for authZ). Express
  only for small services or existing code.
- **Config:** 12-factor; all secrets from env / secret store; commit `.env.example` only.
- **APIs:** OpenAPI spec kept in repo and updated in the same PR as the endpoint; consistent error shape; pagination;
  input validation on every endpoint; rate limiting on auth and public endpoints.
- **DB:** every schema change is a migration in version control; no manual prod edits; seed data separate from migrations.
- **Tests:** unit tests for business logic; API tests for every endpoint; E2E for the critical user journeys in the PRD.
  A PR without tests for new logic needs a stated reason.
- **Git:** conventional commits (`feat:`, `fix:`, `chore:`…); small PRs; no direct pushes to `main`/`develop`; no force-push
  on shared branches.
- **Accessibility:** WCAG 2.1 AA target for web; semantic labels and text scaling for Flutter.
- **Logging:** structured logs, no PII or tokens in logs.
- **Dependencies:** pin versions via lockfile; run `npm audit` / `flutter pub outdated` each stage; justify every new dependency.
