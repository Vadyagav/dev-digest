import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Skill } from "@devdigest/shared";
import messages from "../../../../../messages/en/skills.json";
import common from "../../../../../messages/en/common.json";
import { SkillCard } from "./SkillCard";

afterEach(cleanup);

const SKILL: Skill = {
  id: "sk1",
  name: "PR Quality Rubric",
  description: "Scores a diff against the team's quality bar",
  type: "rubric",
  source: "manual",
  body: "# Rule\nBe thorough.",
  enabled: true,
  version: 1,
  evidence_files: null,
  agent_count: 2,
};

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <NextIntlClientProvider locale="en" messages={{ skills: messages, common }}>
        {ui}
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

describe("SkillCard (smoke)", () => {
  it("renders the skill name, description and type badge", () => {
    renderWithIntl(<SkillCard sk={SKILL} />);
    expect(screen.getByText("PR Quality Rubric")).toBeInTheDocument();
    expect(screen.getByText("Scores a diff against the team's quality bar")).toBeInTheDocument();
    expect(screen.getByText("rubric")).toBeInTheDocument();
  });

  it("does not show a source badge for a manual skill", () => {
    renderWithIntl(<SkillCard sk={SKILL} />);
    expect(screen.queryByText("Imported")).not.toBeInTheDocument();
  });

  it("shows a source badge when the skill was imported", () => {
    renderWithIntl(<SkillCard sk={{ ...SKILL, source: "imported_url" }} />);
    expect(screen.getByText("Imported")).toBeInTheDocument();
  });

  it("toggling enabled calls onToggle without bubbling into the card's onClick", () => {
    const onToggle = vi.fn();
    const onClick = vi.fn();
    renderWithIntl(<SkillCard sk={SKILL} onToggle={onToggle} onClick={onClick} />);
    fireEvent.click(screen.getByRole("switch"));
    expect(onToggle).toHaveBeenCalledWith(false);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("shows the current version and how many agents use the skill", () => {
    renderWithIntl(<SkillCard sk={{ ...SKILL, version: 3 }} />);
    expect(screen.getByText("v3")).toBeInTheDocument();
    expect(screen.getByText("2 agents")).toBeInTheDocument();
  });

  it("Delete opens a confirm modal (confirm / cancel / close) without opening the card", () => {
    const onClick = vi.fn();
    renderWithIntl(<SkillCard sk={SKILL} onClick={onClick} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete skill" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onClick).not.toHaveBeenCalled();
  });

  it("the confirm modal is not dimmed with a disabled card (rendered outside the card)", () => {
    renderWithIntl(<SkillCard sk={{ ...SKILL, enabled: false }} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete skill" }));
    expect(screen.getByRole("dialog").closest('[style*="opacity"]')).toBeNull();
  });
});
