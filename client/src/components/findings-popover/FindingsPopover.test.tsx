import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { FindingRecord } from "@devdigest/shared";
import messages from "../../../messages/en/prReview.json";
import { FindingsPopover } from "./FindingsPopover";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function finding(id: string, title: string): FindingRecord {
  return {
    id,
    severity: "CRITICAL",
    category: "security",
    title,
    file: "src/config.ts",
    start_line: 12,
    end_line: 12,
    rationale: "r",
    suggestion: null,
    confidence: 0.9,
    kind: "finding",
    trifecta_components: null,
    evidence: null,
    review_id: "r1",
    accepted_at: null,
    dismissed_at: null,
  };
}

function rect(top: number, bottom: number): DOMRect {
  return { top, bottom, left: 0, right: 0, width: 0, height: bottom - top, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
}

/** Mirrors real usage: a `position:relative` trigger div wrapping the popover,
 *  optionally inside a clipping ancestor (like the PR list's `tableCard`). */
function renderPopover(
  findings: FindingRecord[],
  opts: { triggerRect: DOMRect; clipperRect?: DOMRect },
) {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    if (this.dataset.testid === "trigger") return opts.triggerRect;
    if (this.dataset.testid === "clipper") return opts.clipperRect!;
    return rect(0, 0);
  });

  const tree = (
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      <div data-testid="clipper" style={opts.clipperRect ? { overflow: "hidden" } : undefined}>
        <div data-testid="trigger" style={{ position: "relative", display: "inline-flex" }}>
          <FindingsPopover findings={findings} />
        </div>
      </div>
    </NextIntlClientProvider>
  );
  return render(tree);
}

describe("FindingsPopover — flip-to-fit positioning", () => {
  it("opens downward when there's plenty of room (no clipping ancestor, falls back to viewport)", () => {
    renderPopover([finding("f1", "A finding")], { triggerRect: rect(100, 120) });
    expect(screen.getByText("1 FINDINGS IN THIS RUN").closest("[data-placement]")).toHaveAttribute(
      "data-placement",
      "down",
    );
  });

  it("flips upward when the trigger sits right at a clipping ancestor's bottom edge (the tableCard last-row bug)", () => {
    renderPopover([finding("f1", "A finding")], {
      triggerRect: rect(400, 420),
      clipperRect: rect(0, 424),
    });
    expect(screen.getByText("1 FINDINGS IN THIS RUN").closest("[data-placement]")).toHaveAttribute(
      "data-placement",
      "up",
    );
  });

  it("renders the same finding content regardless of placement", () => {
    renderPopover([finding("f1", "Hardcoded Stripe secret key")], {
      triggerRect: rect(400, 420),
      clipperRect: rect(0, 424),
    });
    expect(screen.getByText("Hardcoded Stripe secret key")).toBeInTheDocument();
    expect(screen.getByText("src/config.ts:12")).toBeInTheDocument();
  });
});
