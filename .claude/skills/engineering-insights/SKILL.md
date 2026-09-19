---
name: engineering-insights
description: Reads and appends to the INSIGHTS.md of the package being worked in (client, server, reviewer-core, or e2e). Use at the start of any task in a module to read its accumulated findings before work begins, and again before ending non-trivial work to record new patterns, mistakes, quirks, recurring errors, non-obvious decisions, or open questions discovered this session.
---

# Engineering Insights

Captures per-module learnings so the next session in `client/`, `server/`,
`reviewer-core/`, or `e2e/` starts already knowing what this one found.

## Start of task

Read `<package>/INSIGHTS.md` for the module you're about to work in before
doing anything else. Treat its entries as high-confidence guidance unless
something in the current code contradicts it — if so, flag the
contradiction rather than silently trusting either source.

## Sections — what counts as each

- **What Works** — an approach or solution that worked, worth reusing.
- **What Doesn't Work** — a dead end or antipattern, so it isn't retried.
- **Codebase Patterns** — a convention or architectural decision, and why.
- **Tool & Library Notes** — a dependency's quirk, limit, or surprising
  behavior.
- **Recurring Errors & Fixes** — a problem seen more than once, and its fix.
- **Session Notes** — a dated summary of what a session accomplished.
- **Open Questions** — something unresolved that's worth investigating
  later.

## Workflow — end of task

Copy this checklist and work through it in order:

```
- [ ] 1. Gate check: did something substantive happen?
- [ ] 2. Read the target section in full
- [ ] 3. Dedupe check against existing entries
- [ ] 4. Write the entry (or stop, if 1 or 3 failed)
```

**1. Gate check.** Does something from this session match one of the
sections above? If nothing does, stop here — write nothing. A session that
only did what the task obviously asked, with no surprise, gets no entry.

**2. Read the target section.** Open `<package>/INSIGHTS.md` and read the
whole matching `##` section before writing anything.

**3. Dedupe check.** Is the same finding — even worded differently — already
in that section? If yes, stop. Don't add a near-duplicate.

**4. Write the entry.** Append under the matching section:
`### YYYY-MM-DD — short title`, then one line with a concrete file:line,
command, or number — not a vague generality. Test: if the same fact would
already be obvious to anyone reading the code cold, don't write it.

**Vague (don't write this):** "Promises can be tricky."
**Useful (write this instead):** "`Promise.all()` on the ingest pipeline
times out after 30 items — use `Promise.allSettled()` batched by 10."

Append-only in all cases: never edit or delete an existing entry. If one is
now wrong, add a new dated entry that supersedes it and say so.

## Upkeep

- If a section is approaching ~200 entries, or one topic dominates it,
  propose splitting into a domain file (e.g. `INSIGHTS-Auth.md`) next to
  `INSIGHTS.md` instead of letting it keep growing flat.
- If two entries conflict, don't pick one silently — add a dated entry that
  supersedes the stale one and say why.
- `INSIGHTS.md` is a draft, not ground truth — spot-check unfamiliar entries
  against the current code before relying on them.
