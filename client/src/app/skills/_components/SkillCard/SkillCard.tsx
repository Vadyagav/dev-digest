/* SkillCard — type chip, description, version, agent count, enabled toggle
   and a Delete button (behind a confirm modal). Mirrors AgentCard's
   layout/interaction pattern (click-stopping wrappers around the Toggle and
   the delete button so they don't bubble into the card's own onClick). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon, Badge, Toggle } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { useDeleteSkill } from "../../../../lib/hooks/skills";
import { ConfirmDialog } from "../../../../components/confirm-dialog";
import { skillTypeMeta } from "../../helpers";
import { s } from "./styles";

export function SkillCard({
  sk,
  onClick,
  onToggle,
}: {
  sk: Skill;
  onClick?: () => void;
  onToggle?: (enabled: boolean) => void;
}) {
  const t = useTranslations("skills");
  const del = useDeleteSkill();
  const [confirming, setConfirming] = React.useState(false);
  const meta = skillTypeMeta(sk.type);
  const imported = sk.source !== "manual";
  // The dialog is a sibling of the card, not a child: the card dims a
  // disabled item with `opacity`, which would otherwise apply to the modal.
  return (
    <>
      {confirming && (
        <ConfirmDialog
          title={t("delete.title")}
          body={t("delete.body", { name: sk.name, count: sk.agent_count ?? 0 })}
          confirmLabel={t("delete.confirm")}
          pending={del.isPending}
          onClose={() => setConfirming(false)}
          onConfirm={() => del.mutate(sk.id, { onSuccess: () => setConfirming(false) })}
        />
      )}
      <div onClick={onClick} style={s.card(sk.enabled)}>
        <div style={s.headerRow}>
          <div style={s.iconBox(meta.color)}>
            <Icon.Sparkles size={15} />
          </div>
          <span style={s.name}>{sk.name}</span>
          {onToggle && (
            <div onClick={(e) => e.stopPropagation()}>
              <Toggle on={sk.enabled} onChange={onToggle} size={14} />
            </div>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setConfirming(true);
            }}
            disabled={del.isPending}
            title={t("delete.button")}
            aria-label={t("delete.button")}
            style={s.deleteBtn(del.isPending)}
          >
            <Icon.Trash size={14} />
          </button>
        </div>
        <div style={s.description}>{sk.description}</div>
        <div style={s.metaRow}>
          <Badge color={meta.color} bg={meta.color + "1a"} icon={meta.icon}>
            {t(`listItem.type.${sk.type}`)}
          </Badge>
          {imported && (
            <Badge color="var(--text-secondary)" icon="Upload">
              {t(`listItem.source.${sk.source}`)}
            </Badge>
          )}
          <span style={s.spacer} />
          <span className="mono" style={s.version}>
            {t("preview.version", { version: sk.version })}
          </span>
          <Badge color="var(--text-secondary)" icon="Cpu">
            {t("listItem.agentCount", { count: sk.agent_count ?? 0 })}
          </Badge>
        </div>
      </div>
    </>
  );
}
