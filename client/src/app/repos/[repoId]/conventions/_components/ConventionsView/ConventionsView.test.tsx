import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ConventionCandidate } from "@devdigest/shared";
import messages from "../../../../../../../messages/en/conventions.json";

vi.mock("../../../../../../components/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("../../../../../../components/repo-not-found", () => ({ RepoNotFound: () => <div>not found</div> }));
vi.mock("../../../../../../lib/repo-context", () => ({
  useActiveRepo: () => ({ activeRepo: { id: "r1", full_name: "acme/payments-api" } }),
  useRepoNotFound: () => false,
}));
vi.mock("../CreateConventionsSkillModal", () => ({
  CreateConventionsSkillModal: () => <div role="dialog">create-skill-modal</div>,
}));

const extract = vi.fn();
const update = vi.fn();
let data: ConventionCandidate[] = [];
vi.mock("../../../../../../lib/hooks/conventions", () => ({
  useConventions: () => ({ data, isLoading: false, isError: false, refetch: vi.fn() }),
  useExtractConventions: () => ({ mutate: extract, isPending: false, isError: false }),
  useUpdateConvention: () => ({ mutate: update, isPending: false }),
}));

import { ConventionsView } from "./ConventionsView";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const cand = (o: Partial<ConventionCandidate>): ConventionCandidate => ({
  id: "c1",
  category: "naming",
  rule: "Rule one",
  evidence_path: "a.ts",
  evidence_line: 1,
  evidence_snippet: "",
  confidence: 0.9,
  status: "pending",
  accepted: false,
  ...o,
});

function renderView() {
  render(
    <NextIntlClientProvider locale="en" messages={{ conventions: messages }}>
      <ConventionsView repoId="r1" />
    </NextIntlClientProvider>,
  );
}

describe("ConventionsView", () => {
  it("before any scan: Run Scan is active, ReScan is disabled, no Create skill", () => {
    data = [];
    renderView();
    const run = screen.getAllByText("Run Scan")[0]!.closest("button")!;
    expect(run).not.toBeDisabled();
    expect(screen.getByText("ReScan").closest("button")).toBeDisabled();
    fireEvent.click(run);
    expect(extract).toHaveBeenCalled();
    expect(screen.queryByText(/Create skill/)).not.toBeInTheDocument();
  });

  it("after a scan: ReScan re-runs; Create skill appears only once a candidate is accepted", () => {
    data = [cand({}), cand({ id: "c2", rule: "Rule two" })];
    renderView();
    fireEvent.click(screen.getByText("ReScan"));
    expect(extract).toHaveBeenCalled();
    expect(screen.queryByText(/Create skill/)).not.toBeInTheDocument();
    cleanup();

    data = [cand({ status: "accepted", accepted: true }), cand({ id: "c2", rule: "Rule two" })];
    renderView();
    fireEvent.click(screen.getByText("Create skill (1)"));
    expect(screen.getByText("create-skill-modal")).toBeInTheDocument();
  });
});
