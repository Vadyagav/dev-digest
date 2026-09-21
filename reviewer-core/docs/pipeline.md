# Pipeline architecture

How `reviewPullRequest()` turns a diff into a grounded `Review`, and why each
stage exists. See [`../README.md`](../README.md) for the one-paragraph
pitch and pipeline diagram; this doc goes one level deeper into each stage's
data flow and the decisions baked into it. Behavior guarantees (exact
grounding/scoring rules) live in
[`../specs/grounding-and-scoring.md`](../specs/grounding-and-scoring.md) —
this file explains the *architecture*, that one is the *contract*.

## Entrypoint and boundary

`src/index.ts` is the only supported import surface — it re-exports the
public API from `prompt.ts`, `grounding.ts`, `llm/structured.ts`,
`review/reduce.ts`, `review/run.ts`, `output/to-review.ts`, and
`llm/openrouter.ts`. Consumers (the server, the CI runner) import from here,
never from an internal file directly, so an internal reshuffle doesn't break
callers.

The package's only side effect anywhere is the LLM call, and even that is
**injected** (`ReviewInput.llm: LLMProvider`) rather than imported — no DB,
GitHub, filesystem, or global state. This is what makes `reviewPullRequest`
testable with a stub provider and reusable from two very different hosts
(the server's live studio and the CI runner's GitHub Action) without either
one pulling in the other's infrastructure.

## Stage 1 — prompt assembly (`prompt.ts`)

`assemblePrompt(parts: PromptParts): AssembledPrompt` builds the two-message
chat payload (`system`, `user`) sent to the LLM, plus a `PromptAssembly`
record (kept verbatim for the run trace — see the server's `RunTrace.prompt_assembly`).

Two things happen here that matter beyond formatting:

- **Every external string is untrusted data, never instructions.**
  `wrapUntrusted(label, content)` fences a block as
  `<untrusted source="...">…</untrusted>` and neutralizes any attempt to
  close the tag early (`</untrusted>` → `<\/untrusted>` inside the content).
  The diff, PR description, repo skeleton, callers digest, and spec chunks
  all go through this — anything that ultimately comes from the PR author or
  the repo itself, since a PR is attacker-controlled input from the engine's
  point of view.
- **`INJECTION_GUARD`** is a fixed paragraph appended to every system prompt
  (`system = \`${parts.system}\n\n${INJECTION_GUARD}\``). It tells the model
  that untrusted blocks are data, and — the specific attack it defends
  against — that a PR claiming to be a "test fixture", "demo", "not for
  production", or telling the reviewer to "ignore" certain issues does NOT
  reduce or waive findings. This is a **prompt-side** defense by design:
  there is no keyword/regex denylist scanning PR content anywhere in this
  package (or in `server/`) — seeking to catch injection phrasing with
  pattern matching only ever catches the phrasings you thought of. See
  `INJECTION_GUARD`'s own comment in `prompt.ts:16-28` for the exact wording.

Optional sections (`skills`, `memory`, `specs`, `repoMap`, `callers`,
`prDescription`) are each omitted from the assembled prompt entirely when
empty/undefined — not rendered as an empty heading — so a caller that never
supplies them (e.g. the current server, which only passes diff + system
prompt + repo map) produces an identical prompt to a version of the engine
that never had those slots at all. This is why adding a new optional slot
here is a safe, non-breaking change for existing callers.

`prDescription` is truncated to `MAX_PR_DESCRIPTION_CHARS` (4000) before
wrapping — a PR body is author-controlled and otherwise unbounded, and this
is a prime spot for both a token-budget blowout and an injection attempt.

## Stage 2 — mode selection: single-pass vs map-reduce (`review/run.ts`)

`selectMode(strategy, diff, threshold)` decides how many LLM calls one
review makes:

- `strategy: 'single-pass'` → always one call over the whole diff.
- `strategy: 'map-reduce'` → one call per changed file, but only if there's
  more than one file (`diff.files.length > 1`); a single-file diff runs
  single-pass regardless, since map-reduce buys nothing (and costs more)
  when there's only one chunk to make.
- `strategy: 'auto'` (the default) → map-reduce only when the diff is
  **both** large (`totalLines > threshold`, default
  `DEFAULT_MAP_THRESHOLD_LINES = 400`, sum of every file's
  `additions + deletions`) **and** multi-file. A 600-line single-file diff
  stays single-pass; a 5-file, 120-line diff stays single-pass too — only
  the combination of "big" and "spread across files" pays for the extra
  calls.

In map-reduce mode, `sliceDiff(diff, path)` (`review/reduce.ts`) extracts
just one file's hunk from the raw unified diff text (falling back to a
synthesized 3-line header if the raw slice comes up empty), and each file
gets its own `assemblePrompt` call and its own LLM round-trip. In
single-pass mode there's exactly one chunk, labeled `'all files'` — the
labeling matters because it's what shows up in the run trace's `tool_calls`
list and in progress events (`'map: reviewing <file>'` vs
`'Reviewing <file> in one pass'` — see `run.ts:167-171`, don't mislabel a
single-pass run as a map step).

## Stage 3 — the LLM call and structured output (`llm/`)

