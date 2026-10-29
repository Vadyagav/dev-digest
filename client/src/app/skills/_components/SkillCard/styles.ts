import type { CSSProperties } from "react";

/** Co-located styles for SkillCard (mirrors AgentCard/styles.ts). */
export const s = {
  card: (enabled: boolean): CSSProperties => ({
    padding: 14,
    borderRadius: 8,
    cursor: "pointer",
    border: "1px solid var(--border)",
    background: "var(--bg-elevated)",
    opacity: enabled ? 1 : 0.6,
  }),
  headerRow: { display: "flex", alignItems: "center", gap: 10 } satisfies CSSProperties,
  deleteBtn: (pending: boolean): CSSProperties => ({
    background: "none",
    border: "none",
    cursor: pending ? "not-allowed" : "pointer",
    color: "var(--text-muted)",
    display: "inline-flex",
    padding: 4,
  }),
  iconBox: (color: string): CSSProperties => ({
    width: 26,
    height: 26,
    borderRadius: 7,
    background: color + "1a",
    color,
    display: "grid",
    placeItems: "center",
    flexShrink: 0,
  }),
  name: {
    fontSize: 14,
    fontWeight: 600,
    flex: 1,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  } satisfies CSSProperties,
  description: {
    fontSize: 13,
    color: "var(--text-muted)",
    margin: "8px 0",
    lineHeight: 1.4,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  } satisfies CSSProperties,
  metaRow: { display: "flex", alignItems: "center", gap: 8 } satisfies CSSProperties,
  spacer: { flex: 1 } satisfies CSSProperties,
  version: { fontSize: 11.5, color: "var(--text-muted)" } satisfies CSSProperties,
} as const;
