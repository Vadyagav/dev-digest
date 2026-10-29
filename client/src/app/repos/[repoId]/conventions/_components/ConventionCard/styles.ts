import type { CSSProperties } from "react";

/** Co-located styles for ConventionCard (layout from the design's ConventionCard). */
export const s = {
  card: (accepted: boolean): CSSProperties => ({
    display: "flex",
    gap: 14,
    border: "1px solid " + (accepted ? "var(--ok)" : "var(--border)"),
    borderRadius: 9,
    background: "var(--bg-elevated)",
    padding: 16,
    marginBottom: 12,
  }),
  main: { flex: 1, minWidth: 0 } satisfies CSSProperties,
  topRow: { display: "flex", gap: 8, marginBottom: 8 } satisfies CSSProperties,
  rule: { fontSize: 14, fontWeight: 600, fontStyle: "italic", lineHeight: 1.4 } satisfies CSSProperties,
  editForm: { display: "flex", flexDirection: "column", gap: 8 } satisfies CSSProperties,
  editActions: { display: "flex", gap: 8 } satisfies CSSProperties,
  evidence: { marginTop: 10, borderRadius: 7, border: "1px solid var(--border)", overflow: "hidden" } satisfies CSSProperties,
  evidenceHead: {
    display: "flex",
    alignItems: "center",
    padding: "5px 10px",
    background: "var(--bg-surface)",
  } satisfies CSSProperties,
  snippet: {
    margin: 0,
    padding: "10px 12px",
    fontSize: 11.5,
    lineHeight: 1.55,
    color: "var(--text-primary)",
    background: "var(--code-bg)",
    borderTop: "1px solid var(--border)",
    overflow: "auto",
    whiteSpace: "pre-wrap",
  } satisfies CSSProperties,
  confRow: { display: "flex", alignItems: "center", gap: 10, marginTop: 10 } satisfies CSSProperties,
  confLabel: { fontSize: 11, color: "var(--text-muted)" } satisfies CSSProperties,
  confBar: { width: 90 } satisfies CSSProperties,
  confPct: { fontSize: 11, color: "var(--text-secondary)" } satisfies CSSProperties,
  actions: { display: "flex", flexDirection: "column", gap: 7, flexShrink: 0, width: 130 } satisfies CSSProperties,
} as const;
