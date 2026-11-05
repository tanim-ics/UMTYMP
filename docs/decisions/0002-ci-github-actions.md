# 0002 — CI on GitHub Actions

**Date:** 2026-11-05 · **Status:** accepted (owner) · **Answers:** `tasks/plan.md` open question 4

## Context

Every check runs in Docker (CLAUDE.md §6), and until now only by hand. The repository is on GitHub
(`github.com/tanim-ics/UMTYMP`). Agents write most of the code, so a bar that only runs when someone remembers is
weaker than one that runs on every change.

## Decision

`.github/workflows/ci.yml` runs on every push and pull request to `main`, on `ubuntu-latest`, through the same compose
services as on a laptop: `check:full` (types, lint, format, floor guard, franchise names, secrets, unit tests with
coverage, verifier, audits), the browser suite (`docker compose run --rm e2e`), Lighthouse on the nginx image, and
the image-size check. Node never runs on the runner itself. Permissions are read-only; a failed run keeps the
Playwright traces for 7 days.

## Consequences

- A red check is visible on every commit and pull request; checks can no longer be skipped by forgetting them.
- Uses GitHub Actions minutes (free for a public repository; a private one has a monthly free allowance).
- The timing spec (answer → next under 50 ms with 4× CPU throttling) now also runs on shared runner CPUs, which are
  slower and noisier than a laptop. If it is red there but green locally, that is a finding to look at, not a reason
  to loosen the budget.
- The floor guard compares a pull request with `main`, so the checkout fetches the full history.
