# e2e/CLAUDE.md — `@devdigest/e2e`

Repo-wide conventions: [../CLAUDE.md](../CLAUDE.md).

## Use when

- Suite details, commands → read [e2e/README.md](README.md)
- Runner mechanics (spec format, execution order, failure handling) → read
  [e2e/docs/runner-architecture.md](docs/runner-architecture.md)
- Per-flow coverage contract (what each spec asserts, known gaps) → read
  [e2e/specs/flows.md](specs/flows.md)
- findings → read [e2e/INSIGHTS.md](INSIGHTS.md) before starting, update it
  via `engineering-insights` before ending non-trivial work

## Stack & run

- tsx + Vercel agent-browser (CDP) — deterministic, no LLM in the loop
- `pnpm test` (`tsx run.ts`) · `pnpm typecheck` · `pnpm lint` (ESLint flat
  config, `eslint.config.js`) · `../scripts/e2e.sh` for the hermetic CI run
- Needs the real stack up (client :3000 + server :3001 + Postgres) with a
  seeded DB

## Where things are

- `run.ts` — entrypoint that drives the specs
- `specs/` — one file per user journey
- `lib/` — agent-browser helpers/fixtures shared across specs
- `agent-browser.json` — CDP/agent-browser config

## Conventions (not obvious from code)

- Specs are deterministic by construction (no LLM call in the loop) — don't
  add an assertion that depends on model output; that belongs in
  `reviewer-core`'s or `server`'s own test suites.
- Needs Docker (Postgres) and both dev servers running against seeded demo
  data — it is not hermetic like the other suites' unit tests.

## Naming conventions

- Spec files: `NN-kebab-case-name.flow.json`, a zero-padded two-digit prefix
  giving lexical run order (`01-app-boot.flow.json` … `07-settings.flow.json`)
  — `run.ts` loads them by filename sort, so a new spec's number controls
  where it runs, not just its name.

## Do not touch

- Nothing package-specific beyond the repo-wide list in
  [../CLAUDE.md](../CLAUDE.md).
- `package-lock.json` — this package uses npm, not pnpm; never hand-edit,
  rerun `npm ci` to regenerate.
