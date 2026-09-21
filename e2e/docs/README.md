# Docs

Design docs and deeper explanations for `e2e/` that don't belong in
[../README.md](../README.md) or [../CLAUDE.md](../CLAUDE.md) go here.

- [runner-architecture.md](runner-architecture.md) — how `run.ts` turns
  `specs/*.flow.json` into a pass/fail suite (spec format, execution order,
  failure handling, reporting), and why the suite is built on agent-browser
  instead of Playwright/Cypress.
