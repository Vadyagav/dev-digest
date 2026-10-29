import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "../../../../../../../messages/en/skills.json";

const mutate = vi.fn();
vi.mock("../../../../../../lib/hooks/skills", () => ({
  useCreateSkill: () => ({ mutate, isPending: false }),
}));
vi.mock("../../../../../../lib/toast", () => ({ useToast: () => ({ success: vi.fn() }) }));

import { SkillFormModal } from "./SkillFormModal";

afterEach(() => {
  cleanup();
  mutate.mockClear();
});

function renderModal(props: Partial<React.ComponentProps<typeof SkillFormModal>> = {}) {
  render(
    <NextIntlClientProvider locale="en" messages={{ skills: messages }}>
      <SkillFormModal onClose={vi.fn()} {...props} />
    </NextIntlClientProvider>,
  );
}

describe("SkillFormModal", () => {
  it("create: name, description, type and a Markdown body, submitted as a manual skill", () => {
    renderModal();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Create skill", { selector: "div" })).toBeInTheDocument();
    const [name, description] = screen.getAllByRole("textbox");
    fireEvent.change(name!, { target: { value: "no-console" } });
    fireEvent.change(description!, { target: { value: "ALWAYS flag console.log" } });
    fireEvent.change(screen.getByPlaceholderText(/# Rule/), { target: { value: "# No console\nFlag it." } });
    fireEvent.click(screen.getByText("Preview"));
    expect(screen.getByTestId("skill-body-preview")).toHaveTextContent("No console");
    fireEvent.click(screen.getByRole("button", { name: /Create skill/ }));
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ name: "no-console", type: "rubric", body: "# No console\nFlag it.", source: "manual" }),
      expect.anything(),
    );
  });

  it("import: opens on the rendered preview of the parsed core and keeps the import source", () => {
    renderModal({
      importPreview: {
        name: "edge-cases",
        description: "d",
        type: "custom",
        body: "# Edge cases\n- empty input",
        source: "imported_url",
        evidence_files: [],
      },
    });
    expect(screen.getByTestId("skill-body-preview")).toHaveTextContent("Edge cases");
    fireEvent.click(screen.getByRole("button", { name: /Create skill/ }));
    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ source: "imported_url" }), expect.anything());
  });
});
