/* ImportSkillModal — "Add → Import": pick a .md / .zip file, then confirm the
   parsed preview in SkillFormModal (rendered core first, editable, nothing
   saved until Create). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Modal } from "@devdigest/ui";
import type { SkillImportPreview } from "../../../../../../lib/hooks/skills";
import { ImportSkillPicker } from "../../../ImportSkillPicker";
import { SkillFormModal } from "../SkillFormModal";

export function ImportSkillModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated?: (id: string) => void;
}) {
  const t = useTranslations("skills");
  const [preview, setPreview] = React.useState<SkillImportPreview | null>(null);

  if (preview) return <SkillFormModal importPreview={preview} onClose={onClose} onCreated={onCreated} />;

  return (
    <Modal width={600} title={t("import.title")} onClose={onClose}>
      <ImportSkillPicker onImported={setPreview} hideHeading />
    </Modal>
  );
}
