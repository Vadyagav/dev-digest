# Insights

Non-obvious findings, decisions, and lessons learned while working in
`reviewer-core/` that aren't already captured in [CLAUDE.md](CLAUDE.md) or
[README.md](README.md). Populated by the `engineering-insights` skill.
Append-only — add new dated entries, never edit or remove existing ones.

<!-- ### YYYY-MM-DD — short title
What was surprising, and why it matters. -->

## What Works

## What Doesn't Work

## Codebase Patterns

## Tool & Library Notes

### 2026-09-20 — this package uses npm, not pnpm (package-lock.json)
`reviewer-core/package-lock.json` exists, not a `pnpm-lock.yaml` — confirmed
via `ls`. `./scripts/dev.sh` explicitly `npm ci`s this package (its raw TS
source is imported by `server` at runtime via a tsconfig path alias, and the
comment there says why). Install/add-dependency commands here must use
`npm`, not `pnpm add` — using pnpm would create a stray `pnpm-lock.yaml`
alongside the real lockfile.

## Recurring Errors & Fixes

### 2026-09-20 — `let x = ''` immediately overwritten before any read is a real dead store
`src/llm/openrouter.ts:66` had `let lastRaw = '';` where every code path
(the loop's first statement) overwrites it before any read — ESLint's
`no-useless-assignment` (part of `eslint:recommended` as of ESLint 9+) caught
this on the very first lint run. Fixed to `let lastRaw: string;` (no
initializer; TS's definite-assignment analysis is fine with it since the
loop runs unconditionally at least once before `lastRaw` is read). Worth
grepping for the pattern `let \w+ = ('' | 0 | \[\] | null)` followed by an
unconditional overwrite at the top of the next code path — cheap to introduce
by copy-paste refactor, easy for a human reviewer to miss, easy for a linter
to catch.

## Session Notes

### 2026-09-20 — added ESLint (flat config) — 1 error, fixed
Added `eslint@^10` + `@eslint/js` + `typescript-eslint` recommended via
`eslint.config.js:1-20`, same `argsIgnorePattern: '^_'` convention as
`server/`. One real error found and fixed (see Recurring Errors above);
zero warnings otherwise.

## Open Questions
