import type { CSSProperties } from "react";

/** Co-located styles for SkillFormModal. */
export const s = {
  body: { padding: 24, display: "flex", flexDirection: "column", gap: 4 } satisfies CSSProperties,
  footer: { display: "flex", gap: 10, alignItems: "center" } satisfies CSSProperties,
  spacer: { flex: 1 } satisfies CSSProperties,
  enabledLabel: { display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-secondary)" } satisfies CSSProperties,
  importedBanner: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    marginBottom: 12,
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--bg-surface)",
    fontSize: 13,
    color: "var(--text-secondary)",
  } satisfies CSSProperties,
  bodyBox: { border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" } satisfies CSSProperties,
  preview: { padding: 16, minHeight: 240, maxHeight: 420, overflow: "auto" } satisfies CSSProperties,
  muted: { fontSize: 13, color: "var(--text-muted)" } satisfies CSSProperties,
  evidenceList: { margin: 0, paddingLeft: 18, fontSize: 12.5, fontFamily: "var(--font-mono)" } satisfies CSSProperties,
} as const;
