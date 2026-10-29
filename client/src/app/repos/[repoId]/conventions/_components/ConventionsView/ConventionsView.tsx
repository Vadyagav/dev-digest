/* ConventionsView — the Conventions page body. Run Scan does the first
   extraction, ReScan regenerates the still-pending candidates (accepted ones
   are kept, rejected ones never come back). "Create skill" appears once at
   least one candidate is accepted. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, EmptyState, ErrorState, Skeleton } from "@devdigest/ui";
import { AppShell } from "../../../../../../components/app-shell";
import { RepoNotFound } from "../../../../../../components/repo-not-found";
import { useConventions, useExtractConventions, useUpdateConvention } from "../../../../../../lib/hooks/conventions";
import { useActiveRepo, useRepoNotFound } from "../../../../../../lib/repo-context";
import { ApiError } from "../../../../../../lib/api";
import { ConventionCard } from "../ConventionCard";
import { CreateConventionsSkillModal } from "../CreateConventionsSkillModal";
import { s } from "./styles";

export function ConventionsView({ repoId }: { repoId: string }) {
  const t = useTranslations("conventions");
  const { activeRepo } = useActiveRepo();
  const repoNotFound = useRepoNotFound(repoId);
  const { data: candidates, isLoading, isError, refetch } = useConventions(repoId);
  const extract = useExtractConventions(repoId);
  const update = useUpdateConvention(repoId);
  const [creating, setCreating] = React.useState(false);

  const repoName = activeRepo?.id === repoId ? activeRepo.full_name : t("page.repoFallback");
  const crumb = [{ label: t("page.crumbLab") }, { label: t("page.crumbConventions") }];
  const list = candidates ?? [];
  const hasScanned = list.length > 0;
  const acceptedCount = list.filter((c) => c.status === "accepted").length;
  const scan = () => extract.mutate();

  if (repoNotFound) {
    return (
      <AppShell crumb={crumb}>
        <RepoNotFound />
      </AppShell>
    );
  }

  return (
    <AppShell crumb={crumb}>
      {creating && <CreateConventionsSkillModal repoId={repoId} onClose={() => setCreating(false)} />}
      <div style={s.page}>
        <div style={s.header}>
          <div style={s.headerText}>
            <h1 style={s.h1}>
              {t("page.headingPrefix")}
              <span className="mono" style={s.repo}>
                {repoName}
              </span>
            </h1>
            <p style={s.subtitle}>{t("page.subtitle")}</p>
          </div>
          <Button kind="primary" size="sm" icon="Play" onClick={scan} disabled={extract.isPending || hasScanned}>
            {extract.isPending && !hasScanned ? t("page.scanning") : t("page.runScan")}
          </Button>
          <Button kind="secondary" size="sm" icon="RefreshCw" onClick={scan} disabled={extract.isPending || !hasScanned}>
            {extract.isPending && hasScanned ? t("page.scanning") : t("page.rescan")}
          </Button>
        </div>

        {extract.isError && (
          <p style={s.error} role="alert">
            {extract.error instanceof ApiError ? extract.error.message : t("page.extractionFailed")}
          </p>
        )}

        {hasScanned && (
          <div style={s.toolbar}>
            <span style={s.count}>{t("page.candidateCount", { count: list.length })}</span>
            <span style={s.spacer} />
            {acceptedCount > 0 && (
              <Button kind="primary" size="sm" icon="Sparkles" onClick={() => setCreating(true)}>
                {t("page.createSkill", { count: acceptedCount })}
              </Button>
            )}
          </div>
        )}

        {isLoading && (
          <div style={s.skeletons}>
            <Skeleton height={140} />
            <Skeleton height={140} />
          </div>
        )}
        {isError && <ErrorState body={t("page.loadError")} onRetry={() => refetch()} />}
        {!isLoading && !isError && !hasScanned && !extract.isPending && (
          <EmptyState
            icon="ListChecks"
            title={t("page.empty.title")}
            body={t("page.empty.body")}
            cta={t("page.runScan")}
            onCta={scan}
          />
        )}
        {list.map((c) => (
          <ConventionCard
            key={`${c.id}-${c.rule}-${c.category}`}
            c={c}
            pending={update.isPending && update.variables?.id === c.id}
            onUpdate={(patch) => update.mutate({ id: c.id, patch })}
          />
        ))}
      </div>
    </AppShell>
  );
}
