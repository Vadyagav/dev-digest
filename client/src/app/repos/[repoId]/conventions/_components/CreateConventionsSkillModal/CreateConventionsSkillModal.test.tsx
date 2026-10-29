import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "../../../../../../../messages/en/conventions.json";

const mutate = vi.fn();
type Q<T> = { data: T | undefined; isError: boolean; refetch: () => void };
let draft: Q<{ name: string; description: string; body: string; count: number }>;
let agents: Q<{ id: string; name: string }[]>;
vi.mock("../../../../../../lib/hooks/conventions", () => ({
  useConventionsSkillDraft: () => draft,
  useCreateConventionsSkill: () => ({ mutate, isPending: false, isError: false }),
}));
vi.mock("../../../../../../lib/hooks/agents", () => ({ useAgents: () => agents }));
vi.mock("../../../../../../lib/toast", () => ({ useToast: () => ({ success: vi.fn() }) }));

import { CreateConventionsSkillModal } from "./CreateConventionsSkillModal";

afterEach(() => {
  cleanup();
  mutate.mockClear();
});

const DRAFT = { name: "repo-conventions", description: "ALWAYS apply", body: "# Repository conventions", count: 2 };

function renderModal() {
  render(
    <NextIntlClientProvider locale="en" messages={{ conventions: messages }}>
      <CreateConventionsSkillModal repoId="r1" onClose={vi.fn()} />
    </NextIntlClientProvider>,
  );
}

describe("CreateConventionsSkillModal", () => {
  it("explains it builds from conventions and submits the edited draft for the chosen agent", () => {
    draft = { data: DRAFT, isError: false, refetch: vi.fn() };
    agents = { data: [{ id: "a1", name: "General Reviewer" }], isError: false, refetch: vi.fn() };
    renderModal();
    expect(screen.getByRole("note")).toHaveTextContent("2 accepted conventions");
    fireEvent.change(screen.getByDisplayValue("# Repository conventions"), {
      target: { value: "# Edited body" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Create$/ }));
    expect(mutate).toHaveBeenCalledWith(
      { agent_id: "a1", name: "repo-conventions", description: "ALWAYS apply", body: "# Edited body" },
      expect.anything(),
    );
  });

  it("shows an error with retry instead of an endless skeleton when loading fails", () => {
    const refetch = vi.fn();
    draft = { data: undefined, isError: true, refetch };
    agents = { data: [], isError: false, refetch: vi.fn() };
    renderModal();
    expect(screen.getByText("Could not load the skill draft or the agent list.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Retry/ }));
    expect(refetch).toHaveBeenCalled();
  });

  it("explains that an agent is required when there are none", () => {
    draft = { data: DRAFT, isError: false, refetch: vi.fn() };
    agents = { data: [], isError: false, refetch: vi.fn() };
    renderModal();
    expect(screen.getByText("No agents yet")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Create$/ })).not.toBeInTheDocument();
  });
});
