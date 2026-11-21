# Createex Tech — Standard Project Lifecycle

Every stage ends with: deliverables committed + tagged, `/milestone-approval` report, STOP for CEO decision
(APPROVE / REQUEST CHANGES / HOLD). The decision is the CEO's GitHub PR review on the tagged commit, verified with `scripts/verify-approval.sh` and indexed in `approvals/APPROVALS.md`.

| Stage | Lead agents | Deliverables (must exist before the gate) | Gate tag |
|---|---|---|---|
| 0 Requirements & Architecture | requirements-pm, software-architect | `docs/PRD.md`, screen inventory, user journeys, FR/NFR, `docs/architecture.md`, API + data model draft, platform feasibility, risks, milestones, acceptance criteria, `docs/traceability.md`, open questions for client | `stage0-v<n>` |
| 1 UI/UX Design | uiux-designer | Design system, all agreed screens (incl. loading/empty/error/success), responsive layouts, clickable prototype, links to Claude Design artifacts / Figma, `docs/design.md` | `stage1-v<n>` |
| 2 Frontend | flutter-developer / web-frontend-developer, qa-engineer | All approved screens, navigation, state, validation, clearly-labelled mocks, preview build or URL, screenshots, design-vs-build comparison, frontend test results, known limitations | `stage2-v<n>` |
| 3 Backend & Integration | backend-developer, database-engineer, security-engineer | APIs, DB + migrations, authN/authZ, business logic, notifications, admin, 3rd-party integrations, mocks removed from production paths, API docs, requirement-by-requirement verification | `stage3-v<n>` |
| 4 QA, Security, RC | qa-engineer, security-engineer | Unit/API/integration/E2E/regression results with logs, security review, responsive + performance checks, human real-device test notes, defects fixed and retested, `docs/qa-report.md`, release candidate build | `stage4-rc<n>` |
| 5 Deployment | devops-engineer | Pipeline, environments, backups, rollback plan, migration dry-run on staging, monitoring, `docs/deployments.md`. **Production deploy is executed by the CEO with CEO-held credentials (`production-release-runbook.md`).** | `release-v<x.y.z>` |
| 6 Store Publishing | release-publisher | Signed AAB/IPA, icons, screenshots, store listings, privacy/data-safety answers, TestFlight / Play internal testing. **Public submission/release is done by the CEO's store account.** | `store-v<x.y.z>` |

## Rules across all stages
- Mocks are allowed only in Stage 2, must be named `mock*`/behind a flag, and listed in known limitations.
- "Done" means: implemented + tests executed with output saved under `docs/test-results/` + reviewed.
- CEO change requests during a stage → revise, re-tag (`v<n+1>`), re-submit. Scope changes → `docs/change-requests.md`.
- Existing projects (Type B) enter at **Audit** (`/existing-project-audit`), then rejoin at whichever stage the
  CEO-approved continuation plan names.
