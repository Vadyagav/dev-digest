/* SeverityPills — a row of icon(+count) badges, one per severity present.
   Reused wherever a compact per-severity breakdown is shown: the PR list's
   FINDINGS column and the agent-runs Timeline. Pure display — the counts are
   already computed by the caller (server-aggregated or client-reduced). */
"use client";

import React from "react";
import { SeverityBadge } from "@devdigest/ui";
import type { Severity } from "@devdigest/shared";
import { SEVERITY_PILL_ORDER } from "@/lib/findings";

export function SeverityPills({
  counts,
  compact = true,
}: {
  counts: Partial<Record<Severity, number>> | Record<string, number> | null | undefined;
  compact?: boolean;
}) {
  const present = SEVERITY_PILL_ORDER.filter((s) => (counts?.[s] ?? 0) > 0);
  if (present.length === 0) return null;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      {present.map((s) => (
        <SeverityBadge key={s} severity={s} count={counts![s]} compact={compact} />
      ))}
    </span>
  );
}

export default SeverityPills;
