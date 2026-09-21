# Specs

Feature/behavior specs for `server/`.

- [review-flow.md](review-flow.md) — the full PR-review lifecycle: triggering
  a run, the shared diff-load pre-work, per-agent execution (repo-intel
  enrichment, single-pass vs map-reduce, grounding, scoring), SSE live
  progress, what a client can read back afterward, and how the whole flow is
  tested without a real LLM.
