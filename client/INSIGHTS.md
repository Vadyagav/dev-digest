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
`RunCostBadge.tsx`'s exported `formatRunCost`/`formatTokens` are the single
source of truth for rendering a run's cost: `PRRow.tsx` and `RunHistory.tsx`
use them via the `<RunCostBadge>` component (compact/timeline variants), but
`RunTraceDrawer/_components/TraceBody/TraceBody.tsx`'s Stats grid has no
badge slot — it renders a bare `<Stat label val>` tile, so it imports
`formatRunCost` directly instead of wrapping `<RunCostBadge>`. When a value
needs to render both inside a purpose-built component AND inside a generic
`label/val` tile elsewhere, export the formatter standalone rather than
forcing the second call site to use the first's component wrapper.

### 2026-09-20 — a nullable numeric field renders "—", never "0.00"/"0"
`RunCostBadge` and the COST `<Stat>` tile both treat `cost_usd: null` as
"provider reported no usage/pricing" and render `"—"` — never `"$0.00"`.
This is a deliberate UI convention for money-like fields on a run row (a run
CAN legitimately cost exactly $0 in theory, but in practice `null` always
means "unknown", so the UI never distinguishes the two) — worth reusing for
any future per-run numeric stat that can be genuinely absent.

## Tool & Library Notes

### 2026-09-20 — two working spellings for the same shared-contracts import
`@devdigest/shared` and `@/vendor/shared` both resolve to
`src/vendor/shared/index.ts` (`tsconfig.json:23-25`) and both typecheck.
The established convention across the codebase (and `client/CLAUDE.md`) is
`@devdigest/shared`; `pulls/constants.ts` uses `@/vendor/shared` instead —
harmless today, but if it spreads it'll make `@devdigest/shared` look
optional when it's actually the intended package-style alias.

## Recurring Errors & Fixes

## Session Notes

### 2026-09-20 — added cost display across 3 views
COST column on the PR list (`PRRow.tsx`, `constants.ts` GRID/COLUMN_KEYS),
a `"N tok · $X"` line under each run's timestamp in the agent-runs timeline
(`RunHistory.tsx`), and a 4th COST `<Stat>` tile in the run trace drawer's
Stats grid (`TraceBody.tsx`), all backed by the new `RunCostBadge`
component. See `server/INSIGHTS.md` for the backend half (schema + routes).

## Open Questions
