# client/CLAUDE.md — `@devdigest/web`

Repo-wide conventions: [../CLAUDE.md](../CLAUDE.md).

## Use when

- Page/route map, commands → read [client/README.md](README.md)
- Deep-dives → read `client/docs/` · UI/flow specs → read `client/specs/` ·
  findings → read [client/INSIGHTS.md](INSIGHTS.md) before starting, update
  it via `engineering-insights` before ending non-trivial work

## Stack & run

- Next.js 15 (App Router) + React 19 + TanStack Query, TypeScript 5.7,
  Vitest 2 + jsdom
- `pnpm dev` (:3000) · `pnpm build` · `pnpm test` (fetch mocked, no API
  needed) · `pnpm typecheck`
- API base: `NEXT_PUBLIC_API_BASE` (default `http://localhost:3001`)

## Where things are

- `src/app/**/page.tsx` — routes; pages stay thin
- `src/app/**/_components/<Name>/` — feature logic + colocated `*.test.tsx`
- `src/lib/hooks/*` — TanStack Query hooks; the only callers of `src/lib/api.ts`
- `src/components/app-shell` — nav, breadcrumbs, `g`-then-key shortcuts
- `src/vendor/ui` (`@devdigest/ui`) — vendored UI primitives
- `src/vendor/shared` — vendored Zod contracts, see [../CLAUDE.md](../CLAUDE.md)
- `messages/<locale>/*.json` — `next-intl` translation strings

## Conventions (not obvious from code)

- Types/contracts come from `@devdigest/shared` (Zod, vendored at
  `src/vendor/shared`) — never hand-duplicate them.
- All API access goes through `src/lib/api.ts`, called only from
  `src/lib/hooks/*` — don't call `fetch` or the API base directly from a
  component.
- Feature logic lives in colocated `_components/<Name>/` next to its route,
  not in the shared `components/` catch-all (reserved for cross-cutting
  chrome like `app-shell`).
- Component tests mock `fetch` and need neither the API nor a browser — real
  browser journeys are covered separately by [`../e2e`](../e2e/README.md).
- `src/vendor/ui` and `src/vendor/shared` are vendored copies, not this
  package's own source — mirror `server/src/vendor/shared` exactly.

## Do not touch

- `src/vendor/ui/` and `src/vendor/shared/` — mirror
  `server/src/vendor/shared/` for the shared contracts; don't diverge.
