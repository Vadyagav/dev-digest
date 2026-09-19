# CLAUDE.md

A map, not documentation. Read the linked READMEs for depth — this file only
holds what you can't infer from the code or catch with a linter/typechecker.

## Use when

- Architecture, quick start, ports → read `README.md`
- Testing strategy → read `TESTING.md`
- Working inside one package → read that package's own `CLAUDE.md`
  (`server/`, `client/`, `reviewer-core/`, `e2e/`)

## Stack

- Node ≥22 · pnpm ≥10 · Docker (Postgres 16 + pgvector)
- `server/`: Fastify 5 · Drizzle ORM · TypeScript 5.7 · Vitest 2
- `client/`: Next.js 15 (App Router) · React 19 · TanStack Query · Tailwind 4
- `reviewer-core/`: pure TypeScript, no framework
- `e2e/`: tsx + Vercel agent-browser (CDP), no LLM in the loop

## Where things are

| Folder | Package | Docs |
|---|---|---|
| `server/` | `@devdigest/api` — :3001 | [server/README.md](server/README.md) · [server/CLAUDE.md](server/CLAUDE.md) |
| `client/` | `@devdigest/web` — :3000 | [client/README.md](client/README.md) · [client/CLAUDE.md](client/CLAUDE.md) |
| `reviewer-core/` | `@devdigest/reviewer-core` | [reviewer-core/README.md](reviewer-core/README.md) · [reviewer-core/CLAUDE.md](reviewer-core/CLAUDE.md) |
| `e2e/` | `@devdigest/e2e` | [e2e/README.md](e2e/README.md) · [e2e/CLAUDE.md](e2e/CLAUDE.md) |
| `server/src/vendor/shared` | `@devdigest/shared` (Zod contracts) | — |
| `server/src/modules/repo-intel` | codebase indexer (repo map) | [server/README.md](server/README.md) |
| `docs/agent-prompts` | reviewer system prompts reference | [docs/agent-prompts/README.md](docs/agent-prompts/README.md) |

## Build & test

- Bring up everything: `./scripts/dev.sh` (`--no-seed` · `--no-client` · `--db-only`)
- Per package (run inside `server/`, `client/`, `reviewer-core/`, `e2e/`):
  `pnpm dev` · `pnpm test` · `pnpm typecheck`
- Server test split: `pnpm exec vitest run --exclude '**/*.it.test.ts'` (unit)
  vs `pnpm exec vitest run .it.test` (Postgres via testcontainers)

## Conventions (not obvious from code)

- No workspace/monorepo tooling — four standalone packages, each with its own
  `package.json` + lockfile; cross-package code goes through tsconfig path
  aliases, never npm/pnpm workspaces or a published module.
- Shared Zod contracts are vendored, not published — duplicated at
  `server/src/vendor/shared` and `client/src/vendor/shared`; no build step
  syncs them, mirror by hand.
- `reviewer-core` has no build — `build`/`typecheck` both just run
  `tsc --noEmit`; `server` consumes its TS source directly via a path alias.
- Migrations do not run on boot — `pnpm db:migrate` is a manual step.
- Secrets (LLM keys, `GITHUB_TOKEN`) live in `~/.devdigest/secrets.json`
  (mode `0600`) via `LocalSecretsProvider`, never in `.env` at rest;
  `process.env` is a fallback only. `GITHUB_TOKEN` is canonical,
  `GITHUB_PAT` is accepted only as a fallback.
- A DB-backed test must be named `*.it.test.ts` or the unit/integration split
  — and the CI path filters that depend on it — silently breaks.
- `REPO_INTEL_ENABLED` defaults to `true`; an unindexed repo degrades the
  review prompt silently to diff-only rather than erroring.

## Do not touch

- `server/clones/` — gitignored git checkouts of imported repos, regenerated
  on import; never hand-edit or commit into.
- `server/src/vendor/*` and `client/src/vendor/*` — vendored; keep both
  copies identical rather than letting them diverge.
