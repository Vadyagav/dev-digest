# Flow coverage contract

What each `*.flow.json` in this directory actually asserts, and what it
doesn't. The README's coverage table names the journeys; this is the
per-flow contract — read it before adding a flow (to avoid duplicating an
existing assertion) or before trusting a green run to mean more than it
does. See `../docs/runner-architecture.md` for how a flow file executes.

All seven flows are **read-only** against seeded demo data — none submits a
form, triggers a review, or makes a model call.

## 01-app-boot.flow.json

- **Preconditions:** none beyond a DB with ≥1 repo.
- **Asserts:** the app root (`/`) redirects to some repo's `/pulls`, and the
  "Pull Requests" heading renders. Order-independent by design — it proves
  client + API + DB are live, nothing about *which* repo or its content.
- **Does not assert:** which repo landed, that any PR is listed, or the
  seeded PR's specifics — that's flow 02's job.

## 02-repo-pulls-detail.flow.json

- **Preconditions:** a freshly-seeded DB where `acme/payments-api` (PR #482)
  is the *first* repo — guaranteed by `e2e-web.yml`'s fresh seed, not true
  of a local dev DB with other imported repos.
- **Asserts:** the seeded PR title is visible in the list, clicking it
  navigates to `/pulls/482`, and the same title renders on the detail page.
  Exercises nested routing and the per-PR detail fetch.
- **Does not assert:** anything about the PR's tabs (Agent runs, Files
  changed) — those are flows 04/05.

## 03-agents.flow.json

- **Preconditions:** none beyond the standard seed (a "Security Reviewer"
  agent).
- **Asserts:** `/agents` renders that seeded agent via `AgentCard`.
- **Does not assert:** agent creation/edit, or any other seeded agent.

## 04-pr-findings.flow.json

- **Preconditions:** same as 02 (fresh seed, `acme/payments-api` first).
- **Asserts:** from PR #482 → Agent runs tab (`tab=findings` in the URL),
  the newest run's accordion is open by default and shows verdict
  "request changes", a "2 findings" count, and the seeded
  `FindingCard` text "Hardcoded Stripe secret key in commit" — i.e. the
  whole `ReviewRunAccordion` → `VerdictBanner` → `FindingsPanel` →
  `FindingCard` chain renders real seeded content, not just the tab shell.
- **Does not assert:** the FindingCard's Accept/Reject buttons do anything
  (no click), any severity filter/count UI, or older (collapsed) runs'
  content — only the newest run's default-open state is checked.
- **Known gap:** as of 2026-09-20 there is no severity-count-pill row, no
  per-severity filter buttons, and no PR-list-page findings popover in the
  app at all (see `client/INSIGHTS.md`) — there is nothing yet for a flow to
  cover here even if one were added.

## 05-pr-diff.flow.json

- **Preconditions:** same as 02.
- **Asserts:** PR #482 → Files changed tab (`tab=diff`) renders a seeded
  changed file path (`src/config.ts`) via the diff viewer.
- **Does not assert:** diff line content, add/remove coloring, or more than
  one file.

## 06-onboarding.flow.json

- **Preconditions:** none.
- **Asserts:** `/onboarding` renders the add-repository heading and a
  "Repository URL" field.
- **Does not assert:** form submission — deliberately read-only, since
  submitting would attempt a real clone/import.

## 07-settings.flow.json

- **Preconditions:** none.
- **Asserts:** `/settings/api-keys` renders an "API Keys" section title and
  `/settings/models` renders a "Feature Models" section title.
- **Does not assert:** any settings value, save action, or other settings
  sub-route.

## Suite-wide gaps (not covered by any flow, as of 2026-09-20)

- No PR-list-page interactions at all beyond "the seeded row is visible and
  clickable" (04/05 navigate through it, nothing hovers/filters/sorts it).
- No cost UI (PR list COST column, timeline cost badge, trace-drawer COST
  stat) — all added after these flows were last written; see
  `client/INSIGHTS.md` 2026-09-20 entries.
- No multi-run PR (a PR reviewed more than once) — every flow assumes the
  single seeded run on PR #482.
- No error states (failed run, network error, empty repo list).
