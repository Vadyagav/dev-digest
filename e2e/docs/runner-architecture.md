# Runner architecture

How `run.ts` turns `specs/*.flow.json` into a pass/fail suite, and why the
suite is built this way instead of on Playwright/Cypress.

## Why agent-browser, not Playwright/Cypress

agent-browser (`vercel-labs/agent-browser`) is a native (Rust + CDP)
browser-automation **CLI**, not a JS test framework — there's no test
runner, no assertion library, no page-object layer bundled with it. That's
the point: this suite needs browser control with zero LLM calls and zero
flakiness from a JS automation layer's own event-loop/retry quirks. Every
locator agent-browser offers is deterministic (`--url`, `--text`,
`find role|text|label`); the CLI also has an AI `chat` command for
natural-language steps, which this suite **never uses** — that's what keeps
runs stable and key-free (see `e2e/README.md`'s "no Playwright, no LLM, no
API key" framing). The tradeoff: because it's not a framework, `run.ts` has
to supply its own thin conventions for spec format, ordering, and reporting
— that's everything below.

## How a flow file becomes a test

A spec (`specs/NN-name.flow.json`) is JSON, not code: `{ name, description?,
steps: [{ cmd, label?, assert? }] }` (`lib/assert.ts:9-22`, the `Step`/`Flow`
types). Each `step.cmd` is a raw agent-browser argv array, e.g.
`["wait", "--text", "#482"]` — `run.ts` does not interpret or validate the
command itself, it just forwards it to the CLI. Two properties matter for
how a flow behaves:

- **Non-zero exit fails the step.** This is the whole assertion mechanism.
  agent-browser's own `wait --text` / `wait --url` block until the condition
  holds or the command times out and exits non-zero — so most "assertions"
  in this suite are just `wait` steps, not a separate assert call.
- **`assert.stdoutIncludes` is an extra, optional layer** on top of that
  (`run.ts:73-77`, `lib/assert.ts:15,42-44` `stdoutContains`) for the rare
  case where exit code alone isn't enough signal.

## Mechanics: `run.ts` end to end

1. **Discovery** (`loadFlows`, `run.ts:53-61`) — every `specs/*.flow.json`
   file is read via `readdirSync` + `.sort()`, so **run order is the lexical
   order of the filenames** — this is why specs are numbered
   `01-app-boot.flow.json` … `07-settings.flow.json` (see the Naming
   conventions section of `../CLAUDE.md`): renumber a file and you change
   when it runs, not just its name.
2. **Execution** (`runFlow`, `run.ts:63-93`) — for each flow, every step's
   `cmd` goes through `resolveArgs` (`lib/assert.ts:37-40`), which
   substitutes the literal string `{BASE}` in any arg with `E2E_BASE_URL`
   (trailing slash stripped) — this is the *only* templating the spec format
   supports. The resolved argv is shelled out via `ab()` (`run.ts:44-51`),
   a thin `promisify(execFile)` wrapper around the `agent-browser` binary
   (`AGENT_BROWSER_BIN`, default `"agent-browser"`), with a per-command
   timeout (`E2E_STEP_TIMEOUT`, default 60000ms) and a 32MB stdout buffer.
   All commands within one flow — and across all flows in one run — share
   **one browser session**; agent-browser's own daemon keeps the page open
   between invocations, so step N can act on state step N−1 left behind
   (e.g. "click the PR row" then "wait for the detail route").
3. **Failure handling** (`run.ts:80-88`) — the first failing step stops that
   flow (`break`, not `continue`): later steps in the same flow assume the
   earlier ones succeeded, so there's no point running them against a page
   that isn't where the flow expects. On failure, the runner best-effort
   captures a screenshot to `test-results/<spec-id>-fail.png`
   (`RESULTS_DIR`, git-ignored, uploaded as a CI artifact by
   `.github/workflows/e2e-web.yml` per `../README.md`) before moving to the
   next flow — one flow's failure never aborts the whole suite.
4. **Teardown** (`run.ts:104-111`) — the shared browser session is closed
   (`ab(["close"])`) in a `finally`, so it happens whether every flow passed
   or the first one crashed.
5. **Reporting** (`summarize`, `lib/assert.ts:46-58`) — a flat PASS/FAIL
   line per flow plus a `"N/M flows passed"` footer; `run.ts:114` exits
   `0` only if every flow's every step passed, `1` otherwise — that exit
   code is what CI actually gates on, the printed summary is for humans.

## What this buys / what it doesn't

Because assertions are just "did agent-browser's own wait/click exit
non-zero," a flow can't express anything more nuanced than "this text/URL
did or didn't appear in time" — there's no DOM snapshot diffing, no
accessibility tree assertions, no visual regression. That's intentional
scope: `../CLAUDE.md`'s Conventions section is explicit that
model-output-dependent assertions belong in `reviewer-core`'s or `server`'s
own suites, not here — this suite only proves the client, API, and DB are
wired together and the seeded read-only data renders where a real user
would look for it.
