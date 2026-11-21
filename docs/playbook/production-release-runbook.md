# Production Release Runbook (Option B — CEO-held access)

Used for Stage 5 production deploys and Stage 6 public store releases. Claude agents and the operator prepare;
the CEO executes with CEO-held access. Copied into each project as `docs/playbook/production-release-runbook.md`.

## Operator prepares (no production access needed)
1. Release PR `develop → main` with: release tag, commit SHA, CI run link, artifact name + SHA-256 checksum,
   migration list + rollback scripts, staging test evidence, release notes, rollback plan.
2. Request review from `aliSabirDogar`. STOP.

## CEO authorises
3. CEO approves the PR on GitHub (this approves the exact commit). Claude verifies with `scripts/verify-approval.sh`.
4. Operator merges and tags. CI builds the artifact from that tag (no production secrets in CI).

## CEO executes (on a machine where Claude agents are not running)
5. Confirm the artifact checksum matches the PR.
6. Take/confirm the production database backup.
7. Apply migrations and deploy using credentials from the CEO's vault, following the project's
   `docs/deployments.md`. The operator may be on a call to guide, but does not see or type the credentials.
8. Run the smoke test from the PR. If it fails: run the rollback plan.
9. Mobile: in Play Console / App Store Connect, the CEO promotes the tested build to production / submits for review.

## Record
10. Operator opens a small PR adding the deploy-log row to `docs/deployments.md` (date, tag, SHA, approved PR link,
    executed by, result). CEO approves it — that review is the record that the release happened.
