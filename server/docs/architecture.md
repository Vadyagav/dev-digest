# Architecture — DI container & adapters

The README's request/DI flowchart shows the shape at a glance; this doc goes
one level deeper into *why* it's built this way and how a module actually
gets its hands on an adapter.

## The problem the container solves

Every feature module (`src/modules/<name>/`) needs things that talk to the
outside world — an LLM, GitHub, a git checkout, an embedder — but none of
them should construct those directly. Two reasons:

1. **Tests need to swap them for mocks** without touching module code
   (`src/adapters/mocks.ts` — `MockLLMProvider`, `MockGitClient`,
   `MockEmbedder`, …).
2. **Some adapters need lazy, cached, secret-gated construction** — an LLM
   client shouldn't be built (and shouldn't require an API key) until a
   route actually calls it, and once built it should be reused, not
   reconstructed per request.

`Container` (`src/platform/container.ts:56`) is the single object that owns
this. One instance is created per `buildApp()` call (`src/app.ts:67`) and
decorated onto the Fastify instance (`app.decorate('container', container)`,
`src/app.ts:68`), so every route handler reaches it via `app.container`.

## Three adapter-resolution shapes

Not every adapter needs the same amount of ceremony. The container uses
three patterns, picked per adapter based on what it actually needs:

**1. Plain lazy getter** — for adapters that need no secret and no override
config beyond "did a test inject one":

```ts
// container.ts:89-93
get git(): GitClient {
  if (this.overrides.git) return this.overrides.git;
  this._git ??= new SimpleGitClient(this.config.cloneDir);
  return this._git;
}
```
`codeIndex`, `repoIntel`, `depgraph`, `tokenizer` all follow this exact
shape (`container.ts:103-132`): check `overrides` first, lazily construct
into a private field, return the cached instance next time.

**2. Async + secret-gated** — for adapters that need a secret fetched from
`SecretsProvider` (async, and possibly not configured yet) before they can
be built at all:

```ts
// container.ts:153-160
async github(): Promise<GitHubClient> {
  if (this.overrides.github) return this.overrides.github;
  if (this._github) return this._github;
  const token = await this.secrets.get('GITHUB_TOKEN');
  if (!token) throw new ConfigError('GITHUB_TOKEN is not configured');
  this._github = new OctokitGitHubClient(token);
  return this._github;
}
```
Callers that treat a missing key as "feature not available" (rather than a
hard failure) wrap this in try/catch — see `pulls/routes.ts`'s
`GET /repos/:id/pulls`, which tries `container.github()` and falls back to
serving already-imported PRs when it throws.

**3. Keyed cache** — for adapters where the SAME interface has multiple
possible backing providers, resolved by an id at call time:

```ts
// container.ts:163-171
async llm(id: 'openai' | 'anthropic' | 'openrouter'): Promise<LLMProvider> {
  const injected = this.overrides.llm?.[id];
  if (injected) return injected;
  const cached = this.llmCache.get(id);
  if (cached) return cached;
  const provider = await this.buildLlm(id);
  this.llmCache.set(id, provider);
  return provider;
}
```
`buildLlm` (`container.ts:173-193`) is the only place that knows how to turn
a provider id into a concrete class + its secret key. Each agent stores
which provider/model it uses (`agent.provider`), so a review run resolves
whichever provider that agent is configured for — see the worked example
below.

`invalidateSecretCaches()` (`container.ts:214-218`) clears the `llmCache`
and the cached GitHub/embedder instances — called after a key is
saved/changed via Settings so the next resolve picks up the new secret
instead of reusing a client built from a stale (or missing) one.

## Repositories live in the container too

`agentsRepo` and `reviewRepo` (`container.ts:95-101`) are constructed the
same lazy-getter way, even though they're not "adapters" in the port/mock
sense — they're the composition root's answer to "which module owns the
`ReviewRepository` instance." Any module that needs to read/write agent
runs, reviews, or findings goes through `container.reviewRepo`, never by
importing another module's repository file directly. This is why
`pulls/routes.ts` (a different module from `reviews/`) can query
`t.agentRuns` for the PR list's SCORE/COST columns without importing
anything from `modules/reviews/`.

## Module registration

A module is a Fastify plugin: a function `(app: FastifyInstance) => Promise<void>`
exported as default from `modules/<name>/routes.ts`. It's added to the
static registry in `src/modules/index.ts:24-33` (one import, one object key)
and registered in a loop in `app.ts:168-170`:

```ts
for (const plugin of Object.values(modules)) {
  await app.register(plugin);
}
```

Registration is static (not filesystem-autoloaded) so the same code path
works identically under `tsx` (dev), the built output, and Vitest — a
native `import()` of a `.ts` path isn't portable across those (see the
comment at `modules/index.ts:16-19`). Inside its `routes.ts`, a module
typically builds one service instance from the container
(`const service = new ReviewService(container)`, see
`modules/reviews/routes.ts:22`) and calls it from each route handler; the
service is where adapter calls and repository calls actually happen — route
handlers stay thin (parse → call service → return).

## Worked example: how a review run gets its LLM provider

1. `POST /pulls/:id/review` (`modules/reviews/routes.ts:27`) resolves which
   agents to run, then calls `ReviewService.runReview`
   (`modules/reviews/service.ts:103`).
2. `runReview` creates an `agent_runs` row per target agent and hands off to
   `ReviewRunExecutor.executeRuns` (`run-executor.ts:55`), which loops over
   each job and calls `runOneAgent` (`run-executor.ts:138`).
3. `runOneAgent` resolves the provider **for that specific agent's
   configured provider** — `this.container.llm(agent.provider as Provider)`
   (`run-executor.ts:160`) — not a fixed one. Two agents on the same PR can
   use different providers (e.g. one OpenAI, one OpenRouter) and each
   resolves (and caches) independently through the same `Container.llm()`
   keyed cache.
4. If the agent's provider has no configured key, `buildLlm` throws
   `ConfigError`; `runOneAgent`'s surrounding try/catch persists the run as
   `status: 'failed'` with that error message (visible in the PR's Agent
   runs timeline) rather than crashing the whole `executeRuns` loop — a
   misconfigured agent doesn't take down every other agent's run.

## Test doubles

Every port has a mock in `src/adapters/mocks.ts`, re-exported through the
`src/adapters/index.ts:12` barrel (`export * from './mocks.js'`). Integration
tests build the app with `overrides` (`buildApp({ overrides: { llm: {...},
git: new MockGitClient(...) } })`) so the exact same route/service/executor
code path runs against deterministic fixtures instead of real network calls
— see `server/specs/review-flow.md` for how this is used to test the full
review lifecycle end-to-end without ever calling a real LLM.
