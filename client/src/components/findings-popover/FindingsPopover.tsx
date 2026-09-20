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

export function FindingsPopover({ findings }: { findings: FindingRecord[] }) {
  const t = useTranslations("prReview");
  if (findings.length === 0) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: "calc(100% + 6px)",
        left: 0,
        width: 320,
        maxHeight: 380,
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