`ReviewInput.llm` is an `LLMProvider` (from `@devdigest/shared`) — this
package defines and exports exactly one concrete implementation,
`OpenRouterProvider` (`llm/openrouter.ts`), shared by the server's
OpenRouter path and the CI runner (the only two consumers that talk to
OpenRouter). The server's OpenAI/Anthropic adapters live in `server/`, not
here, because they need server-side pricing/config the engine deliberately
doesn't own (see "cost attribution" below).

`OpenRouterProvider.completeStructured` is the only method `reviewPullRequest`
calls (the others — `complete`, `embed` — throw `NOT_SUPPORTED`; this
provider exists for exactly one job). Per attempt (up to `maxRetries + 1`,
default 3 total):

1. Calls OpenRouter's OpenAI-compatible `chat.completions.create` with
   `response_format: { type: 'json_schema', json_schema: { strict: true, ... } }`
   — the schema comes from `toJsonSchema` (`llm/structured.ts`), which
   converts the caller's Zod schema via OpenAI's own `zodResponseFormat`
   helper (draft-07 JSON Schema).
2. Guards against OpenRouter's HTTP 200-with-no-`choices` failure mode
   (an upstream provider error, moderation block, or free-tier limit
   surfaces as an empty `choices` array, not a thrown error) —
   `openrouter.ts:88-92` throws explicitly instead of letting a `undefined`
   propagate silently.
3. Runs `parseWithRepair(schema, rawText)` (`llm/structured.ts`): parses the
   raw text as JSON (falling back to `extractJson`'s fence/brace scan only
   if direct `JSON.parse` fails — direct parse first because
   `extractJson`'s brace-matching can be fooled by `{`/```` ``` ```` that
   appear *inside* a JSON string value, e.g. markdown in a summary field),
   then `schema.safeParse`s it. On failure, the raw output and a
   schema-violation message are appended as `assistant`/`user` turns and the
   loop retries — this is the reprompt-on-schema-failure loop, not a
   different kind of retry (network/5xx retries are the OpenAI SDK's own
   `maxRetries`, set on the client in the constructor).

**Cost attribution is deliberately push-based, not pulled from a table this
package owns.** OpenRouter's response can include a real metered
`usage.cost` (an OpenRouter API extension not in the OpenAI SDK's types,
cast explicitly at `openrouter.ts:97`) — when present, that's authoritative.
When absent, the provider falls back to an **injected** `estimateCost`
callback (`OpenRouterProviderOptions.estimateCost`) rather than hardcoding a
price book here — the server passes its own live-pricing estimator, the CI
runner passes none (so its cost comes back `null` when OpenRouter doesn't
report one). This keeps reviewer-core "free of a pricing table" per its own
comment at `llm/openrouter.ts:21-22`, matching the "no I/O beyond the
injected LLM" rule.

## Stage 4 — reduce (`review/reduce.ts`)

Only reached in map-reduce mode with more than one partial result;
single-pass and single-chunk map-reduce both short-circuit
(`reduceReviews` returns `partials[0]` unchanged when `partials.length === 1`).
Otherwise: findings are concatenated across all partials, the **worst**
verdict wins (`VERDICT_RANK`: `request_changes` > `comment` > `approve`),
and an intermediate `score` is computed as the **mean of the partials' own
scores** — this intermediate score is a throwaway: `reviewPullRequest`
immediately overwrites it after grounding (see Stage 5). Summaries are
concatenated with a space. `reduceReviews` and `sliceDiff` have no `this`
and no I/O, which is why they're safe to share between the server and the
CI runner without either owning the other's dependencies.

## Stage 5 — the shared grounding gate (`grounding.ts`)

Run exactly once per review, after reduce, regardless of which mode
produced the findings — grounding is not duplicated per-strategy. See
[`../specs/grounding-and-scoring.md`](../specs/grounding-and-scoring.md)
for the precise rule; architecturally, the important point is that **this
is the only place the final score is computed** — `run.ts:207-208` builds
the returned `review.score` from `scoreFromFindings(ground.kept)`, discarding
both the model's self-reported score (from the LLM's `Review.score` field)
and reduce's intermediate mean-of-partials score. Every number the UI shows
for a run — verdict, score, blocker count — is derived from the *same* list
of grounded findings, so they can never contradict each other on screen.

## Output: `ReviewOutcome`

`reviewPullRequest` returns one `ReviewOutcome` object carrying everything a
caller needs to persist a run without re-deriving it: the grounded `review`
itself, the `grounding` summary string (e.g. `"3/4 passed"`, from
`groundingSummary`), the `dropped` findings with human-readable reasons (so
a dropped finding is logged, never silently discarded), which `mode` ran,
the `assembly` (for the trace), per-chunk `tool_calls` labels, and the
accumulated `tokensIn`/`tokensOut`/`costUsd` totals across every chunk. The
caller (server: `run-executor.ts`; CI runner) is responsible for all
persistence, streaming, and posting — this package performs no I/O for any
of that, by the same boundary rule as Stage 1.

`output/to-review.ts`'s `toReviewPayload` is a separate, optional
downstream step (not part of `reviewPullRequest` itself) that turns a
grounded `Review` into a `GitHubReviewPayload` for the CI runner to post via
Octokit — markdown body, optional inline comments anchored to real diff
lines (`resolveCommentLine`, dropping a comment rather than posting to an
unresolvable line and having GitHub reject the *whole* review), and a
deterministic APPROVE/COMMENT/REQUEST_CHANGES event computed from finding
severities and the agent's `ci_fail_on` gate (`gateTriggered`) — never from
the model's own verdict field.
