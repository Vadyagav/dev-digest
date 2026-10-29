import type { ConventionCategory } from "@devdigest/shared";

/** Category options for the inline editor, in display order. */
export const CATEGORY_VALUES: readonly ConventionCategory[] = [
  "naming",
  "structure",
  "error-handling",
  "testing",
  "typing",
  "imports",
  "style",
  "other",
];

/** Confidence at/above which the bar is drawn as "strong". */
export const STRONG_CONFIDENCE = 0.85;
