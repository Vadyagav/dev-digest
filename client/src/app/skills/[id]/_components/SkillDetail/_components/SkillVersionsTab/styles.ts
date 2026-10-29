import type { CSSProperties } from "react";
import type { DiffLine } from "./helpers";

/** Co-located styles for SkillVersionsTab. */
export const s = {
  wrap: { maxWidth: 860 } satisfies CSSProperties,
  h2: { fontSize: 18, fontWeight: 700 } satisfies CSSProperties,
  hint: { fontSize: 13, color: "var(--text-secondary)", margin: "4px 0 16px" } satisfies CSSProperties,
  list: { display: "flex", flexDirection: "column", gap: 10 } satisfies CSSProperties,
  row: {
    border: "1px solid var(--border)",
    borderRadius: 9,
    background: "var(--bg-elevated)",
    overflow: "hidden",
  } satisfies CSSProperties,
  rowHead: { display: "flex", alignItems: "center", gap: 10, padding: "10px 14px" } satisfies CSSProperties,
  version: { fontSize: 13, fontWeight: 600 } satisfies CSSProperties,
  date: { fontSize: 12, color: "var(--text-muted)" } satisfies CSSProperties,
  spacer: { flex: 1 } satisfies CSSProperties,
  diff: {
    borderTop: "1px solid var(--border)",
    background: "var(--code-bg)",
    padding: "8px 0",
    maxHeight: 420,
    overflow: "auto",
  } satisfies CSSProperties,
  diffLegend: { fontSize: 11.5, color: "var(--text-muted)", padding: "0 14px 6px" } satisfies CSSProperties,
  diffLine: (kind: DiffLine["kind"]): CSSProperties => ({
    fontSize: 12,
    lineHeight: 1.55,
    padding: "0 14px",
    whiteSpace: "pre-wrap",
    color: kind === "same" ? "var(--text-secondary)" : "var(--text-primary)",
    background: kind === "add" ? "var(--ok-bg)" : kind === "del" ? "var(--crit-bg)" : "transparent",
  }),
} as const;
