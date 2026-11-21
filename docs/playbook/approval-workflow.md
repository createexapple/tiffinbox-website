# CEO Approval Workflow

Decided by the CEO on 2026-10-18: **Option B** — production stays under CEO-held credentials; GitHub Team is not
purchased yet. This document describes only protections that actually exist on our current plan.

| Role | GitHub account |
|---|---|
| CEO (sole approver) | `aliSabirDogar` |
| Technical operator / AI Engineering Lead | `createexapple` |

## 1. What is and is not enforced today (GitHub Free organisation `createex`)

Verified 2026-10-18 against the GitHub API on `createex/createex-ai-agency`.

| Control | Status today | Kind |
|---|---|---|
| Production credentials held only by the CEO (section 4) | **Active once the CEO completes section 4** | Preventive |
| Store release rights held only by the CEO account (section 5) | **Active once roles are set in each console** | Preventive |
| CEO approval = PR review by `aliSabirDogar` on an exact commit, or a merge of the milestone PR by `aliSabirDogar`; only that account can create either | **Active** — GitHub attributes reviews and merges to the account that performed them | Evidence |
| `scripts/verify-approval.sh` checks the review, the commit and staleness | **Active** | Verification |
| `scripts/verify-approval.sh --audit` lists merges to `main` without a valid CEO approval | **Active** — run weekly | Detective |
| Branch protection / rulesets on private repos | **Not available** — API returns "Upgrade to GitHub Pro or make this repository public" | — |
| Required CEO review before merge (CODEOWNERS enforcement) | **Not available** — `CODEOWNERS` only auto-requests the CEO's review | — |
| Required reviewers on deployment environments (private repos) | **Not available** on Free, Pro or Team per GitHub docs | — |

**Consequence:** on Free, any account with write access *can* merge to `main` without the CEO. We do not prevent that;
we make it detectable, and we make sure merging to `main` cannot reach production or the public stores, because
the credentials for those are not in GitHub or with the operator.

## 2. What counts as a CEO approval

Either of two things, both created only by the `aliSabirDogar` account on the milestone PR:

1. An **APPROVED pull-request review by `aliSabirDogar`** whose reviewed commit is the exact deliverable commit, with
   no newer commits pushed to the PR after the review. This is the preferred form.
2. A **merge of the milestone PR performed by `aliSabirDogar`** (GitHub records `merged_by`), when the CEO left no
   review on that PR. The approved commit is the PR head at merge. Added by CEO instruction on 2026-11-21. A merge by
   any other account is not an approval, and a CEO merge does not override the CEO's own "Request changes" review.

- WhatsApp, email, calls or chat messages are **instructions to prepare**, not approvals. The Engineering Lead replies
  "please approve PR <link> on GitHub".
- `approvals/APPROVALS.md` is an **index**, not evidence. Every row must link the review URL. A row without a
  verifiable review is invalid, whatever it says.
- Claude never writes a decision into the log on its own; it runs `verify-approval.sh` and records only what it returns.
- REQUEST CHANGES = a "Request changes" review by the CEO. HOLD = a PR comment by the CEO containing `HOLD`
  (Claude stops all stage work on that project until a later approval).
- An approval covers only the reviewed commit. Any new commit on the PR makes it **stale** and needs a fresh review.

## 3. Stage-gate procedure

1. Operator/Claude finish the stage on `develop`, tag `stage<N>-v<n>`, open PR `develop → main` titled
   `Stage N vn — <project>` with the milestone report (`/milestone-approval`) as the PR body.
2. Request review from `aliSabirDogar` (`gh pr edit <n> --add-reviewer aliSabirDogar`). Claude STOPS.
3. CEO reviews the preview links and evidence, then clicks **Approve**, **Request changes**, or comments **HOLD**.
4. Claude runs `scripts/verify-approval.sh <owner/repo> <pr>`; only on `PASS` it adds the index row and the PR is merged.
5. `/start-stage` re-runs the verification before any next-stage work.

Production deploys (Stage 5) and public store releases (Stage 6) additionally need the CEO to perform or unlock the
action personally with CEO-held access — a PR approval alone never reaches production.

## 4. Production credentials (Option B)

- Production cloud accounts/projects (Azure subscription or resource group, Firebase/Supabase prod projects,
  hosting, DNS, payment-provider live keys) are **owned by the CEO**. The operator has roles on **staging only**.
- Staging and production are **separate projects/accounts**, never one project with two keys.
- Production secrets live only in the CEO's password-manager vault, never in GitHub (no repo, org or environment
  secrets for production), never in a repo file, never on the operator's machine, never in a Claude chat.
- CI builds and tests; it **does not** deploy to production. It publishes a release artifact with a SHA-256 checksum.
- The production deploy is run by the CEO (or someone the CEO personally supervises) from a machine where Claude
  agents are not running, following `docs/production-release-runbook.md`, using only the approved commit/artifact.
- If Claude or the operator ever finds a production credential (repo, `.env`, chat, log): stop, do not use it,
  report it, and the CEO rotates it.

## 5. Store publishing

- Google Play Console and App Store Connect: the CEO is the **account owner / Account Holder**.
- Operator permissions: upload builds and manage **internal/closed testing** only. No permission to release to
  production or submit for public review. (Confirm the exact role names in each console when assigning them.)
- Public submission and release are clicked by the CEO's account only.

## 6. Upgrade path to GitHub Team (not purchased)

Everything above stays. Team adds preventive controls on top:
1. Ruleset on `main` in every client repo: require PR, 1 approval, review from Code Owners (`* @aliSabirDogar` is
   already in the template `CODEOWNERS`), dismiss stale approvals, required CI checks, block force-push and deletion,
   **no bypass list**.
2. Deployment branch rule: staging secrets usable only from `develop`.
3. Required reviewers on private-repo environments still need GitHub Enterprise, so production stays under Option B.
