import { describe, it, expect } from "vitest";
import { computeFlip, findClipBoundary, POPOVER_MAX_HEIGHT, POPOVER_MIN_HEIGHT } from "./helpers";

describe("computeFlip", () => {
  it("stays open-down when there's enough room below", () => {
    const result = computeFlip({ top: 100, bottom: 120 }, { top: 0, bottom: 800 }, 300);
    expect(result).toEqual({ openUp: false, maxHeight: POPOVER_MAX_HEIGHT });
  });

  it("flips up when the boundary sits right at the trigger (the tableCard last-row case)", () => {
    // Trigger is the last row of a card whose bottom edge is a few px below
    // it — almost no room below, plenty of room above.
    const result = computeFlip({ top: 400, bottom: 420 }, { top: 0, bottom: 424 }, 300);
    expect(result.openUp).toBe(true);
    expect(result.maxHeight).toBe(POPOVER_MAX_HEIGHT);
  });

  it("picks the larger side and clamps maxHeight when it doesn't fit either way", () => {
    // 194px above, 4px below — neither fits 300px content, but "up" clearly wins.
    const result = computeFlip({ top: 200, bottom: 210 }, { top: 0, bottom: 220 }, 300);
    expect(result).toEqual({ openUp: true, maxHeight: 194 });
    expect(result.maxHeight).toBeGreaterThan(POPOVER_MIN_HEIGHT);
    expect(result.maxHeight).toBeLessThan(POPOVER_MAX_HEIGHT);
  });

  it("never returns a maxHeight below POPOVER_MIN_HEIGHT even when space is very tight", () => {
    const result = computeFlip({ top: 10, bottom: 12 }, { top: 0, bottom: 20 }, 300);
    expect(result.maxHeight).toBe(POPOVER_MIN_HEIGHT);
  });
});

describe("findClipBoundary", () => {
  it("returns the nearest ancestor with overflow:hidden, not the viewport", () => {
    const clipper = document.createElement("div");
    clipper.style.overflow = "hidden";
    const clipperRect = { top: 10, bottom: 500, left: 0, right: 0, width: 0, height: 490, x: 0, y: 10, toJSON: () => ({}) };
    clipper.getBoundingClientRect = () => clipperRect as DOMRect;

    const trigger = document.createElement("div");
    const popover = document.createElement("div");
    trigger.appendChild(popover);
    clipper.appendChild(trigger);
    document.body.appendChild(clipper);

    expect(findClipBoundary(popover)).toEqual({ top: 10, bottom: 500 });

    document.body.removeChild(clipper);
  });

  it("falls back to the viewport when no clipping ancestor exists", () => {
    const trigger = document.createElement("div");
    const popover = document.createElement("div");
    trigger.appendChild(popover);
    document.body.appendChild(trigger);

    expect(findClipBoundary(popover)).toEqual({ top: 0, bottom: window.innerHeight });

    document.body.removeChild(trigger);
  });
});
