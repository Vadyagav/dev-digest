# Spec — the PR review lifecycle

This documents the behavior of one review run, from the HTTP request to the
data a client can read back afterward. If any of the numbered guarantees
below stop holding, that's a regression — this file exists so a change can
be checked against it, not just against passing tests.

## 1. Triggering a run

`POST /pulls/:id/review` (`modules/reviews/routes.ts:27`), body `{agentId}`
or `{all: true}`. Rate-limited to 10/min per this route
(`routes.ts:29`, tighter than the global 120/min) since each call can fan
out to multiple expensive LLM calls.

`ReviewService.runReview` (`service.ts:103-138`):

- Loads the PR and its repo; 404s if either is missing.
- For **each** target agent: creates an `agent_runs` row up front
  (`status: 'running'`, `service.ts:120-126`) and returns its id as
  `run_id` in the response — **before** the actual review has run. This
  matters: the client gets a `run_id` to subscribe to
  `GET /runs/:id/events` (SSE) immediately, rather than waiting for the
  (possibly 10+ second) review to finish.
- Then fires `ReviewRunExecutor.executeRuns` **without awaiting it**
  (`void this.executor.executeRuns(...).catch(...)`, `service.ts:133`).
  The HTTP response returns `{ pr_id, runs, reviews: [] }` —
  `reviews` is always `[]` here; the actual `ReviewDto`s only exist once
  each run finishes and are fetched separately via
  `GET /pulls/:id/reviews`.
- **A failure in one agent's run does not abort the others.**
  `executeRuns` (`run-executor.ts:107-134`) wraps each `runOneAgent` call in
  its own try/catch; one agent throwing only marks that agent's run failed.

## 2. One shared pre-work step, fanned out to every queued run

Before any per-agent work, `executeRuns` loads the diff **once**
(`run-executor.ts:96-104`, via `loadDiff` — real `git diff base...head`,
falling back to reconstructing one from persisted `pr_files` patches if the
clone/git call fails or returns no files) and logs it through a `RunLogger`
that fans out to **every** queued run's buffer (`run-executor.ts:65-70`).
Consequence: **if diff loading fails, every queued run in this batch is
marked `failed` with the same error** (`failAll`, `run-executor.ts:75-93`) —
a broken diff isn't retried per-agent.

## 3. Per-agent execution (`runOneAgent`, `run-executor.ts:138-289`)

In order:

1. Resolve the agent's configured LLM provider via
   `container.llm(agent.provider)` (`run-executor.ts:160`) — see
   `server/docs/architecture.md` for the resolution mechanics. A missing
   API key throws `ConfigError` here, caught by the outer try/catch and
   persisted as a `failed` run (step 6 below), not a crash.
2. **Repo-intel enrichment — all three steps are best-effort and degrade
   silently, never fail the run:**
   - `buildCallersDigest` (`run-executor.ts:329-359`) — callers of changed
     symbols; `undefined` on any repo-intel error or when there's nothing
     to show, in which case `assemblePrompt` omits the section entirely
     (prompt is byte-identical to repo-intel-off).
   - `buildRepoMapDigest` (`run-executor.ts:366-379`) — the cached repo
     skeleton; `undefined` when the repo isn't indexed (`map.degraded`) or
     repo-intel errors.
   - `buildRankNote` (`run-executor.ts:386-...`) — a one-line "N of M
     changed files are top-5% most-depended-on" hint; empty string when
     nothing qualifies.
   - Each agent has its own `repoIntel` toggle (Agent editor) that skips
     all three unconditionally, independent of the global
     `REPO_INTEL_ENABLED` flag.
3. Call `reviewPullRequest` (`reviewer-core/src/review/run.ts:123`) — the
   pure engine, no I/O beyond the injected `llm`:
   - Picks **single-pass** (whole diff, one LLM call) vs **map-reduce** (one
     call per changed file, merged after) via `selectMode`
     (`run.ts:115-121`) — map-reduce only when the diff exceeds
     `DEFAULT_MAP_THRESHOLD_LINES` (400) lines **and** touches more than one
     file; an explicit `agent.strategy` overrides the heuristic.
   - Accumulates `tokensIn`/`tokensOut`/`costUsd` across every chunk call
     (`run.ts:182-184`) — `costUsd` becomes `null` for the whole run the
     moment **any** chunk's provider call reports an unknown cost (never
     partially summed against an unknown chunk).
   - Reduces per-chunk partial reviews into one (`reduceReviews`), then runs
     the **mandatory** citation-grounding gate (`groundFindings`,
     `run.ts:197`) — a finding whose cited line doesn't actually exist in
     the diff is dropped, with a reason, before anything is persisted.
   - **Score is recomputed from the grounded survivors**
     (`scoreFromFindings(ground.kept)`, `run.ts:208`) — the model's own
     self-reported score is discarded. This is why a run can show a
     different score than what the raw model output claimed.
