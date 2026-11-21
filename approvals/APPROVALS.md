# CEO Approval Log — website
Index only — **not evidence**. The evidence is the CEO's (`aliSabirDogar`) GitHub PR review on the exact commit.
A row counts only if `scripts/verify-approval.sh <repo> <pr> <sha>` returns PASS. Append-only; corrections are new rows.

| # | Date | Stage | Tag | Commit SHA | Milestone PR | CEO review URL | verify-approval.sh result | Recorded by |
|---|---|---|---|---|---|---|---|---|
| 1 | 2026-11-21 | 0 | stage0-v1 | PR head at review | https://github.com/createexapple/tiffinbox-website/pull/2 | — | FAIL #2: no decisive review by aliSabirDogar (run 2026-11-21, twice; PR was merged by aliSabirDogar without a review) | Claude |
| 2 | 2026-11-21 | 0 | stage0-v1 | d313fca | https://github.com/createexapple/tiffinbox-website/pull/4 | — | FAIL #4: no decisive review by aliSabirDogar (run three times; PR was merged by aliSabirDogar without a review) | Claude |
| 3 | 2026-11-21 | 0 | stage0-v1 | 5f38bf2 | https://github.com/createexapple/tiffinbox-website/pull/6 | none (CEO merge, no review) | PASS #6: MERGED by aliSabirDogar on 5f38bf25574c at 2026-11-21T18:32:44Z (CEO merge, no review) — rule added by createex/createex-ai-agency#2, merged by aliSabirDogar 2026-11-21T18:35:40Z | Claude |
| 4 | 2026-11-21 | 1 | stage1-v1 | PR head at review | milestone PR develop → main (opened after the Stage 1 task PR merges) | — | PENDING (not yet reviewed) | Claude |
