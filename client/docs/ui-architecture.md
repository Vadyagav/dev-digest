# UI architecture

How `client/` is wired together: the Server/Client Component boundary, data
fetching, the shared UI/contracts vendor layers, and translations. See
[pages.md](../specs/pages.md) for what each route actually renders.

## Server/Client Component boundary

There is exactly **one** real Server Component boundary in this app:
`src/app/layout.tsx`. It's an `async` component with no `"use client"`,
calling `next-intl/server`'s `getLocale()`/`getMessages()` server-side, then
handing the result to `<NextIntlClientProvider>` and `<Providers>` (both
client). Below that, almost everything is a Client Component — this is not
a page that "happens to need client behavior in a few spots", it's a
client-rendered SPA-style app sitting under one server-rendered shell.

Three `page.tsx` files ARE genuinely thin Server Components (no `"use
client"`, 7-9 lines, pure re-export of a `_components/<View>`):
`agents/page.tsx`, `onboarding/page.tsx`, `settings/[section]/page.tsx`. The
`_components/<View>` they render is itself `"use client"`, so the actual
page logic still runs client-side — the thinness only means route params
parsing happens one level down instead of in `page.tsx`.

The other four `page.tsx` files are `"use client"` themselves and contain
real logic inline (49-185 lines: query-param tab state, loading/error/repo-
not-found branching, hook calls) rather than delegating everything to a
`_components/<View>`: `src/app/page.tsx` (redirect-to-first-repo),
`agents/[id]/page.tsx`, `repos/[repoId]/pulls/page.tsx`, and
`repos/[repoId]/pulls/[number]/page.tsx`. So "pages stay thin" (per
`client/CLAUDE.md`) is true for 3 of 7 routes, not a blanket rule — check the
actual file before assuming a `page.tsx` is a dumb wrapper.

## Data fetching: TanStack Query hooks are the only door to the API

`src/lib/api.ts` exports `apiFetch`/`api.{get,post,put,patch,del}`, a thin
`fetch` wrapper against `NEXT_PUBLIC_API_BASE` (default
`http://localhost:3001`) that normalizes every non-2xx response into
`ApiError` (`status`/`code`/`details`). Nothing outside `src/lib/hooks/*`
calls `api`/`fetch` directly — components only ever call a hook.

Hooks are grouped by domain, one file per domain, all re-exported from
`src/lib/hooks/index.ts`:

- `core.ts` — settings, secrets status, repos, PR list/detail, project context
- `agents.ts` — agent CRUD + provider model lists
- `reviews.ts` — run history, active runs, reviews, run/finding actions, live
  SSE run events (`useRunEvents`)
- `trace.ts` — `useRunTrace`, the single-document `GET /runs/:id/trace`
- `repo-intel.ts` — repo-intel status/resync

Conventions worth knowing before adding a hook:

- Query keys are arrays, domain-prefixed: `["pulls", repoId]`,
  `["pull", prId]`, `["run-trace", runId]`. A mutation that changes server
  state invalidates the matching key(s) in its `onSuccess` — e.g.
  `useRefreshRepo` invalidates both `["repos"]` and `["pulls", repoId]`.
- `usePulls` polls (`refetchInterval: 60_000`, `refetchOnWindowFocus: true`)
  — the PR list is expected to drift as GitHub/CI activity happens
  server-side; most other queries don't poll.
- The single `QueryClient` (`src/lib/providers.tsx`) wires a global
  `queryCache`/`mutationCache` `onError` that toasts network/5xx failures
  automatically — a component doesn't need its own error toast for those,
  only for its own inline empty/error states on expected 4xxs.

## Provider stack

`src/lib/providers.tsx`'s `<Providers>` nests, outside-in:
`QueryClientProvider` → `ThemeProvider` → `ToastProvider` → `RepoProvider`.
`RepoProvider` (`src/lib/repo-context.tsx`) resolves the "active repo" with
this priority: `:repoId` in the URL path > `localStorage["dd-repo"]` > the
first repo from `useRepos()`. `useActiveRepo()`/`useRepoNotFound(repoId)`
read from it — the latter is how a stale/deleted repo in the URL renders a
friendly `<RepoNotFound>` empty state instead of a hard error.

## Vendor layers

- `src/vendor/shared` (`@devdigest/shared`) — the vendored Zod contracts
  (mirrors `server/src/vendor/shared`, kept identical by hand, see repo-root
  CLAUDE.md). All API response/request types come from here — never
  hand-duplicate a shape. Import it as `@devdigest/shared`, the path-alias
  package name — a raw `@/vendor/shared` import also resolves (same
  `tsconfig.json` target) but isn't the convention; see `client/INSIGHTS.md`.
- `src/vendor/ui` (`@devdigest/ui`) — vendored design-system primitives
  (`Badge`, `Button`, `Skeleton`, `EmptyState`, `ErrorState`, `Icon`,
  `CircularScore`, …), plus small shared config objects like
  `SETTINGS_SECTIONS` and `SHORTCUTS` (`src/vendor/ui/nav.ts`). Same
  "vendored, not published, mirror by hand" rule as `vendor/shared`.

## Component colocation

Feature logic lives next to its route: `src/app/**/_components/<Name>/`,
PascalCase folder matching a PascalCase `<Name>.tsx`, with a colocated
`<Name>.test.tsx` and often a component-local `styles.ts`/`constants.ts`/
`helpers.ts`. A `_components/<View>` can itself have a nested `_components/`
for sub-pieces (e.g. `AgentsListView/_components/CreateAgentModal/`).

`src/components/<kebab-case>/` is the **only** place for cross-cutting
chrome shared across unrelated routes — `app-shell` (nav/breadcrumbs/`g`-key
shortcuts), `page-shell`, `repo-not-found`, `run-cost-badge`,
`diff-viewer`, `mermaid-diagram`. Route-local component folders are
PascalCase; this shared bucket is kebab-case — that casing difference is
the tell for "is this reusable chrome or one route's own view."

## Translations (`next-intl`)

Single locale (`en`), no locale routing (`src/i18n/request.ts`,
`LOCALE = "en"`). Messages are split one JSON file per feature namespace
under `messages/en/<namespace>.json` (`prReview.json`, `runs.json`,
`agents.json`, `settings.json`, …) — `loadMessages()` merges them at
request time into `{ [namespace]: {...} }` keyed by filename, so a new
feature adds its own `messages/en/<feature>.json` without touching any
other file or a central registry. Consume via `useTranslations("<ns>")` in
a Client Component (`ns` = the JSON filename without `.json`) — e.g.
`useTranslations("prReview")` reads `messages/en/prReview.json`.
