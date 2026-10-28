# Contributing

Start with the [README](README.md) to set up and run the checks locally. Read [AGENTS.md](AGENTS.md) before making changes, especially if you use AI coding tools. It covers data-safety rules and what must never be committed.

## Branching
- `main` is always deployable. Never push directly to it; every change goes through a pull request.
- Branch from `main`, named `type/issue-number-short-name`. Types: `feature`, `fix`, `docs`, `chore`
  (examples: `feature/01-search-bar`, `fix/35-login-redirect`, `docs/33-readme-setup`, `chore/25-db-schema-tests`)

## Commits
- Write messages that say what changed, e.g. "Add outcome filter to case list", not "finished" or "updates".
- Reference the issue number where it helps, e.g. "(#25)".

## Pull Request
- Link the issue with a closing keyword in the PR description, e.g. `Closes #25`, so GitHub links it and closes the issue on merge.
- One issue, one purpose per PR
- Required: all CI checks passing + one approval from someone other than the author
- New commits after approval dismiss the approval
- If the PR changes `db/schema.sql`, add or update a test in `db/tests/` that would fail if the change were reverted.

## Definition of Done:
A change can merge only when:
- All CI checks pass
- One teammate other than the author has approved the pull request
- Docs updated: if the change affects behavior, setup, requirements or a recorded decision, the matching file (`README.md`, `docs/requirements.md`, `docs/rfcs/`, `AGENTS.md`) is updated in the same PR

## The Contribution Norm:
- Work lives in:
  - Code and project documents: this GitHub repo, through pull requests
  - Tasks: GitHub Issues, tracked on the team board (https://github.com/users/robekenn/projects/4); every item in the current sprint has an owner and a status
  - Team documents (charter, retrospectives, sprint notes): the team's Microsoft Teams files, not this repo
- Accepted means: For code, the PR is merged after one approval and passing tests. For non-code work, a teammate has to approve it.
- Each teammate has to contribute to every sprint.
- Review turnaround: Reviewers respond within 24 hours; if not, ping the team chat.
