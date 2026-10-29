/* /skills — Skills list. One card per skill, click to open a read-only side
   preview; the "Add" dropdown offers Create (form modal) or Import (file →
   preview → confirm, also in a modal). Mirrors AgentsListView's structure. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, Dropdown, EmptyState, ErrorState, Skeleton, Icon } from "@devdigest/ui";
import { AppShell } from "../../../../components/app-shell";
import { useSkills, useUpdateSkill } from "../../../../lib/hooks/skills";
import { SkillCard } from "../SkillCard";
import { SkillPreviewDrawer } from "./_components/SkillPreviewDrawer";
import { SkillFormModal } from "./_components/SkillFormModal";
import { ImportSkillModal } from "./_components/ImportSkillModal";
import { filterSkills } from "../../helpers";
import { s } from "./styles";

export function SkillsListView() {
  const t = useTranslations("skills");
  const { data: skills, isLoading, isError, refetch } = useSkills();
  const update = useUpdateSkill();
  const [search, setSearch] = React.useState("");
  const [selectedSkillId, setSelectedSkillId] = React.useState<string | null>(null);
  const [adding, setAdding] = React.useState<"create" | "import" | null>(null);

  const list = filterSkills(skills ?? [], search);

  return (
    <AppShell crumb={[{ label: t("page.crumbLab") }, { label: t("page.crumbSkills") }]}>
      {adding === "create" && <SkillFormModal onClose={() => setAdding(null)} onCreated={setSelectedSkillId} />}
      {adding === "import" && <ImportSkillModal onClose={() => setAdding(null)} onCreated={setSelectedSkillId} />}
      {selectedSkillId && (
        <SkillPreviewDrawer skillId={selectedSkillId} onClose={() => setSelectedSkillId(null)} />
      )}
      <div style={s.page}>
        <div style={s.header}>
          <div style={s.headerText}>
            <h1 style={s.h1}>{t("page.heading")}</h1>
            <p style={s.subtitle}>{t("page.subtitle")}</p>
          </div>
          <div style={s.search}>
            <Icon.Search size={13} style={s.searchIcon} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("page.searchPlaceholder")}
              style={s.searchInput}
            />
          </div>
          <Dropdown
            width={200}
            align="right"
            trigger={
              <Button kind="primary" size="sm" icon="Plus" iconRight="ChevronDown">
                {t("page.addSkill")}
              </Button>
            }
            items={[
              { label: t("page.createNew"), icon: "Edit", onClick: () => setAdding("create") },
              { divider: true },
              { label: t("page.importSkill"), icon: "Upload", onClick: () => setAdding("import") },
            ]}
          />
        </div>

        {isLoading && (
          <div style={s.grid}>
            <Skeleton height={120} />
            <Skeleton height={120} />
            <Skeleton height={120} />
          </div>
        )}
        {isError && <ErrorState body={t("page.loadError")} onRetry={() => refetch()} />}
        {!isLoading && !isError && list.length === 0 && (
          <EmptyState
            icon="Sparkles"
            title={t("page.empty.title")}
            body={t("page.empty.body")}
            cta={t("page.empty.cta")}
            onCta={() => setAdding("import")}
          />
        )}
        {list.length > 0 && (
          <div style={s.grid}>
            {list.map((sk) => (
              <SkillCard
                key={sk.id}
                sk={sk}
                onClick={() => setSelectedSkillId(sk.id)}
                onToggle={(enabled) => update.mutate({ id: sk.id, patch: { enabled } })}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
