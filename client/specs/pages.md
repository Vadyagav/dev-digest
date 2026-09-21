# Pages — routes, data, and behavior

What each route under `src/app/` loads and shows. See
[../docs/ui-architecture.md](../docs/ui-architecture.md) for the
Server/Client Component split and hook conventions this spec assumes.

## `/` — `src/app/page.tsx`

Client Component. Calls `useRepos()`; once it resolves with at least one
repo, redirects (`router.replace`) to `/repos/:firstRepoId/pulls`. No repos
→ renders an empty state pointing at onboarding. Purely a routing gate, no
own UI beyond loading/empty states.

## `/repos/:repoId/pulls` — PR list

Client Component (`repos/[repoId]/pulls/page.tsx`). Data: `usePulls(repoId)`
(`GET /repos/:id/pulls`, polls every 60s + on window focus). Also calls
`useRefreshRepo()` (manual "sync now" button) and `useActiveRepo()` /
`useRepoNotFound(repoId)` for the repo-context guard.

Behavior:
- Filter state lives in the URL (`?status=`, default `"needs_review"`
  applied client-side, not server-side — `usePulls` always fetches the full
  list); free-text query and sort are local `useState`, not URL-persisted.
- Columns are driven by `COLUMN_KEYS` (`./constants.ts`) and rendered from
  `messages/en/prReview.json`'s `list.columns.*` — current order:
  `pullRequest, author, size, score, status, cost, updated`. Add a column by
  extending `COLUMN_KEYS` + the `GRID` template string together, plus a cell
  in `PRRow.tsx`, plus the i18n key.
- Row states: loading → `SKELETON_ROWS` `<Skeleton>` rows; error → inline
  `<ErrorState>` with retry; empty (after status/query filtering) →
  `<EmptyState>` with a status-specific body.
- An unknown/stale `:repoId` (not in `useRepos()`'s list) renders
  `<RepoNotFound>` instead of attempting the PR fetch.
- COST column: `pr.cost_usd` via `<RunCostBadge>` (compact variant) — the
  **sum** of every `status='done'` run's cost for that PR (not just the
  latest run), `—` when the PR has no completed run or none reported a cost
  (never `$0.00` for "unknown"). See `server/specs/` for the server-side
  aggregation.

## `/repos/:repoId/pulls/:number` — PR detail

Client Component (`repos/[repoId]/pulls/[number]/page.tsx`), the largest
page in the app. Resolves `:number` → the PR's UUID via the (cached)
`usePulls(repoId)` list (every per-PR API is UUID-keyed, the route is
number-keyed), then `usePullDetail(prId)` for the full PR (body, files,
commits). Tab state lives in `?tab=` (`overview` | `findings` | `diff`,
default `overview`) — the visible tab labels are "Overview" / "Agent runs" /
"Files changed" (`PrDetailHeader.tsx`), but the query-param values and
internal component name (`FindingsTab`) still say `findings`, not
`agent-runs` — don't be misled by the label when grepping for the tab key.

Guards, in order: stale `:repoId` → `<RepoNotFound>`; still loading (pulls
list OR PR detail) → skeleton blocks; PR fetch error or missing →
full-screen `<ErrorState>` with retry.

### Overview tab (`tab=overview`)
Renders `pr.body` (the PR description) via `<OverviewTab>`. No extra fetch.

### Agent runs tab (`tab=findings`) — `<FindingsTab>`
Data already fetched by the page and passed down: `usePrReviews(prId)`
(reviews grouped into accordions), `usePrActiveRuns(prId)` (server-sourced
`status='running'` rows — survives navigation/reload, self-clears via
polling), `usePrRuns(prId)` (full run history incl. failed/cancelled). Two
distinct sections, in this order:

1. **Timeline** (`SectionLabel` "Timeline", shown only if there's at least
   one run or commit) — `<RunHistory>` renders `prRuns` interleaved with
   `pr.commits`, newest first. Each run tile: outcome badge (colored by the
   denormalized blocker/finding count, NOT the raw run status — a `done` run
   with blockers reads "rejected", never a green "done"), score ring,
   agent/model, a `tok · $cost` line via `<RunCostBadge variant="timeline">`
   once the run has settled, a "open trace" button, and (own-run only) a
   delete button. Clicking the agent name scrolls to and expands that run's
   card in Review runs below (`onGoToReview`/`targetRunId` handoff) — tiles
   are NOT independently expandable.
2. **Review runs** (`SectionLabel` "Review runs", always rendered) — one
   `<ReviewRunAccordion>` per `ReviewRecord` in `runs` (= `usePrReviews`'
   result), newest first, first one `defaultOpen`. Expanding a card shows
   `<VerdictBanner>` (verdict, summary, PR score) then `<FindingsPanel>` →
   `<FindingCard>` list, each with **Accept**/**Dismiss** action buttons
   (`onAction("accept"|"dismiss")`) that call `useFindingAction()`.
   `<FindingsPanel>` currently offers only a single "hide low confidence"
   toggle — no per-severity (Critical/Warning/Suggestion) filter or count
   pills exist yet (tracked as a gap, not a stale doc — see
   `client/INSIGHTS.md`, 2026-09-20 entry).

Also on this tab: a "Live review" banner + `<RunStatus>` while
`liveRunIds.length > 0` (SSE progress via `useRunEvents`), a "Lethal
Trifecta detected" banner when any finding has `kind === "lethal_trifecta"`.

Opening a run's trace (`?trace=<runId>`, from either section's "open trace"
button) renders `<RunTraceDrawer>` as an overlay, independent of the active
tab. Its own two tabs: **trace** (`useRunTrace(runId)` → Configuration,
Stats — Duration/Tokens/Cost/Findings-count — via `<TraceBody>`, Prompt
assembly, Tool calls, Raw output, and a `<FindingsSection>` listing the
run's actual findings, not just their count) and **log** (`useRunEvents`,
live during a run).

### Files changed tab (`tab=diff`) — `<DiffTab>`
Renders `pr.files` (from the already-loaded `usePullDetail` payload) as a
file-by-file diff viewer; comments are enabled only when `pr.status ===
"open"` (`usePrComments`/`useCreatePrComment`).

## `/agents` — Agents list

Server Component wrapper (`agents/page.tsx`, 7 lines) around
`<AgentsListView>` (Client Component). Data: `useAgents()`. Renders
`<AgentCard>` per agent plus a "create agent" flow (`<CreateAgentModal>` →
`useCreateAgent()`).

## `/agents/:id` — Agent editor

Client Component (`agents/[id]/page.tsx`). Data: `useAgents()` (for the left
agent list), `useAgent(id)` (the one being edited), `useUpdateAgent()`.
`VALID_TABS = ["config"]` — a single "Config" tab today (model + system
prompt via `<AgentEditor>`); the `?tab=` mechanism exists but nothing else
is wired to it yet.

## `/settings/:section` — Settings

Server Component wrapper (`settings/[section]/page.tsx`, 7 lines) around
`<SettingsView>`. Sections come from `SETTINGS_SECTIONS`
(`@devdigest/ui`, `src/vendor/ui/nav.ts`): `api-keys` → `useSettings()` +
`useTestConnection()` + `useSecretsStatus()`; `models` → provider model
lists (`useProviderModels`). An unknown `:section` falls back to the first
entry (`api-keys`).

## `/onboarding` — Add repository

Client Component (`onboarding/page.tsx` wraps `<AddRepoView>`). Data:
`useAddRepo()` (`POST /repos`). The route the root page (`/`) redirects to
when `useRepos()` resolves empty.
