/* ConventionCard — one extracted candidate: rule, category, evidence file +
   snippet, confidence. Accept / Reject persist immediately; Edit turns the
   card itself into a small form (inline, no navigation). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Button, MonoLink, ProgressBar, SelectInput, Textarea } from "@devdigest/ui";
import type { ConventionCandidate, ConventionCategory } from "@devdigest/shared";
import type { UpdateConventionInput } from "../../../../../../lib/hooks/conventions";
import { CATEGORY_VALUES, STRONG_CONFIDENCE } from "../../constants";
import { s } from "./styles";

export function ConventionCard({
  c,
  pending,
  onUpdate,
}: {
  c: ConventionCandidate;
  pending?: boolean;
  onUpdate: (patch: UpdateConventionInput["patch"]) => void;
}) {
  const t = useTranslations("conventions");
  const [editing, setEditing] = React.useState(false);
  const [rule, setRule] = React.useState(c.rule);
  const [category, setCategory] = React.useState<ConventionCategory>(c.category);
  const accepted = c.status === "accepted";
  const pct = Math.round(c.confidence * 100);
  const where = c.evidence_line ? `${c.evidence_path}:${c.evidence_line}` : c.evidence_path;

  const startEdit = () => {
    setRule(c.rule);
    setCategory(c.category);
    setEditing(true);
  };
  const saveEdit = () => {
    onUpdate({ rule: rule.trim(), category });
    setEditing(false);
  };

  return (
    <div style={s.card(accepted)} data-testid={`convention-${c.id}`}>
      <div style={s.main}>
        <div style={s.topRow}>
          <Badge color="var(--accent)">{t(`category.${c.category}`)}</Badge>
          {accepted && (
            <Badge color="var(--ok)" bg="var(--ok-bg)" icon="Check">
              {t("card.accepted")}
            </Badge>
          )}
        </div>
        {editing ? (
          <div style={s.editForm}>
            <Textarea value={rule} onChange={setRule} rows={3} placeholder={t("card.ruleLabel")} />
            <SelectInput
              value={category}
              onChange={(v) => setCategory(v as ConventionCategory)}
              options={CATEGORY_VALUES.map((v) => ({ value: v, label: t(`category.${v}`) }))}
              mono={false}
            />
            <div style={s.editActions}>
              <Button kind="primary" size="sm" icon="Check" onClick={saveEdit} disabled={!rule.trim() || pending}>
                {t("card.save")}
              </Button>
              <Button kind="ghost" size="sm" onClick={() => setEditing(false)}>
                {t("card.cancel")}
              </Button>
            </div>
          </div>
        ) : (
          <div style={s.rule}>{c.rule}</div>
        )}
        <div style={s.evidence}>
          <div style={s.evidenceHead}>
            <MonoLink>{where}</MonoLink>
          </div>
          {c.evidence_snippet && (
            <pre className="mono" style={s.snippet}>
              {c.evidence_snippet}
            </pre>
          )}
        </div>
        <div style={s.confRow}>
          <span style={s.confLabel}>{t("card.confidence")}</span>
          <div style={s.confBar}>
            <ProgressBar
              value={pct}
              height={5}
              color={c.confidence >= STRONG_CONFIDENCE ? "var(--ok)" : "var(--warn)"}
            />
          </div>
          <span className="mono tnum" style={s.confPct}>
            {pct}%
          </span>
        </div>
      </div>
      <div style={s.actions}>
        {accepted ? (
          <Button kind="ghost" size="sm" icon="X" full onClick={() => onUpdate({ status: "pending" })} disabled={pending}>
            {t("card.unaccept")}
          </Button>
        ) : (
          <Button kind="primary" size="sm" icon="Check" full onClick={() => onUpdate({ status: "accepted" })} disabled={pending}>
            {t("card.accept")}
          </Button>
        )}
        <Button kind="ghost" size="sm" icon="Edit" full onClick={startEdit} disabled={editing || pending}>
          {t("card.edit")}
        </Button>
        <Button kind="danger" size="sm" icon="X" full onClick={() => onUpdate({ status: "rejected" })} disabled={pending}>
          {t("card.reject")}
        </Button>
      </div>
    </div>
  );
}
