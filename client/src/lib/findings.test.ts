import { describe, it, expect } from "vitest";
import type { ReviewRecord } from "@devdigest/shared";
import { countBySeverity, latestReviewPerAgent } from "./findings";

function review(o: Partial<ReviewRecord>): ReviewRecord {
  return {
    id: "r",
    pr_id: "pr1",
    agent_id: "a1",
    run_id: null,
    kind: "review",
    verdict: null,
    summary: null,
    score: null,
    model: null,
    grounding: null,
    created_at: "2026-09-20T10:00:00.000Z",
    agent_name: null,
    findings: [],
    ...o,
  };
}

describe("countBySeverity", () => {
  it("groups by severity, omitting severities with zero findings", () => {
    const counts = countBySeverity([
      { severity: "CRITICAL" },
      { severity: "CRITICAL" },
      { severity: "WARNING" },
    ]);
    expect(counts).toEqual({ CRITICAL: 2, WARNING: 1 });
    expect(counts.SUGGESTION).toBeUndefined();
  });

  it("returns an empty object for no findings", () => {
    expect(countBySeverity([])).toEqual({});
  });
});

describe("latestReviewPerAgent", () => {
  it("keeps only the newest review per distinct agent_id", () => {
    const old = review({ id: "old", agent_id: "a1", created_at: "2026-09-20T10:00:00.000Z" });
    const recent = review({ id: "new", agent_id: "a1", created_at: "2026-09-20T12:00:00.000Z" });
    const other = review({ id: "b", agent_id: "b1", created_at: "2026-09-20T11:00:00.000Z" });
    const result = latestReviewPerAgent([old, recent, other]);
    expect(result.map((r) => r.id).sort()).toEqual(["b", "new"]);
  });

  it("never dedupes reviews with a null agent_id against each other", () => {
    const r1 = review({ id: "r1", agent_id: null });
    const r2 = review({ id: "r2", agent_id: null });
    const result = latestReviewPerAgent([r1, r2]);
    expect(result.map((r) => r.id).sort()).toEqual(["r1", "r2"]);
  });
});
