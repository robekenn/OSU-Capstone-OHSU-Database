## Branching
- `main` is always deployable. Never push directly to it.
- Branch from `main`, named `type/issue-number-short-name`
  (examples: `feature/01-search-bar`, `fix/35-login-redirect`, `docs/33-readme-setup`)

## Pull Request
- Link the issue: "Close 01"
- One issue, one purpose per PR
- Required: CI passing + one approval from someone other than the author
- New commits after approval dismiss the approval

## Definition of Done:
A change can merge only when:
- CI passes (lint, tests, build)
- One teammate has approved the pull request
- Docs updated

## The Contribution Norm:
- Work lives in: our GitHub Repo and GitHub Issues.
- Accepted means: For code, the PR is merged after one approval and passing tests. For non-code work, a teammate has to approve it.
- Each teammate has to contribute to every sprint.
- Review turnaround: Reviewers respond within 24 hours; if not, ping the team chat.
