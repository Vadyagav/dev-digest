/* /skills/:id — a persisted skill's Config / Preview / Versioning tabs
   (SkillDetail). `id === "new"` is the full-page create route; `?import=1` on
   it shows the import file-picker first and pre-fills the editor from its
   preview once resolved. (The Skills list's Add menu uses modals instead.) */
"use client";

import React from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ErrorState, Skeleton } from "@devdigest/ui";
import { AppShell } from "../../../components/app-shell";
import { SkillEditor } from "./_components/SkillEditor";
import { SkillDetail } from "./_components/SkillDetail";
import { ImportSkillPicker } from "../_components/ImportSkillPicker";
import { useSkill } from "../../../lib/hooks/skills";
import type { SkillImportPreview } from "../../../lib/hooks/skills";
import { ApiError } from "../../../lib/api";

export default function SkillEditorPage() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const t = useTranslations("skills");
  const { id } = params;
  const isNew = id === "new";
  const wantsImport = search.get("import") === "1";

  const [importPreview, setImportPreview] = React.useState<SkillImportPreview | null>(null);

  const { data: skill, isLoading, isError, error, refetch } = useSkill(isNew ? null : id);

  const crumb = [
    { label: t("page.crumbLab") },
    { label: t("page.crumbSkills"), href: "/skills" },
    { label: isNew ? t("detail.newSkill") : (skill?.name ?? t("detail.crumbSkill")) },
  ];

  if (!isNew && (isError || (!isLoading && !skill))) {
    return (
      <AppShell crumb={crumb}>
        <ErrorState
          fullScreen
          title={t("detail.notFound.title")}
          body={error instanceof ApiError ? error.message : t("detail.notFound.body")}
          onRetry={() => refetch()}
        />
      </AppShell>
    );
  }

  // Import param + no preview yet → show the file-picker instead of an empty
  // form; once it resolves, `importPreview` flips the branch below.
  if (isNew && wantsImport && !importPreview) {
    return (
      <AppShell crumb={crumb}>
        <ImportSkillPicker onImported={setImportPreview} />
      </AppShell>
    );
  }

  if (!isNew && isLoading) {
    return (
      <AppShell crumb={crumb}>
        <div style={{ padding: 28, display: "flex", flexDirection: "column", gap: 16 }}>
          <Skeleton height={24} width={240} />
          <Skeleton height={300} />
        </div>
      </AppShell>
    );
  }

  if (!isNew && skill) {
    return (
      <AppShell crumb={crumb}>
        <SkillDetail skill={skill} />
      </AppShell>
    );
  }

  return (
    <AppShell crumb={crumb}>
      <div style={{ padding: 28 }}>
        <SkillEditor key={id} importPreview={importPreview ?? undefined} />
      </div>
    </AppShell>
  );
}
