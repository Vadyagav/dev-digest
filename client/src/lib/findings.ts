import type { FindingRecord, ReviewRecord, Severity } from "@devdigest/shared";

/** Display/priority order for severity pills — critical first. */
export const SEVERITY_PILL_ORDER: Severity[] = ["CRITICAL", "WARNING", "SUGGESTION"];

/** Format a finding's line range ("11" when single-line, else "11-15"). */
export function lineLabel(f: Pick<FindingRecord, "start_line" | "end_line">): string {
  return f.start_line === f.end_line ? `${f.start_line}` : `${f.start_line}-${f.end_line}`;
}

/** Count findings per severity. Absent severities are omitted, never zeroed in. */
export function countBySeverity(findings: { severity: Severity }[]): Partial<Record<Severity, number>> {
  const counts: Partial<Record<Severity, number>> = {};
  for (const f of findings) counts[f.severity] = (counts[f.severity] ?? 0) + 1;
  return counts;
}

/**
 * For every DISTINCT agent that produced a review, keep only its most
 * recent one — mirrors the server's `PrMeta.findings_by_severity`/`cost_usd`
 * aggregation (see `server/src/modules/pulls/routes.ts`) so a client-side
 * consumer (e.g. the FINDINGS popover) shows exactly the set of findings
 * those counts were summed from. A review with no `agent_id` (legacy/seeded
 * data) is never deduped against another — each counts as its own "agent".
 */
export function latestReviewPerAgent(reviews: ReviewRecord[]): ReviewRecord[] {
  const byAgent = new Map<string, ReviewRecord>();
  for (const review of reviews) {
    const key = review.agent_id ?? review.id;
    const existing = byAgent.get(key);
    if (!existing || new Date(review.created_at).getTime() > new Date(existing.created_at).getTime()) {
      byAgent.set(key, review);
    }
  }
  return [...byAgent.values()];
}
