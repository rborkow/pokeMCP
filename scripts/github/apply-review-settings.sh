#!/usr/bin/env bash
# Applies the GitHub repository settings that back REVIEW.md:
#   1. A ruleset on the default branch: changes land through PRs, the three build jobs in
#      build.yml must pass, and no force-pushes or deletion.
#   2. Secret scanning and push protection (free for public repos).
#   3. Fork PR workflows wait for maintainer approval for all outside contributors.
#
# Run it once, by hand, as a repo admin, AFTER the PR that adds it has merged. update-stats.yml
# must already open its PR instead of pushing to main, or the next monthly run fails to push.
# Safe to re-run: it updates the ruleset in place.
#
#   bash scripts/github/apply-review-settings.sh            # uses the current gh repo
#   REPO=owner/name bash scripts/github/apply-review-settings.sh
set -euo pipefail

REPO="${REPO:-$(gh repo view --json nameWithOwner -q .nameWithOwner)}"
RULESET_NAME="main: PRs and build checks"
# GitHub Actions' app id. Pinning required checks to it stops anything else from posting a
# passing status under the same name.
ACTIONS_APP_ID=15368

ruleset=$(cat <<JSON
{
  "name": "${RULESET_NAME}",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "bypass_actors": [],
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": false,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": false,
        "required_status_checks": [
          { "context": "Build internal analysis worker", "integration_id": ${ACTIONS_APP_ID} },
          { "context": "Build Teambuilder", "integration_id": ${ACTIONS_APP_ID} },
          { "context": "Build Documentation", "integration_id": ${ACTIONS_APP_ID} }
        ]
      }
    }
  ]
}
JSON
)

existing_id=$(gh api "repos/${REPO}/rulesets" --jq ".[] | select(.name == \"${RULESET_NAME}\") | .id")
if [[ -n "${existing_id}" ]]; then
    echo "Updating ruleset ${existing_id} on ${REPO}"
    gh api -X PUT "repos/${REPO}/rulesets/${existing_id}" --input - <<<"${ruleset}" >/dev/null
else
    echo "Creating ruleset on ${REPO}"
    gh api -X POST "repos/${REPO}/rulesets" --input - <<<"${ruleset}" >/dev/null
fi

echo "Enabling secret scanning and push protection"
gh api -X PATCH "repos/${REPO}" --input - >/dev/null <<'JSON'
{
  "security_and_analysis": {
    "secret_scanning": { "status": "enabled" },
    "secret_scanning_push_protection": { "status": "enabled" }
  }
}
JSON

echo "Requiring approval before workflows run for outside contributors' fork PRs"
gh api -X PUT "repos/${REPO}/actions/permissions/fork-pr-contributor-approval" \
    -f approval_policy=all_external_contributors >/dev/null

echo "Done. Current state:"
gh api "repos/${REPO}/rulesets" --jq '.[] | "  ruleset: \(.name) (\(.enforcement))"'
gh api "repos/${REPO}" --jq '"  secret scanning: \(.security_and_analysis.secret_scanning.status), push protection: \(.security_and_analysis.secret_scanning_push_protection.status)"'
