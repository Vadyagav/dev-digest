# Docs

Design docs and deeper explanations for `server/` that don't belong in
[../README.md](../README.md) or [../CLAUDE.md](../CLAUDE.md).

- [architecture.md](architecture.md) — the DI container: how adapters are
  resolved (plain lazy / secret-gated / keyed-cache), how repositories are
  shared across modules, how a module registers, and a worked example of an
  LLM provider being resolved for a review run.
