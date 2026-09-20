# Insights

Non-obvious findings, decisions, and lessons learned while working in
`e2e/` that aren't already captured in [CLAUDE.md](CLAUDE.md) or
[README.md](README.md). Populated by the `engineering-insights` skill.
Append-only — add new dated entries, never edit or remove existing ones.

<!-- ### YYYY-MM-DD — short title
What was surprising, and why it matters. -->

## What Works

## What Doesn't Work

## Codebase Patterns

## Tool & Library Notes

### 2026-09-20 — this package uses npm, not pnpm (package-lock.json)
`e2e/package-lock.json` exists, not a `pnpm-lock.yaml` — same situation as
`reviewer-core/` (see its INSIGHTS.md). Documented commands (`pnpm test`,
`pnpm typecheck`) still work fine as script-runners regardless of which tool
populated `node_modules`, but adding/removing a dependency here must go
through `npm`, not `pnpm add` — `pnpm` would write a stray `pnpm-lock.yaml`
alongside the real one.

## Recurring Errors & Fixes

## Session Notes

### 2026-09-20 — added ESLint (flat config) — 0 problems
Added `eslint@^10` + `@eslint/js` + `typescript-eslint` recommended via
`eslint.config.js:1-19`, same `argsIgnorePattern: '^_'` convention as
`server/`/`reviewer-core/`. `npm run lint` over the whole package (`run.ts`,
`lib/`) found zero problems on the first run.

## Open Questions
