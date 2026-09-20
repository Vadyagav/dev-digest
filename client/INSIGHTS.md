# Insights

Non-obvious findings, decisions, and lessons learned while working in
`client/` that aren't already captured in [CLAUDE.md](CLAUDE.md) or
[README.md](README.md). Populated by the `engineering-insights` skill.
Append-only — add new dated entries, never edit or remove existing ones.

<!-- ### YYYY-MM-DD — short title
What was surprising, and why it matters. -->

## What Works

## What Doesn't Work

## Codebase Patterns

### 2026-09-20 — one formatter, reused across a dedicated badge and a bare stat tile
`run-cost-badge/RunCostBadge.tsx:13` (`formatRunCost`) is the single source
of truth for rendering a run's cost: `PRRow.tsx:63` and `RunHistory.tsx:202-204`
use it via the `<RunCostBadge>` component (`RunCostBadge.tsx:27`,
compact/timeline variants), but `RunTraceDrawer/_components/TraceBody/TraceBody.tsx:67`'s
Stats grid has no badge slot — it renders a bare `<Stat label val>` tile, so
it imports `formatRunCost` directly (`TraceBody.tsx:9`) instead of wrapping
`<RunCostBadge>`. When a value needs to render both inside a purpose-built
component AND inside a generic `label/val` tile elsewhere, export the
formatter standalone rather than forcing the second call site to use the
first's component wrapper.

### 2026-09-20 — a nullable numeric field renders "—", never "0.00"/"0"
`RunCostBadge.tsx:38` (`cost = costUsd != null ? formatRunCost(costUsd) :
null`) and `TraceBody.tsx:67` (`stats.cost_usd != null ? formatRunCost(...) :
"—"`) both treat `cost_usd: null` as "provider reported no usage/pricing"
and render `"—"` — never `"$0.00"`. This is a deliberate UI convention for
money-like fields on a run row (a run CAN legitimately cost exactly $0 in
theory, but in practice `null` always means "unknown", so the UI never
distinguishes the two) — worth reusing for any future per-run numeric stat
that can be genuinely absent.

## Tool & Library Notes

### 2026-09-20 — two working spellings for the same shared-contracts import
`@devdigest/shared` and `@/vendor/shared` both resolve to
`src/vendor/shared/index.ts` (`tsconfig.json:23-25`) and both typecheck.
The established convention across the codebase (and `client/CLAUDE.md`) is
`@devdigest/shared`; `pulls/constants.ts:1` (`import type { PrMeta } from
"@/vendor/shared";`) uses `@/vendor/shared` instead — harmless today, but if
it spreads it'll make `@devdigest/shared` look optional when it's actually
the intended package-style alias.

## Recurring Errors & Fixes

### 2026-09-20 — a stale `eslint-disable` comment is itself a lint error once ESLint exists
Adding ESLint for the first time surfaced `// eslint-disable-next-line
react-hooks/exhaustive-deps` at `ReviewRunAccordion.tsx:52` guarding a
`useEffect` whose deps array (`[targetRunId, targetNonce, review.run_id]`)
was already complete — the disable was stale (from an earlier version of the
deps array) and ESLint flags an unused-disable-directive as its own warning.
Removed rather than silenced further. When adding lint to a codebase that
had none, expect a handful of these — check each disable comment is still
covering a real violation, don't assume it's load-bearing.

## Session Notes

### 2026-09-20 — added cost display across 3 views
COST column on the PR list (`PRRow.tsx:63`, `constants.ts:27,48` GRID/
COLUMN_KEYS), a `"N tok · $X"` line under each run's timestamp in the
agent-runs timeline (`RunHistory.tsx:202-207`), and a 4th COST `<Stat>` tile
in the run trace drawer's Stats grid (`TraceBody.tsx:67`), all backed by the
new `run-cost-badge/RunCostBadge.tsx` component. See `server/INSIGHTS.md`
for the backend half (schema + routes).

### 2026-09-20 — homework rubric requires more findings/severity UI than exists
Checked this session's work against a grading rubric (`hw1-criteria.md`,
criteria 16-23): the PR-detail "Agent runs" tab already has the required
Timeline/Review-runs split (`FindingsTab.tsx:126-166`) and Accept/Dismiss
buttons on finding cards (`FindingCard.tsx:91-112`, though labelled
"Dismiss" not literally "Reject") and the trace drawer already shows real
findings, not just stats (`TraceBody.tsx:72` → `FindingsSection.tsx:18-40`)
— but severity-count pills ("N CRITICAL · N WARNING · N SUGGESTION") with
toggleable Critical/Warning/Suggestion filter buttons do not exist anywhere
(`ReviewRunAccordion.tsx:143-151` only renders `VerdictBanner` + a plain
"hide low confidence" `Toggle` in `FindingsPanel.tsx:19,50-56`), and the PR
LIST page has no FINDINGS column or hover popover at all
(`constants.ts` `COLUMN_KEYS` has no `"findings"` entry). None of this was
in scope for the cost feature — recorded here so the next session doesn't
have to re-discover it from scratch.

### 2026-09-20 — added ESLint (`eslint-config-next` flat config) — 9 problems, all pre-existing
`eslint.config.mjs` uses `FlatCompat` to load `next/core-web-vitals` +
`next/typescript` (`eslint-config-next@15.1.12`, pinned to match the
installed `next@^15.1.3`, not the latest major). First `pnpm lint` run over
the whole package found 9 problems, all genuine and all fixed same session:
an `<a>` that should've been `next/link` (`AddRepoView.tsx`), 3×
`@typescript-eslint/no-explicit-any` on a mutation-result prop type
(`FindingsTab.tsx:20` — fixed via `ReturnType<typeof useCancelRun>` instead
of hand-typing the generic), an unescaped `'` (`react/no-unescaped-entities`,
`PrDetailHeader.tsx:106`), a stale `eslint-disable` (see Recurring Errors
above), a genuine `useMemo` missing-dependency (`page.tsx:72-75` — fixed by
inlining `reviews ?? []` instead of depending on the derived `runs` local),
and one `_`-prefixed unused param (`reviews.ts:146`) that only needed the
same `argsIgnorePattern: '^_'` override server's config already used
(mirrored into `eslint.config.mjs`). `next-env.d.ts` (regenerated by
`next dev`/`next build`) is excluded from lint — don't hand-fix its
triple-slash-reference error, it'll just come back.

## Open Questions
