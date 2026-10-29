import type { CSSProperties } from "react";

/** Co-located styles for ConventionsView (layout from the design's ScreenConventions). */
export const s = {
  page: { padding: "20px 28px 40px", maxWidth: 880, margin: "0 auto" } satisfies CSSProperties,
  header: { display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 18 } satisfies CSSProperties,
  headerText: { flex: 1 } satisfies CSSProperties,
  h1: { fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" } satisfies CSSProperties,
  repo: { color: "var(--accent-text)" } satisfies CSSProperties,
  subtitle: { fontSize: 13, color: "var(--text-secondary)", marginTop: 3 } satisfies CSSProperties,
  toolbar: { display: "flex", alignItems: "center", gap: 8, marginBottom: 16 } satisfies CSSProperties,
  count: { fontSize: 13, color: "var(--text-muted)" } satisfies CSSProperties,
  spacer: { flex: 1 } satisfies CSSProperties,
  skeletons: { display: "flex", flexDirection: "column", gap: 12 } satisfies CSSProperties,
  error: { fontSize: 13, color: "var(--crit)", marginBottom: 12 } satisfies CSSProperties,
} as const;
