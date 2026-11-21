# Status
- Current stage: 1 — UI/UX Design (package drafted, awaiting CEO gate)
- Last approved stage: 0 — milestone PR #6, `verify-approval.sh` PASS (CEO merge on `5f38bf2`), see `approvals/APPROVALS.md` row 3
- Updated: 2026-11-21

## In progress (branch `stage1/design`, owner: uiux-designer, reviewed by orchestrator)
| Task | FRs | Output |
|---|---|---|
| D1 Design system: tokens, type, components, contrast-checked colour pairs | NFR-02, 03, 05 | `design/design-system.md` + tokens |
| D2 Public screens S-01..S-07, mobile 360 first + desktop | FR-01..FR-12 | `design/prototype/` |
| D3 Admin content screens A-01..A-11 | FR-13..FR-23 | `design/prototype/admin/` |
| D4 Admin operations screens A-12..A-17 | FR-24..FR-30 | `design/prototype/admin/` |
| D5 States (empty, loading, error, validation) and journey walkthrough J1..J8 | all | `design/screens.md` |

## Next
- Merge the Stage 1 task PR into `develop`, tag `stage1-v1`, open the milestone PR `develop → main` with `approvals/reports/stage1-v1.md`. STOP until `scripts/verify-approval.sh` returns PASS.

## Blockers / assumptions carried into design
- No client answers yet to the blocking-for-design questions (Q-01, Q-02, Q-12, Q-15, Q-18, Q-25, Q-28, Q-29, Q-31). Design proceeds on the PRD assumptions; each is marked in the design as an assumption.
- No logo files or food photos received: placeholders only, clearly labelled.
