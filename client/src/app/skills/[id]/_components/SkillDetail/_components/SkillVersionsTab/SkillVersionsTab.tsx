/* SkillVersionsTab — every immutable body snapshot of a skill, newest first.
   Each previous version can show a line Diff against the current body and be
   Restored: restore writes that body back through PUT /skills/:id, which (as a
   body change) records it as a NEW version — history is never rewritten. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Button, ErrorState, Skeleton } from "@devdigest/ui";
import type { Skill, SkillVersion } from "@devdigest/shared";
import { useSkillVersions, useUpdateSkill } from "../../../../../../../lib/hooks/skills";
import { useToast } from "../../../../../../../lib/toast";
import { diffLines, formatVersionDate } from "./helpers";
import { s } from "./styles";

export function SkillVersionsTab({ skill }: { skill: Skill }) {
  const t = useTranslations("skills");
  const { data: versions, isLoading, isError, refetch } = useSkillVersions(skill.id);
  const [diffOf, setDiffOf] = React.useState<number | null>(null);

  if (isLoading) return <Skeleton height={200} />;
  if (isError || !versions) return <ErrorState body={t("versions.loadError")} onRetry={() => refetch()} />;

  return (
    <div style={s.wrap}>
      <h2 style={s.h2}>{t("versions.title")}</h2>
      <p style={s.hint}>{t("versions.hint")}</p>
      <div style={s.list}>
        {versions.map((v) => (
          <VersionRow
            key={v.version}
            v={v}
            skill={skill}
            showDiff={diffOf === v.version}
            onDiff={() => setDiffOf(diffOf === v.version ? null : v.version)}
          />
        ))}
      </div>
    </div>
  );
}

function VersionRow({
  v,
  skill,
  showDiff,
  onDiff,
}: {
  v: SkillVersion;
  skill: Skill;
  showDiff: boolean;
  onDiff: () => void;
}) {
  const t = useTranslations("skills");
  const toast = useToast();
  const update = useUpdateSkill();
  const current = v.version === skill.version;

  const restore = () =>
    update.mutate(
      { id: skill.id, patch: { body: v.body } },
      { onSuccess: (data) => toast.success(t("versions.restoredToast", { from: v.version, version: data.version })) },
    );

  return (
    <div style={s.row} data-testid={`version-${v.version}`}>
      <div style={s.rowHead}>
        <span className="mono" style={s.version}>
          {t("preview.version", { version: v.version })}
        </span>
        {current && <Badge color="var(--ok)">{t("versions.current")}</Badge>}
        <span style={s.date}>{formatVersionDate(v.created_at)}</span>
        <span style={s.spacer} />
        {!current && (
          <>
            <Button kind="ghost" size="sm" icon="Code" onClick={onDiff}>
              {showDiff ? t("versions.hideDiff") : t("versions.diff")}
            </Button>
            <Button kind="secondary" size="sm" icon="RefreshCw" onClick={restore} disabled={update.isPending}>
              {update.isPending ? t("versions.restoring") : t("versions.restore")}
            </Button>
          </>
        )}
      </div>
      {showDiff && (
        <div style={s.diff} aria-label={t("versions.diffLabel", { version: v.version })}>
          <div style={s.diffLegend}>{t("versions.diffLegend", { version: v.version, current: skill.version })}</div>
          {diffLines(v.body, skill.body).map((l, i) => (
            <div key={i} className="mono" style={s.diffLine(l.kind)}>
              {l.kind === "add" ? "+ " : l.kind === "del" ? "- " : "  "}
              {l.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
