import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReviewRecord } from "@devdigest/shared";
import messages from "../../../../../../../messages/en/prReview.json";

const REVIEW: ReviewRecord = {
  id: "r1",
  pr_id: "pr1",
  agent_id: "a1",
  run_id: "run1",
  kind: "review",
  verdict: "request_changes",
  summary: null,
  score: 61,
  model: "gpt-4.1",
  grounding: null,
  created_at: "2026-09-20T12:00:00.000Z",
  agent_name: "Security Reviewer",
  findings: [
    {
      id: "f1",
      severity: "CRITICAL",
      category: "security",
      title: "Hardcoded Stripe secret key",
      file: "src/config.ts",
      start_line: 12,
      end_line: 12,
      rationale: "A live Stripe key is committed in source.",
      suggestion: null,
      confidence: 0.98,
      kind: "finding",
      trifecta_components: null,
      evidence: null,
      review_id: "r1",
      accepted_at: null,
      dismissed_at: null,
    },
  ],
};

function findingFixture(id: string, reviewId: string, title: string) {
  return {
    id,
    severity: "CRITICAL" as const,
    category: "security" as const,
    title,
    file: "src/x.ts",
    start_line: 1,
    end_line: 1,
    rationale: "r",
    suggestion: null,
    confidence: 0.9,
    kind: "finding" as const,
    trifecta_components: null,
    evidence: null,
    review_id: reviewId,
    accepted_at: null,
    dismissed_at: null,
  };
}

let usePrReviewsMock: (...args: unknown[]) => { data: ReviewRecord[] | undefined };
vi.mock("@/lib/hooks/reviews", () => ({
  usePrReviews: (...args: unknown[]) => usePrReviewsMock(...args),
}));

import { FindingsCell } from "./FindingsCell";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderCell(counts: Record<string, number> | null | undefined) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      <FindingsCell prId="pr1" counts={counts} />
    </NextIntlClientProvider>,
  );
}

describe("FindingsCell", () => {
  it("renders — when there are no findings", () => {
    usePrReviewsMock = () => ({ data: undefined });
    renderCell(null);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders severity pills when counts are present", () => {
    usePrReviewsMock = () => ({ data: undefined });
    renderCell({ CRITICAL: 2, WARNING: 1 });
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    // popover not shown until hover
    expect(screen.queryByText(/FINDINGS IN THIS RUN/)).not.toBeInTheDocument();
  });

  it("hovering shows the read-only popover with finding previews, no action buttons", () => {
    usePrReviewsMock = () => ({ data: [REVIEW] });
    renderCell({ CRITICAL: 1 });
    fireEvent.mouseEnter(screen.getByText("1").closest("div")!);
    expect(screen.getByText("1 FINDINGS IN THIS RUN")).toBeInTheDocument();
    expect(screen.getByText("Hardcoded Stripe secret key")).toBeInTheDocument();
    expect(screen.getByText("src/config.ts:12")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("popover shows each agent's LATEST review only, not superseded re-runs", () => {
    const agentAOld: ReviewRecord = {
      ...REVIEW,
      id: "rA-old",
      agent_id: "a1",
      created_at: "2026-09-20T10:00:00.000Z",
      findings: [findingFixture("fA-old", "rA-old", "Stale finding from an earlier A run")],
    };
    const agentANew: ReviewRecord = {
      ...REVIEW,
      id: "rA-new",
      agent_id: "a1",
      created_at: "2026-09-20T12:00:00.000Z",
      findings: [findingFixture("fA-new", "rA-new", "Current finding from A's latest run")],
    };
    const agentB: ReviewRecord = {
      ...REVIEW,
      id: "rB",
      agent_id: "b1",
      created_at: "2026-09-20T11:00:00.000Z",
      agent_name: "Performance Reviewer",
      findings: [findingFixture("fB", "rB", "Finding from agent B")],
    };
    usePrReviewsMock = () => ({ data: [agentANew, agentB, agentAOld] });
    renderCell({ CRITICAL: 2 });
    fireEvent.mouseEnter(screen.getByText("2").closest("div")!);
    expect(screen.getByText("2 FINDINGS IN THIS RUN")).toBeInTheDocument();
    expect(screen.getByText("Current finding from A's latest run")).toBeInTheDocument();
    expect(screen.getByText("Finding from agent B")).toBeInTheDocument();
    expect(screen.queryByText("Stale finding from an earlier A run")).not.toBeInTheDocument();
  });
});
