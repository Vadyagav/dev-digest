/* CreateConventionsSkillModal — "Create skill" from the accepted candidates.
   Explains that the skill is compiled from conventions, pre-fills Name /
   Description / Body from the server draft (all editable), picks the agent
   it gets linked to, then POSTs /repos/:id/conventions/skill. */
"use client";

import React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button, EmptyState, ErrorState, FormField, Modal, SelectInput, Skeleton, Textarea, TextInput } from "@devdigest/ui";
import { useAgents } from "../../../../../../lib/hooks/agents";
import {
  useConventionsSkillDraft,
  useCreateConventionsSkill,
  type ConventionsSkillDraft,
} from "../../../../../../lib/hooks/conventions";
import { useToast } from "../../../../../../lib/toast";
import { ApiError } from "../../../../../../lib/api";
import { s } from "./styles";

export function CreateConventionsSkillModal({ repoId, onClose }: { repoId: string; onClose: () => void }) {
  const t = useTranslations("conventions");
  const draft = useConventionsSkillDraft(repoId, true);
  const agents = useAgents();

  let content: React.ReactNode;
  if (draft.isError || agents.isError) {
    content = (
      <div style={s.body}>
        <ErrorState
          body={t("create.loadError")}
          onRetry={() => {
            if (draft.isError) draft.refetch();
            if (agents.isError) agents.refetch();
          }}
        />
      </div>
    );
  } else if (!draft.data || !agents.data) {
    content = (
      <div style={s.body}>
        <Skeleton height={200} />
      </div>
    );
  } else if (agents.data.length === 0) {
    content = (
      <div style={s.body}>
        <EmptyState icon="Cpu" title={t("create.noAgents.title")} body={t("create.noAgents.body")} />
      </div>
    );
  } else {
    content = <CreateForm repoId={repoId} draft={draft.data} agents={agents.data} onClose={onClose} />;
  }

  return (
    <Modal width={760} title={t("create.title")} subtitle={t("create.subtitle")} onClose={onClose}>
      {content}
    </Modal>
  );
}

function CreateForm({
  repoId,
  draft,
  agents,
  onClose,
}: {
  repoId: string;
  draft: ConventionsSkillDraft;
  agents: { id: string; name: string }[];
  onClose: () => void;
}) {
  const t = useTranslations("conventions");
  const toast = useToast();
  const create = useCreateConventionsSkill(repoId);
  const [name, setName] = React.useState(draft.name);
  const [description, setDescription] = React.useState(draft.description);
  const [body, setBody] = React.useState(draft.body);
  const [agentId, setAgentId] = React.useState(agents[0]?.id ?? "");
  const canCreate = name.trim().length > 0 && body.trim().length > 0 && !!agentId && !create.isPending;

  const submit = () =>
    create.mutate(
      { agent_id: agentId, name: name.trim(), description, body },
      {
        onSuccess: (skill) => {
          toast.success(t("create.createdToast", { name: skill.name, version: skill.version }));
          onClose();
        },
      },
    );

  return (
    <>
      <div style={s.body}>
        <div style={s.explain} role="note">
          {t("create.explain", { count: draft.count })}
        </div>
        <FormField label={t("create.name")} required>
          <TextInput value={name} onChange={setName} mono />
        </FormField>
        <FormField label={t("create.description")}>
          <TextInput value={description} onChange={setDescription} />
        </FormField>
        <FormField label={t("create.agent")} hint={t("create.agentHint")} required>
          <SelectInput
            value={agentId}
            onChange={setAgentId}
            options={agents.map((a) => ({ value: a.id, label: a.name }))}
            mono={false}
          />
        </FormField>
        <FormField label={t("create.body")} hint={t("create.bodyHint")} required>
          <Textarea value={body} onChange={setBody} rows={14} mono />
        </FormField>
        {create.isError && (
          <p style={s.error} role="alert">
            {create.error instanceof ApiError ? create.error.message : t("create.failed")}
          </p>
        )}
      </div>
      <div style={s.footer}>
        <Link href="/skills" style={s.link}>
          {t("create.viewSkills")}
        </Link>
        <span style={s.spacer} />
        <Button kind="ghost" onClick={onClose}>
          {t("create.cancel")}
        </Button>
        <Button kind="primary" icon="Sparkles" onClick={submit} disabled={!canCreate}>
          {create.isPending ? t("create.creating") : t("create.create")}
        </Button>
      </div>
    </>
  );
}
