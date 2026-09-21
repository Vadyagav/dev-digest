# Specs

Feature/behavior specs for `reviewer-core/` go here.

- [grounding-and-scoring.md](grounding-and-scoring.md) — the exact contract
  for mode selection, per-chunk cost/token accumulation, reduce, the
  citation-grounding gate, and final scoring. This is the behavior a change
  to `grounding.ts`/`review/reduce.ts`/`review/run.ts` must not silently
  violate.
