# reviewer-core/CLAUDE.md — `@devdigest/reviewer-core`

Repo-wide conventions: [../CLAUDE.md](../CLAUDE.md).

## Use when

- Pipeline diagram, commands → read [reviewer-core/README.md](README.md)
- Pipeline architecture (prompt assembly, mode selection, structured-output
  loop, reduce) → read [reviewer-core/docs/pipeline.md](docs/pipeline.md) ·
  the exact grounding/scoring contract → read
  [reviewer-core/specs/grounding-and-scoring.md](specs/grounding-and-scoring.md) ·
  findings → read [reviewer-core/INSIGHTS.md](INSIGHTS.md) before starting,
  update it via `engineering-insights` before ending non-trivial work

## Stack & run

- Pure TypeScript, no framework, no DB/GitHub/filesystem access
- `pnpm typecheck` (also `build` — there's no emitted JS; both just run
  `tsc --noEmit`)
- `pnpm test` (vitest, hermetic, stubbed `LLMProvider`)
- `pnpm lint` (ESLint flat config, `eslint.config.js`)

## Where things are

- `src/prompt.ts` — `assemblePrompt()`, `wrapUntrusted()`, `INJECTION_GUARD`
- `src/grounding.ts` — `groundFindings()`, the mandatory citation gate
- `src/llm/` — `LLMProvider` interface + `openrouter.ts` implementation
  (injected — never imported directly by consumers)
- `src/output/` — structured-output parsing (`toJsonSchema`, `extractJson`,
  `parseWithRepair`)
- `src/review/run.ts` — orchestrates a single-pass run
- `src/index.ts` — the only supported entrypoint; import from here, not from
  internal files

## Conventions (not obvious from code)

- The only side effect allowed anywhere in this package is the injected
  `LLMProvider` call — no DB, GitHub, or filesystem access. A change that
  needs one of those belongs in `server/`, not here.
- `server` consumes this package as TypeScript **source** via a tsconfig path
  alias (`@devdigest/reviewer-core` → `../reviewer-core/src`) — there is no
  `dist` to keep in sync.
- Optional prompt slots (`skills`, `memory`, `specs`, `callers`) are accepted
  but intentionally unused by the starter server — don't remove them as dead
  code; later course lessons feed them.
- `groundFindings()` is mandatory: a finding without a real diff-line
  citation is dropped, and the score is recomputed from survivors only —
  never trust or re-add the model's self-reported score.
- `INJECTION_GUARD` is deliberately not a keyword/denylist scan — untrusted
  content handling is meant to stay model-side, via `wrapUntrusted`.

## Naming conventions

- Files: `kebab-case.ts` (`to-review.ts`), one file per concern, grouped
  under a lowercase folder by area (`llm/`, `output/`, `review/`).
- Functions: `camelCase`, verb-first (`groundFindings`, `assemblePrompt`,
  `extractJson`); classes/interfaces: `PascalCase` (`OpenRouterProvider`,
  `LLMProvider`).
- True constants: `SCREAMING_SNAKE_CASE` (`DEFAULT_MAP_THRESHOLD_LINES`,
  `SEV_RANK`, `FAIL_ON_MIN_RANK`) — not for ordinary `const` bindings, only
  values that are conceptually configuration/lookup tables.

## Do not touch

- Nothing package-specific beyond the repo-wide list in
  [../CLAUDE.md](../CLAUDE.md) — this package owns no vendored or generated
  files.
- `package-lock.json` — this package uses npm, not pnpm (see repo-root
  `./scripts/dev.sh` note); never hand-edit, rerun `npm ci` to regenerate.
