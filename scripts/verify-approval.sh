#!/usr/bin/env bash
# Verify a genuine CEO approval on GitHub (see docs/approval-workflow.md section 2).
#   scripts/verify-approval.sh <owner/repo> <pr-number> [expected-commit-sha]
#   scripts/verify-approval.sh --audit <owner/repo>      # every first-parent commit on main must come from a CEO-approved PR
# Exit 0 = PASS, 1 = FAIL. Reads GitHub only; changes nothing.
set -uo pipefail
CEO="${CEO_GITHUB:-aliSabirDogar}"

check_pr() {  # repo pr [sha]  -> prints one line, returns 0/1
  local repo="$1" pr="$2" want="${3:-}" head reviews last state cid url holds
  head=$(gh api "repos/$repo/pulls/$pr" --jq .head.sha) || { echo "FAIL #$pr: PR not found"; return 1; }
  reviews=$(gh api --paginate "repos/$repo/pulls/$pr/reviews" --jq ".[] | select(.user.login==\"$CEO\" and .state!=\"COMMENTED\" and .state!=\"PENDING\") | [.state,.commit_id,.submitted_at,.html_url] | @tsv")
  [[ -z "$reviews" ]] && { echo "FAIL #$pr: no decisive review by $CEO"; return 1; }
  last=$(echo "$reviews" | sort -t$'\t' -k3 | tail -1)
  IFS=$'\t' read -r state cid at url <<<"$last"
  [[ "$state" != "APPROVED" ]] && { echo "FAIL #$pr: latest $CEO review is $state ($url)"; return 1; }
  [[ "$cid" != "$head" ]] && { echo "FAIL #$pr: approval is STALE — approved ${cid:0:7}, PR head is now ${head:0:7}"; return 1; }
  [[ -n "$want" && "$cid" != "$want"* ]] && { echo "FAIL #$pr: approved ${cid:0:7} but expected ${want:0:7}"; return 1; }
  holds=$(gh api --paginate "repos/$repo/issues/$pr/comments" --jq ".[] | select(.user.login==\"$CEO\" and (.body|test(\"\\\\bHOLD\\\\b\")) and .created_at > \"$at\") | .html_url")
  [[ -n "$holds" ]] && { echo "FAIL #$pr: CEO posted HOLD after approving ($holds)"; return 1; }
  echo "PASS #$pr: APPROVED by $CEO on ${cid:0:12} at $at — $url"
}

if [[ "${1:-}" == "--audit" ]]; then
  repo="$2"; bad=0
  # first-parent history of main via local API walk
  sha=$(gh api "repos/$repo/commits/main" --jq .sha)
  while [[ -n "$sha" ]]; do
    prs=$(gh api "repos/$repo/commits/$sha/pulls" --jq '[.[] | select(.merged_at!=null and .base.ref=="main") | .number] | join(" ")')
    msg=$(gh api "repos/$repo/commits/$sha" --jq '.commit.message | split("\n")[0]')
    if [[ -z "$prs" ]]; then echo "FAIL ${sha:0:7}: not from a merged PR (direct push) — $msg"; bad=1
    else for p in $prs; do check_pr "$repo" "$p" || bad=1; done; fi
    sha=$(gh api "repos/$repo/commits/$sha" --jq '.parents[0].sha // empty')
  done
  exit $bad
fi
[[ $# -ge 2 ]] || { sed -n '2,5p' "$0"; exit 2; }
check_pr "$@"
