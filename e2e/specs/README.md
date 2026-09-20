# Specs

Each `NN-name.flow.json` here is an executable spec — `run.ts` loads and
runs it directly (see `../docs/runner-architecture.md`). This directory also
holds:

- [flows.md](flows.md) — the coverage contract: what each flow actually
  asserts, its preconditions, and known gaps. Read this before adding a new
  flow or trusting a green run to mean more than it does.

| Spec | Flow |
|---|---|
| `01-app-boot.flow.json` | root → redirect to a repo's PR list |
| `02-repo-pulls-detail.flow.json` | PR list → open PR #482 → detail route |
| `03-agents.flow.json` | agents list renders the seeded reviewer agent |
| `04-pr-findings.flow.json` | PR #482 → Agent runs tab → seeded verdict + findings |
| `05-pr-diff.flow.json` | PR #482 → Files changed tab → seeded diff |
| `06-onboarding.flow.json` | add-repository form renders (no submit) |
| `07-settings.flow.json` | API Keys + Feature Models section titles render |
