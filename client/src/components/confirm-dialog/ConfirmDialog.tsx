/* ConfirmDialog — destructive-action confirmation modal (confirm / cancel /
   close X). Shared by the Skills and Agents cards' Delete buttons. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, Modal } from "@devdigest/ui";

const footerStyle: React.CSSProperties = { display: "flex", gap: 10, justifyContent: "flex-end" };
const bodyStyle: React.CSSProperties = { padding: 24, fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.5 };

export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  pending = false,
  onConfirm,
  onClose,
}: {
  title: React.ReactNode;
  body: React.ReactNode;
  confirmLabel: string;
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("common");
  return (
    <Modal
      width={460}
      title={title}
      onClose={onClose}
      footer={
        <div style={footerStyle}>
          <Button kind="ghost" onClick={onClose}>
            {t("actions.cancel")}
          </Button>
          <Button kind="danger" icon="Trash" onClick={onConfirm} disabled={pending}>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <div style={bodyStyle}>{body}</div>
    </Modal>
  );
}
