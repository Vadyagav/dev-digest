import type { CSSProperties } from "react";

/** Co-located styles for SkillDetail. */
export const s = {
  body: { padding: 28 } satisfies CSSProperties,
  preview: {
    maxWidth: 820,
    padding: 24,
    border: "1px solid var(--border)",
    borderRadius: 10,
    background: "var(--bg-elevated)",
  } satisfies CSSProperties,
} as const;
