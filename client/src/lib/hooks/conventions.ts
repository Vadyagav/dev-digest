/* hooks/conventions.ts — React Query hooks for the Conventions page
   (scan a repo → review candidates → compile accepted into a skill). */
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { api } from "../api";
import { ConventionCandidate, Skill } from "@devdigest/shared";
import type { ConventionCategory, ConventionStatus } from "@devdigest/shared";

const conventionsKey = (repoId: string | null | undefined) => ["conventions", repoId] as const;

export function useConventions(repoId: string | null | undefined) {
  return useQuery({
    queryKey: conventionsKey(repoId),
    queryFn: () => api.get(`/repos/${repoId}/conventions`, z.array(ConventionCandidate)),
    enabled: !!repoId,
  });
}

/** Run Scan / ReScan — the server replaces pending candidates and returns the visible list. */
export function useExtractConventions(repoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post(`/repos/${repoId}/conventions/extract`, undefined, z.array(ConventionCandidate)),
    onSuccess: (data) => qc.setQueryData(conventionsKey(repoId), data),
  });
}

export interface UpdateConventionInput {
  id: string;
  patch: {
    status?: ConventionStatus;
    category?: ConventionCategory;
    rule?: string;
    evidence_path?: string;
    evidence_line?: number | null;
  };
}

export function useUpdateConvention(repoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: UpdateConventionInput) =>
      api.patch(`/conventions/${id}`, patch, ConventionCandidate),
    onSuccess: () => qc.invalidateQueries({ queryKey: conventionsKey(repoId) }),
  });
}

export const ConventionsSkillDraft = z.object({
  name: z.string(),
  description: z.string(),
  body: z.string(),
  count: z.number().int(),
});
export type ConventionsSkillDraft = z.infer<typeof ConventionsSkillDraft>;

/** Default name/description/body compiled from the accepted candidates. */
export function useConventionsSkillDraft(repoId: string, enabled: boolean) {
  return useQuery({
    queryKey: [...conventionsKey(repoId), "skill-draft"],
    queryFn: () => api.get(`/repos/${repoId}/conventions/skill-draft`, ConventionsSkillDraft),
    enabled,
  });
}

export interface CreateConventionsSkillInput {
  agent_id: string;
  name: string;
  description: string;
  body: string;
}

export function useCreateConventionsSkill(repoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateConventionsSkillInput) =>
      api.post(`/repos/${repoId}/conventions/skill`, input, Skill),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["skills"] });
      qc.invalidateQueries({ queryKey: ["agents"] });
      qc.invalidateQueries({ queryKey: ["agent-skills"] });
    },
  });
}
