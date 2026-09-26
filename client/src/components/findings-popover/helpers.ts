/** Gap between the trigger and the popover, matching the original hardcoded
 *  `calc(100% + 6px)`. */
export const POPOVER_GAP = 6;
export const POPOVER_MAX_HEIGHT = 380;
/** Never shrink the popover below this even when space is tight on both sides. */
export const POPOVER_MIN_HEIGHT = 120;

export type Boundary = { top: number; bottom: number };
export type TriggerRect = { top: number; bottom: number };

/**
 * Decide whether the popover should open above (`openUp`) or below its
 * trigger, and how tall it can be, given the nearest clipping boundary
 * (an overflow-hidden/auto/scroll ancestor, or the viewport). Not a full
 * collision-detection system — no horizontal flip, no scroll-into-view —
 * just enough for a hover-preview popover that must not get clipped.
 */
export function computeFlip(
  trigger: TriggerRect,
  boundary: Boundary,
  naturalHeight: number,
): { openUp: boolean; maxHeight: number } {
  const spaceBelow = boundary.bottom - trigger.bottom - POPOVER_GAP;
  const spaceAbove = trigger.top - boundary.top - POPOVER_GAP;
  const desired = Math.min(naturalHeight, POPOVER_MAX_HEIGHT);

  if (spaceBelow >= desired) {
    return { openUp: false, maxHeight: POPOVER_MAX_HEIGHT };
  }

  const openUp = spaceAbove > spaceBelow;
  const space = openUp ? spaceAbove : spaceBelow;
  return { openUp, maxHeight: Math.max(POPOVER_MIN_HEIGHT, Math.min(POPOVER_MAX_HEIGHT, space)) };
}

/**
 * Walk up from `fromEl`'s parent looking for the first ancestor that would
 * actually clip an overflowing absolutely-positioned child (`overflow`/
 * `overflowY` of `hidden`, `auto`, or `scroll`) — e.g. the PR list's
 * `tableCard`. Falls back to the viewport when no such ancestor exists
 * before `document.body` (e.g. the Agent Runs timeline, which has none).
 */
export function findClipBoundary(fromEl: HTMLElement): Boundary {
  const clips = (v: string) => v === "hidden" || v === "auto" || v === "scroll";
  let el: HTMLElement | null = fromEl.parentElement;
  while (el && el !== document.body && el !== document.documentElement) {
    const cs = getComputedStyle(el);
    if (clips(cs.overflowY) || clips(cs.overflow)) {
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom };
    }
    el = el.parentElement;
  }
  return { top: 0, bottom: window.innerHeight };
}
