import type { CSSProperties } from "react";

/** Co-located styles for CreateConventionsSkillModal. */
export const s = {
  body: { padding: 24, display: "flex", flexDirection: "column", gap: 4 } satisfies CSSProperties,
  explain: {
    padding: "10px 12px",
    marginBottom: 12,
    borderRadius: 8,
    border: "1px solid var(--accent)",
    background: "var(--accent-bg)",
    fontSize: 13,
    color: "var(--text-primary)",
    lineHeight: 1.5,
  } satisfies CSSProperties,
  footer: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    borderTop: "1px solid var(--border)",
    padding: "16px 24px",
    background: "var(--bg-surface)",
  } satisfies CSSProperties,
  spacer: { flex: 1 } satisfies CSSProperties,
  link: { fontSize: 13, color: "var(--accent-text)" } satisfies CSSProperties,
  error: { fontSize: 13, color: "var(--crit)" } satisfies CSSProperties,
} as const;
