# Insights

Non-obvious findings, decisions, and lessons learned while working in
`server/` that aren't already captured in [CLAUDE.md](CLAUDE.md) or
[README.md](README.md). Populated by the `engineering-insights` skill.
Append-only — add new dated entries, never edit or remove existing ones.

<!-- ### YYYY-MM-DD — short title
What was surprising, and why it matters. -->

## What Works

## What Doesn't Work

## Codebase Patterns

### 2026-09-20 — "latest run per PR" is a read-time derivation, not a denorm column
`pulls/routes.ts` GET `/repos/:id/pulls` computes both the SCORE and (as of
this session) COST columns the same way: one `IN (...)` query over
`agent_runs`/`reviews` ordered `desc(ranAt)`/`desc(createdAt)`, then a JS
`Map` where the first row seen per `prId` wins. There's no FK/denorm column
on `pull_requests` for "latest run". Any new per-PR-list-row stat should
follow this exact pattern rather than adding a join or a trigger.

### 2026-09-20 — a reverted commit is still a valid reference via `git show`
Commit `93119a5` ("run cost badge") implemented `agent_runs.cost_usd` end to
end but was reverted from `main` by `c6af1e4` as collateral damage of an
unrelated "restore starter state" revert — the cost feature itself wasn't
rejected. It's still reachable (`git show 93119a5 -- <path>`) and was used
as a near-complete template when re-implementing the same field this
session. Worth checking `git log -p --all` / reflog for a prior attempt
before designing a feature from scratch, especially anything mentioning
observability/cost — several fields in `contracts/observability.ts` and
`contracts/productionize.ts` (`total_cost_usd`, `avg_cost_usd`) look like
groundwork for a similar not-yet-reverted-in feature.

## Tool & Library Notes

### 2026-09-20 — `tsconfig.json`'s `include` excludes `server/test/` entirely
`server/tsconfig.json:28` is `"include": ["src/**/*.ts"]` — it has never
covered `test/**/*.ts`. Effects: (1) `pnpm typecheck` (`tsc --noEmit -p
tsconfig.json`) never type-checks any test file; (2) the IDE's TS server,
finding no project that includes an open test file, falls back to default
compiler options — producing false-positive TS2307 (`@devdigest/shared`
unresolvable, no `paths`) and TS1378 (top-level `await` needs a modern
target) on files that are actually fine; (3) Vitest itself never hits this
because `vitest.config.ts` transpiles via esbuild with its own
`resolve.alias`, bypassing tsc entirely. Confirmed by temporarily adding
`test/**/*.ts` to `include` and re-running `tsc`: those two error classes
disappear, but ~11 *other*, pre-existing type errors surface across
`adapters.test.ts`, `agents-versions.it.test.ts`, `prompt-callers.test.ts`,
and `repo-intel-facade-degraded.test.ts` — so widening `include` is a real,
separate cleanup task, not a one-line fix.

## Recurring Errors & Fixes

### 2026-09-20 — a field returned by an LLM adapter can be silently dropped downstream
All three `LLMProvider` adapters (`adapters/llm/openai.ts`,
`adapters/llm/anthropic.ts`, `reviewer-core/src/llm/openrouter.ts`) compute
and return `costUsd` on every `CompletionResult`/`StructuredResult`, and
`reviewer-core/src/review/run.ts` accumulates it into
`ReviewOutcome.costUsd` — but `run-executor.ts` destructured only
`{ tokensIn, tokensOut, grounding }` from the outcome, so `costUsd` was
computed on every review run and thrown away before this session. When a
provider/adapter type has a field that isn't in the destructuring pattern a
few layers up, grep for every consumer's destructure list, don't assume
"it's in the type so it's used."

## Session Notes

### 2026-09-20 — added `agent_runs.cost_usd` end-to-end
Added the column (migration `0010_stormy_medusa.sql`), stopped
`run-executor.ts` from dropping `outcome.costUsd`, threaded it through
`run.repo.ts` (`completeAgentRun`, `listRunsForPull`) and the PR-list route,
and added `cost_usd` to `PrMeta`/`RunSummary`/`RunStats` in both vendor
contract copies. Server-side only — see `client/INSIGHTS.md` for the UI half.

## Open Questions

### 2026-09-20 — should `tsconfig.json` `include` cover `test/**`?
Doing so is straightforward but surfaces ~11 pre-existing type errors in
other test files (see the Tool & Library Notes entry above) — someone needs
to decide whether to fix those in the same change or gate them off first.

### 2026-09-20 — `setupRepoAndPr` is duplicated across two integration tests
`test/reviews.it.test.ts` and `test/pulls-comments.it.test.ts` each define
their own ~90-line `setupRepoAndPr(db, workspaceId)` helper (repo + PR +
prFiles fixture), independently. Worth extracting to a shared
`test/helpers/` module next time either file is touched.
