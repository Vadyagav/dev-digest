import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { Skill, SkillVersion } from "@devdigest/shared";
import messages from "../../../../../../../../messages/en/skills.json";
import { diffLines } from "./helpers";

const mutate = vi.fn();
let versions: SkillVersion[] = [];
vi.mock("../../../../../../../lib/hooks/skills", () => ({
  useSkillVersions: () => ({ data: versions, isLoading: false, isError: false, refetch: vi.fn() }),
  useUpdateSkill: () => ({ mutate, isPending: false }),
}));
vi.mock("../../../../../../../lib/toast", () => ({ useToast: () => ({ success: vi.fn() }) }));

import { SkillVersionsTab } from "./SkillVersionsTab";

afterEach(cleanup);

const SKILL: Skill = {
  id: "sk1",
  name: "rubric",
  description: "",
  type: "rubric",
  source: "manual",
  body: "line a\nline B",
  enabled: true,
  version: 2,
};

describe("diffLines", () => {
  it("marks removed and added lines around the common ones", () => {
    expect(diffLines("a\nb\nc", "a\nx\nc")).toEqual([
      { kind: "same", text: "a" },
      { kind: "del", text: "b" },
      { kind: "add", text: "x" },
      { kind: "same", text: "c" },
    ]);
  });
});

describe("SkillVersionsTab", () => {
  it("lists every version; previous ones get Diff (against current) and Restore", () => {
    versions = [
      { skill_id: "sk1", version: 2, body: "line a\nline B", created_at: "2026-10-29T10:00:00Z" },
      { skill_id: "sk1", version: 1, body: "line a\nline b", created_at: "2026-10-28T10:00:00Z" },
    ];
    render(
      <NextIntlClientProvider locale="en" messages={{ skills: messages }}>
        <SkillVersionsTab skill={SKILL} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByTestId("version-2")).toHaveTextContent("current");
    expect(screen.getAllByText("Diff")).toHaveLength(1);

    fireEvent.click(screen.getByText("Diff"));
    expect(screen.getByText("- line b")).toBeInTheDocument();
    expect(screen.getByText("+ line B")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Restore"));
    expect(mutate).toHaveBeenCalledWith({ id: "sk1", patch: { body: "line a\nline b" } }, expect.anything());
  });
});
