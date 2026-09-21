# Spec: grounding, scoring, and mode selection

This is a behavior contract, not an explanation — see
[`../docs/pipeline.md`](../docs/pipeline.md) for the architecture and why
each rule exists. If the implementation stops matching a rule below, that's
either a regression or this doc is stale — update whichever is wrong, don't
let them silently diverge. Source of truth for every rule here:
`src/grounding.ts`, `src/review/reduce.ts`, `src/review/run.ts`.

## 1. Mode selection (`selectMode`, `review/run.ts:115-121`)

Given `strategy` (`'auto' | 'single-pass' | 'map-reduce'`, default `'auto'`
via `ReviewInput.strategy`), a parsed `diff`, and `threshold`
(`ReviewInput.mapThresholdLines`, default `DEFAULT_MAP_THRESHOLD_LINES = 400`):

| `strategy` | Rule | Result |
|---|---|---|
| `'single-pass'` | always | `single-pass` |
| `'map-reduce'` | `diff.files.length > 1` | `map-reduce` |
| `'map-reduce'` | `diff.files.length <= 1` | `single-pass` (forced down — one file can't be map-reduced) |
| `'auto'` | `totalLines > threshold AND diff.files.length > 1` | `map-reduce` |
| `'auto'` | otherwise | `single-pass` |

`totalLines` = `sum over diff.files of (additions + deletions)`. Both
conditions are required for `auto` to pick map-reduce — a diff that is
large but touches one file, or spread across many files but small, stays
single-pass.

Mode selection happens once per review call, before any LLM call — it is
never re-evaluated mid-run.

## 2. Per-chunk accumulation (`review/run.ts:156-188`)

- `single-pass`: exactly one chunk, `{ label: 'all files', diffText: diff.raw }`.
- `map-reduce`: one chunk per `diff.files` entry, `{ label: file.path, diffText: sliceDiff(diff, file.path) }`.

For every chunk, in order: `tokensIn`/`tokensOut` are summed across all
chunks unconditionally (`tokensIn += res.tokensIn`). `costUsd` uses
different null-handling: it starts at `0`, and **once any chunk returns
`costUsd: null`, the run's total `costUsd` becomes and stays `null` for the
rest of the run** — `costUsd = costUsd == null || res.costUsd == null ? null : costUsd + res.costUsd`
(`run.ts:184`). A run's cost is "the sum of every chunk's cost" only when
*every* chunk reported a known cost; one unknown-cost chunk makes the whole
run's cost unknown, it does not just contribute `0`. (This differs from how
`server/`'s PR-list endpoint sums cost *across runs* — there, a run with
`cost_usd: null` is skipped and doesn't zero the PR's total. Two different
layers, two different null-handling rules — don't assume they match.)

`checkCancelled()` (if supplied) is called before each chunk's LLM call,
never mid-chunk — cancellation granularity is "between chunks," not
"mid-request."

## 3. Reduce (`review/reduce.ts:43-55`, only when `partials.length > 1`)

- `partials.length === 1` → returned unchanged, reduce is a no-op
  (`reduceReviews` short-circuits before touching verdict/score/findings).
- Otherwise: `findings` = concatenation of every partial's `findings`
  (no dedup). `verdict` = the worst by `VERDICT_RANK`
  (`request_changes: 2 > comment: 1 > approve: 0`). `score` = `round(mean of
  partials' own .score fields)` — **this score is intermediate and gets
  discarded**; see rule 5. `summary` = every partial's non-empty summary
  joined with a single space.

## 4. Grounding (`groundFindings`, `grounding.ts:52-84`)

Applied once, after reduce, to the full merged finding list — never
per-chunk, never per-mode. For each finding:

1. If `finding.file` is not one of `diff.files[].path` → **dropped**,
   reason `"file '<file>' not present in diff"`.
2. Else if `finding.kind` is one of the full-file kinds
   (`FULL_FILE_KINDS = {secret_leak, lethal_trifecta, phantom, hook}`,
   `grounding.ts:16`) → **kept unconditionally** — these scanner kinds are
   not tied to a diff hunk, only to the file being present in the diff at
   all.
3. Else → kept only if `[finding.start_line, finding.end_line]` (order
   doesn't matter — `rangeIntersects` normalizes via `min`/`max`)
   intersects at least one new-side line number the diff actually touched
   for that file (built by `buildLineIndex`: hunk's `newLineNumbers` when
   present, else the hunk's declared `[newStart, newStart + newLines)`
   range as a fallback). Otherwise **dropped**, reason
   `"lines <start>-<end> do not intersect any diff hunk in '<file>'"`.

`groundingSummary(result)` = `"<kept>/<kept + dropped> passed"` (e.g.
`"3/4 passed"`) — this exact string is what's persisted as
`agent_runs.grounding` and shown in the run trace/timeline; a change to this
format is a UI-visible, not just internal, change.

## 5. Final scoring (`review/reduce.ts:13-30`, applied at `review/run.ts:208`)

The score returned to the caller is **always**
`scoreFromFindings(ground.kept)` — the model's own self-reported `score`
field (from the structured LLM output) and reduce's intermediate
mean-of-partials score (rule 3) are both discarded and never reach the
caller. This is deliberate: two different agents/models self-report scores
on different, uncalibrated scales, but every review's *final* score is
computed the same deterministic way from the same grounded findings.

`scoreFromFindings(findings)`:

```
penalty = sum over findings of SEVERITY_PENALTY[finding.severity]
score = clamp(100 - penalty, 0, 100)

SEVERITY_PENALTY = { CRITICAL: 35, WARNING: 12, SUGGESTION: 3 }
```

Concretely: 0 findings → 100. One `SUGGESTION` → 97. One `WARNING` → 88.
One `CRITICAL` → 65. Findings of an unrecognized severity contribute `0`
penalty (defensive fallback, `?? 0` at `reduce.ts:28` — should not occur
given `Finding.severity`'s Zod enum, but the arithmetic doesn't throw if it
somehow did). The score can't go below 0 or above 100 regardless of how
many findings pile up.

## 6. Invariant this whole pipeline exists to guarantee

For any completed review, the verdict, the score, the blocker count
(`countBlockers`, `output/to-review.ts:48-51`, computed separately by the
caller from the same `ground.kept` list), and the findings actually shown to
a user are **all derived from one single list of grounded findings** —
never a mix of pre-grounding and post-grounding data, and never the model's
own self-reported verdict/score for anything user-visible. A change that
introduces a second source of truth for any of these (e.g. showing the
model's raw `score` anywhere, or gating CI on ungrounded findings) breaks
this invariant even if it doesn't touch `grounding.ts` itself.
