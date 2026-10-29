import type { IconName } from "@devdigest/ui";

/** Skill page tab descriptor. `labelKey` resolves under the `skills` namespace. */
export interface SkillTab {
  key: string;
  labelKey: string;
  icon: IconName;
}

export const TABS: readonly SkillTab[] = [
  { key: "config", labelKey: "detail.tabs.config", icon: "Settings" },
  { key: "preview", labelKey: "detail.tabs.preview", icon: "Eye" },
  { key: "versioning", labelKey: "detail.tabs.versioning", icon: "History" },
];

export const DEFAULT_TAB = "config";
