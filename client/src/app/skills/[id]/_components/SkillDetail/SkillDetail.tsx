/* SkillDetail — /skills/:id for a persisted skill: Config (the editor form),
   Preview (rendered Markdown body) and Versioning (history + Diff/Restore)
   tabs. Tab state lives in ?tab=, like the Agent Editor. */
"use client";

import React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Markdown, Tabs } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { SkillEditor } from "../SkillEditor";
import { SkillVersionsTab } from "./_components/SkillVersionsTab";
import { DEFAULT_TAB, TABS } from "./constants";
import { s } from "./styles";

export function SkillDetail({ skill }: { skill: Skill }) {
  const t = useTranslations("skills");
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const requested = search.get("tab");
  const tab = TABS.some((tb) => tb.key === requested) ? requested! : DEFAULT_TAB;
  const setTab = (k: string) => router.replace(`${pathname}?tab=${k}`);
  const tabs = TABS.map((tb) => ({ key: tb.key, label: t(tb.labelKey), icon: tb.icon }));

  return (
    <div>
      <Tabs tabs={tabs} value={tab} onChange={setTab} pad="0 28px" />
      <div style={s.body}>
        {/* `key` remounts on skill switch so local form state starts fresh. */}
        {tab === "config" && <SkillEditor key={skill.id} skill={skill} />}
        {tab === "preview" && (
          <div style={s.preview} data-testid="skill-preview">
            <Markdown>{skill.body}</Markdown>
          </div>
        )}
        {tab === "versioning" && <SkillVersionsTab skill={skill} />}
      </div>
    </div>
  );
}
