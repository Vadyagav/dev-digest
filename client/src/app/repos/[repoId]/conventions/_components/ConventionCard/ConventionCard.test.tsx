import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ConventionCandidate } from "@devdigest/shared";
import messages from "../../../../../../../messages/en/conventions.json";
import { ConventionCard } from "./ConventionCard";

afterEach(cleanup);

const C: ConventionCandidate = {
  id: "c1",
  category: "naming",
  rule: "Suffix service classes with Service",
  evidence_path: "src/user-service.ts",
  evidence_line: 3,
  evidence_snippet: "export class UserService {}",
  confidence: 0.92,
  status: "pending",
  accepted: false,
};

function renderCard(c: ConventionCandidate, onUpdate = vi.fn()) {
  render(
    <NextIntlClientProvider locale="en" messages={{ conventions: messages }}>
      <ConventionCard c={c} onUpdate={onUpdate} />
    </NextIntlClientProvider>,
  );
  return onUpdate;
}

describe("ConventionCard", () => {
  it("shows the rule, source file:line, snippet and confidence %", () => {
    renderCard(C);
    expect(screen.getByText("Suffix service classes with Service")).toBeInTheDocument();
    expect(screen.getByText("src/user-service.ts:3")).toBeInTheDocument();
    expect(screen.getByText("export class UserService {}")).toBeInTheDocument();
    expect(screen.getByText("92%")).toBeInTheDocument();
  });

  it("Accept and Reject persist a status change", () => {
    const onUpdate = renderCard(C);
    fireEvent.click(screen.getByText("Accept"));
    expect(onUpdate).toHaveBeenCalledWith({ status: "accepted" });
    fireEvent.click(screen.getByText("Reject"));
    expect(onUpdate).toHaveBeenCalledWith({ status: "rejected" });
  });

  it("Edit turns the card into an inline form and saves the edited rule", () => {
    const onUpdate = renderCard(C);
    fireEvent.click(screen.getByText("Edit"));
    const input = screen.getByPlaceholderText("Rule");
    fireEvent.change(input, { target: { value: "Service classes end in Service" } });
    fireEvent.click(screen.getByText("Save"));
    expect(onUpdate).toHaveBeenCalledWith({ rule: "Service classes end in Service", category: "naming" });
    expect(screen.queryByPlaceholderText("Rule")).not.toBeInTheDocument();
  });

  it("an accepted card offers Undo instead of Accept", () => {
    renderCard({ ...C, status: "accepted", accepted: true });
    expect(screen.getByText("Accepted")).toBeInTheDocument();
    expect(screen.queryByText("Accept")).not.toBeInTheDocument();
    expect(screen.getByText("Undo accept")).toBeInTheDocument();
  });
});