4. Persist the review + its (already-grounded) findings
   (`repo.insertReview`, `repo.insertFindings`, `run-executor.ts:218-229`),
   and mark the PR's `last_reviewed_sha` = the PR's current head
   (`markReviewed`, `run-executor.ts:234`) — this is the single source the
   PR-list status derivation (`needs_review`/`reviewed`/`stale`) reads.
5. Compute `blockers` — findings at/above the agent's `ciFailOn` severity
   gate (`countBlockers`, `run-executor.ts:240`) — a **deterministic**
   count, independent of the model's verdict string; this is what the
   timeline colors on (a "done" run with blockers > 0 must never render as
   a plain green "done").
6. Persist the `agent_runs` row (`completeAgentRun`, `run-executor.ts:243-254`):
   `status: 'done'`, duration, tokens, `costUsd`, findings count, grounding
   summary, score, blockers. Then build and save **one** `RunTrace` document
   (`saveRunTrace`, `run-executor.ts:256-286`) containing the run's config,
   stats, full prompt assembly, per-chunk tool-call entries, raw model
   output, and the complete event log (not just events emitted inside this
   method — the fanned-out pre-work events are already in this run's
   buffer, so they're included too).
7. `container.runBus.complete(runId)` (`run-executor.ts:287`) — signals any
   live SSE subscriber that this run is done.

On failure or cancellation (the `catch` block, `run-executor.ts:290-...`):
persists `status: 'failed'`/`'cancelled'` with `tokensIn/Out: 0` and the
error text, saves a minimal trace built from whatever's in the event buffer
so far (`traceFromBuffer`, `run-executor.ts:408-432`), and still calls
`runBus.complete` — a failed run is never left permanently "running" in the
UI.

## 4. Live progress: SSE, not polling

`GET /runs/:id/events` (`routes.ts:48-92`) bridges `RunBus`
(`platform/sse.ts`) to an SSE stream: it **replays the buffered events
first** (so a client that connects mid-run, or reconnects, doesn't miss
anything), then streams new ones as `RunBus.publish` emits them, and ends
the stream when `RunBus.complete` fires. A run that already completed
before the client subscribes replays its buffer and ends immediately
(`RunBus.onDone`, `sse.ts:90-100`) — the stream never hangs waiting for a
"done" that already happened.

## 5. What a client can read back

- `GET /pulls/:id/runs` — full run history (any status, newest first,
  including failures with their error text) — `RunSummary[]`.
- `GET /pulls/:id/runs/active` — only `status='running'` rows, the
  server-side source of truth for "which agents are running now" (survives
  a page reload independent of SSE state).
- `GET /pulls/:id/reviews` — persisted `ReviewDto[]` (verdict, summary,
  score, findings) for completed runs.
- `GET /runs/:id/trace` — the single `RunTrace` document (config, stats
  incl. cost, prompt assembly, tool calls, raw output, full log).
- `GET /repos/:id/pulls` — the PR list; each row's `score` and `cost_usd`
  are derived at read time from `agent_runs`/`reviews`, not denormalized
  onto `pull_requests` (see `server/docs/architecture.md`'s note on
  `container.reviewRepo` for why `pulls/routes.ts` can query `agent_runs`
  directly). `cost_usd` is the **sum** of every `status='done'` run's cost
  for that PR (a PR reviewed 3 times has spent all 3 runs' worth); `score`
  is the single **latest** review's score. These are two different
  reductions over the same run history — don't assume they use the same
  "pick one row" logic.

## 6. Testing this flow without a real LLM

`server/test/reviews.it.test.ts` exercises this entire lifecycle against a
real Postgres (testcontainers) with `MockLLMProvider` injected via
`buildApp({ overrides: { llm: { openai: new MockLLMProvider(...) } } })` —
see `server/docs/architecture.md`'s "Test doubles" section. The mock
returns a fixed `costUsd: 0.001` per call
(`src/adapters/mocks.ts`), which is what lets a test assert the sum-of-runs
behavior above deterministically (run the same PR through review twice,
assert the list's `cost_usd` equals both runs' cost added together, not
either one alone).
