import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReviewRecord } from "@devdigest/shared";
import messages from "../../../../../../../../messages/en/prReview.json";

vi.mock("../../../../../../../lib/hooks/reviews", () => ({
  useDeleteReview: () => ({ mutate: vi.fn(), isPending: false }),
  useFindingAction: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { ReviewRunAccordion } from "./ReviewRunAccordion";

afterEach(cleanup);

const REVIEW: ReviewRecord = {
  id: "r1",
  pr_id: "pr1",
  agent_id: "a1",
  run_id: "run1",
  kind: "review",
  verdict: "request_changes",
  summary: "Two issues found.",
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
      title: "Hardcoded secret",
      file: "src/config.ts",
      start_line: 11,
      end_line: 11,
      rationale: "A secret is committed.",
      suggestion: null,
      confidence: 0.95,
      kind: "finding",
      trifecta_components: null,
      evidence: null,
      review_id: "r1",
      accepted_at: null,
      dismissed_at: null,
    },
    {
      id: "f2",
      severity: "WARNING",
      category: "perf",
      title: "N+1 query",
      file: "src/api/users.ts",
      start_line: 45,
      end_line: 52,
      rationale: "Loop calls a query per user.",
      suggestion: null,
      confidence: 0.86,
      kind: "finding",
      trifecta_components: null,
      evidence: null,
      review_id: "r1",
      accepted_at: null,
      dismissed_at: null,
    },
  ],
};

function renderAccordion() {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      <ReviewRunAccordion review={REVIEW} prId="pr1" defaultOpen />
    </NextIntlClientProvider>,
  );
}

describe("ReviewRunAccordion — severity pills + filter buttons", () => {
  it("shows a filter button per severity present, none for absent severities", () => {
    renderAccordion();
    expect(screen.getByRole("button", { name: "Critical" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Warning" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Suggestion" })).not.toBeInTheDocument();
    // both cards render by default — the pill count for each severity above
    // equals exactly the number of finding-cards of that severity here (criterion 17)
    expect(screen.getByText("Hardcoded secret")).toBeInTheDocument();
    expect(screen.getByText("N+1 query")).toBeInTheDocument();
  });

  it("clicking a filter button shows only that severity's findings", () => {
    renderAccordion();
    fireEvent.click(screen.getByRole("button", { name: "Critical" }));
    expect(screen.getByText("Hardcoded secret")).toBeInTheDocument();
    expect(screen.queryByText("N+1 query")).not.toBeInTheDocument();
  });

  it("clicking the same filter button again clears the filter", () => {
    renderAccordion();
    const criticalBtn = screen.getByRole("button", { name: "Critical" });
    fireEvent.click(criticalBtn);
    expect(screen.queryByText("N+1 query")).not.toBeInTheDocument();
    fireEvent.click(criticalBtn);
    expect(screen.getByText("Hardcoded secret")).toBeInTheDocument();
    expect(screen.getByText("N+1 query")).toBeInTheDocument();
  });
});
