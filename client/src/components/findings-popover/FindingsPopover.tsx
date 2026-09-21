/* FindingsPopover — read-only "N FINDINGS IN THIS RUN" preview: severity,
   title, category, file:line, confidence, short description — no actions.
   Shared by the PR list's FINDINGS column (PRRow/FindingsCell) and the
   agent-runs Timeline (RunHistory), so both surfaces show identical previews. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { SeverityBadge, CategoryTag, ConfidenceNum, type Category } from "@devdigest/ui";
import type { FindingRecord, Severity } from "@devdigest/shared";
import { lineLabel } from "@/lib/findings";
import { computeFlip, findClipBoundary, POPOVER_MAX_HEIGHT } from "./helpers";

export function FindingsPopover({ findings }: { findings: FindingRecord[] }) {
  const t = useTranslations("prReview");
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [flip, setFlip] = React.useState<{ openUp: boolean; maxHeight: number }>({
    openUp: false,
    maxHeight: POPOVER_MAX_HEIGHT,
  });

  // Runs synchronously before paint — no visible flicker between the default
  // (open-down) render used for measurement and the corrected placement.
  React.useLayoutEffect(() => {
    const el = rootRef.current;
    const trigger = el?.parentElement;
    if (!el || !trigger) return;
    const triggerRect = trigger.getBoundingClientRect();
    const boundary = findClipBoundary(el);
    setFlip(computeFlip(triggerRect, boundary, el.scrollHeight));
  }, []);

  if (findings.length === 0) return null; // after hooks — Rules of Hooks

  return (
    <div
      ref={rootRef}
      data-placement={flip.openUp ? "up" : "down"}
      style={{
        position: "absolute",
        top: flip.openUp ? "auto" : "calc(100% + 6px)",
        bottom: flip.openUp ? "calc(100% + 6px)" : "auto",
        left: 0,
        width: 320,
        maxHeight: flip.maxHeight,
        overflowY: "auto",
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-strong)",
        borderRadius: 9,
        boxShadow: "var(--shadow-modal)",
        padding: 12,
        zIndex: 40,
        textAlign: "left",
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
          marginBottom: 10,
        }}
      >
        {t("list.findingsPopoverTitle", { count: findings.length })}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {findings.map((f, i) => (
          <div
            key={f.id}
            style={{
              paddingBottom: 10,
              borderBottom: i === findings.length - 1 ? "none" : "1px solid var(--border)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <SeverityBadge severity={f.severity as Severity} compact />
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{f.title}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
              <CategoryTag category={f.category as Category} />
              <span className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>
                {`${f.file}:${lineLabel(f)}`}
              </span>
              <ConfidenceNum value={f.confidence} />
            </div>
            <div
              style={{
                fontSize: 12,
                color: "var(--text-secondary)",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {f.rationale}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default FindingsPopover;
