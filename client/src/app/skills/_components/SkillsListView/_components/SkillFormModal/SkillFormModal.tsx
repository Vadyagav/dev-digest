/* SkillFormModal — create a skill in a modal: name, description, type and a
   Markdown body with an Edit / Preview toggle. Also the confirm step of the
   import flow: given an `importPreview`, fields are pre-filled, the body opens
   on the rendered Preview (the skill's core, before anything is saved) and the
   record is written with the import's `source` only when Create is clicked. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Button, FormField, Markdown, Modal, SelectInput, Tabs, Textarea, TextInput, Toggle } from "@devdigest/ui";
import type { SkillType } from "@devdigest/shared";
import { useCreateSkill } from "../../../../../../lib/hooks/skills";
import type { SkillImportPreview } from "../../../../../../lib/hooks/skills";
import { useToast } from "../../../../../../lib/toast";
import { SKILL_TYPE_VALUES as TYPE_VALUES } from "../../../../constants";
import { BODY_TABS, MODAL_WIDTH } from "./constants";
import { s } from "./styles";

export function SkillFormModal({
  importPreview,
  onClose,
  onCreated,
}: {
  importPreview?: SkillImportPreview;
  onClose: () => void;
  onCreated?: (id: string) => void;
}) {
  const t = useTranslations("skills");
  const toast = useToast();
  const create = useCreateSkill();

  const [name, setName] = React.useState(importPreview?.name ?? "");
  const [type, setType] = React.useState<SkillType>(importPreview?.type ?? TYPE_VALUES[0]!);
  const [description, setDescription] = React.useState(importPreview?.description ?? "");
  const [body, setBody] = React.useState(importPreview?.body ?? "");
  const [enabled, setEnabled] = React.useState(true);
  const [bodyTab, setBodyTab] = React.useState<string>(importPreview ? "preview" : "edit");

  const typeOptions = TYPE_VALUES.map((v) => ({ value: v, label: t(`editor.typeOptions.${v}`) }));
  const canSave = name.trim().length > 0 && body.trim().length > 0 && !create.isPending;

  const submit = () => {
    create.mutate(
      {
        name: name.trim(),
        description,
        type,
        body,
        enabled,
        source: importPreview?.source ?? "manual",
      },
      {
        onSuccess: (data) => {
          toast.success(t("editor.createdToast"));
          onCreated?.(data.id);
          onClose();
        },
      },
    );
  };

  return (
    <Modal
      width={MODAL_WIDTH}
      title={importPreview ? t("form.importTitle") : t("form.createTitle")}
      subtitle={importPreview ? t("form.importSubtitle") : t("form.createSubtitle")}
      onClose={onClose}
      footer={
        <div style={s.footer}>
          <label style={s.enabledLabel}>
            {t("editor.enabledLabel")}
            <Toggle on={enabled} onChange={setEnabled} size={14} />
          </label>
          <span style={s.spacer} />
          <Button kind="ghost" onClick={onClose}>
            {t("form.cancel")}
          </Button>
          <Button kind="primary" icon="Plus" onClick={submit} disabled={!canSave}>
            {create.isPending ? t("editor.creating") : t("editor.create")}
          </Button>
        </div>
      }
    >
      <div style={s.body}>
        {importPreview && (
          <div style={s.importedBanner} role="status">
            {t("editor.importedNotice")}
            <Badge color="var(--text-secondary)">{t(`listItem.source.${importPreview.source}`)}</Badge>
          </div>
        )}
        <FormField label={t("editor.nameLabel")} required>
          <TextInput value={name} onChange={setName} placeholder={t("file.namePlaceholder")} />
        </FormField>
        <FormField label={t("editor.interfaceLabel")} hint={t("editor.interfaceHint")}>
          <TextInput value={description} onChange={setDescription} />
        </FormField>
        <FormField label={t("editor.typeLabel")}>
          <SelectInput value={type} onChange={(v) => setType(v as SkillType)} options={typeOptions} />
        </FormField>
        <FormField label={t("editor.bodyLabel")} required>
          <div style={s.bodyBox}>
            <Tabs
              pad="0 8px"
              value={bodyTab}
              onChange={setBodyTab}
              tabs={BODY_TABS.map((k) => ({ key: k, label: t(`form.bodyTabs.${k}`) }))}
            />
            {bodyTab === "edit" ? (
              <Textarea value={body} onChange={setBody} rows={14} mono placeholder={t("file.bodyPlaceholder")} />
            ) : (
              <div style={s.preview} data-testid="skill-body-preview">
                {body.trim() ? <Markdown>{body}</Markdown> : <span style={s.muted}>{t("form.emptyBody")}</span>}
              </div>
            )}
          </div>
        </FormField>
        {importPreview && importPreview.evidence_files.length > 0 && (
          <FormField label={t("editor.evidenceFilesLabel")} hint={t("editor.evidenceFilesHint")}>
            <ul style={s.evidenceList}>
              {importPreview.evidence_files.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </FormField>
        )}
      </div>
    </Modal>
  );
}
