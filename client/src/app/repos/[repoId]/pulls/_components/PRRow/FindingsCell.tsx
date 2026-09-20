/* FindingsCell — the PR list's FINDINGS column: a compact severity-pill row,
   hover reveals the shared read-only FindingsPopover. Findings are fetched
   lazily on hover (existing GET /pulls/:id/reviews, no new endpoint, no LLM
   call) so the list itself never carries every PR's full finding payload.
   The popover's list is every DISTINCT agent's most recent review's findings
   (see lib/findings.ts's latestReviewPerAgent) — the same set the server
   summed `counts` from, so the popover always adds up to the pills above it,
   even when more than one agent has reviewed this PR. */
"use client";

import React from "react";
import { usePrReviews } from "@/lib/hooks/reviews";
import { SeverityPills } from "@/components/severity-pills";
import { FindingsPopover } from "@/components/findings-popover";
import { latestReviewPerAgent } from "@/lib/findings";

export function FindingsCell({
  prId,
  counts,
}: {
  prId: string | null | undefined;
  counts: Record<string, number> | null | undefined;
}) {
  const [hovered, setHovered] = React.useState(false);
  const { data: reviews } = usePrReviews(prId, { enabled: hovered });

  // Same "latest run per distinct agent, summed across agents" rule the
  // server used for `counts` — so the popover's finding list always adds up
  // to exactly the pill totals shown, even when more than one agent has
  // reviewed this PR.
  const latestFindings = React.useMemo(
    () => latestReviewPerAgent(reviews ?? []).flatMap((r) => r.findings),
    [reviews],
  );

  const total = Object.values(counts ?? {}).reduce((sum, n) => sum + n, 0);
  if (total === 0) {
    return <span style={{ color: "var(--text-muted)" }}>—</span>;
  }

  return (
    <div
      style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={(e) => e.stopPropagation()}
    >
      <SeverityPills counts={counts} compact />
      {hovered && <FindingsPopover findings={latestFindings} />}
    </div>
  );
}

export default FindingsCell;
