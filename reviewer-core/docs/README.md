# Docs

Design docs and deeper explanations for `reviewer-core/` that don't belong in
[../README.md](../README.md) or [../CLAUDE.md](../CLAUDE.md) go here.

- [pipeline.md](pipeline.md) — the review pipeline architecture: prompt
  assembly + injection hardening, single-pass vs map-reduce mode selection,
  the injected `LLMProvider`/structured-output loop, reduce, and the shared
  grounding gate. See [`../specs/grounding-and-scoring.md`](../specs/grounding-and-scoring.md)
  for the exact behavioral contract this architecture implements.
