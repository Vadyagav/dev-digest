import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ConventionCandidate, Skill, Provider } from '@devdigest/shared';
import type { Container } from '../../platform/container.js';
import { NotFoundError, ValidationError } from '../../platform/errors.js';
import { resolveFeatureModel } from '../settings/feature-models.js';
import { SkillsService } from '../skills/service.js';
import { ConventionsRepository, type UpdateConvention } from './repository.js';
import {
  CONFIG_MAX_DEPTH,
  CONFIG_SKIP_DIRS,
  CONVENTION_SAMPLE_COUNT,
  MAX_CONFIG_FILES,
  REPO_CONVENTIONS_SKILL_DESCRIPTION,
  REPO_CONVENTIONS_SKILL_NAME,
} from './constants.js';
import {
  LlmConventionsOutput,
  buildConventionsMessages,
  buildConventionsSkillBody,
  groundCandidates,
  isConfigFile,
  toConventionDto,
  type SampleFile,
} from './helpers.js';

/**
 * Conventions service. A scan is two steps:
 *   1. sampling — pure code, no model: lint/type/format configs found in the
 *      clone + the top-N files from `repoIntel.getConventionSamples()`;
 *   2. classification — one structured LLM call on the workspace's
 *      "conventions" feature model, grounded against the sampled files.
 * Approved candidates are then compiled into the `repo-conventions` skill.
 */

export interface CreateConventionsSkillInput {
  agentId: string;
  name?: string;
  description?: string;
  body?: string;
}

export class ConventionsService {
  private repo: ConventionsRepository;
  private skills: SkillsService;

  constructor(private container: Container) {
    this.repo = new ConventionsRepository(container.db);
    this.skills = new SkillsService(container);
  }

  async list(workspaceId: string, repoId: string): Promise<ConventionCandidate[]> {
    await this.requireRepo(workspaceId, repoId);
    const rows = await this.repo.listVisible(workspaceId, repoId);
    return rows.map(toConventionDto);
  }

  /** Run (or re-run) a scan; returns the repo's visible candidates afterwards. */
  async extract(workspaceId: string, repoId: string): Promise<ConventionCandidate[]> {
    const clonePath = await this.requireRepo(workspaceId, repoId);
    if (!clonePath) throw new ValidationError('Repository is not cloned yet — import/refresh it first');

    const samples = await this.collectSamples(repoId, clonePath);
    if (samples.length === 0) {
      throw new ValidationError('Nothing to analyze — no config files found and the repo is not indexed');
    }

    const { provider, model } = await resolveFeatureModel(this.container, workspaceId, 'conventions');
    const llm = await this.container.llm(provider as Provider);
    const result = await llm.completeStructured({
      model,
      schema: LlmConventionsOutput,
      schemaName: 'conventions',
      messages: buildConventionsMessages(samples),
      temperature: 0,
      timeoutMs: 180_000,
      maxRetries: 1,
    });

    const known = await this.repo.listAll(workspaceId, repoId);
    const keepRules = known.filter((r) => r.status !== 'pending').map((r) => r.rule);
    const grounded = groundCandidates(result.data.candidates, samples, keepRules);
    await this.repo.replacePending(workspaceId, repoId, grounded);
    return this.list(workspaceId, repoId);
  }

  /** Accept / reject / inline-edit one candidate. */
  async update(
    workspaceId: string,
    id: string,
    patch: UpdateConvention,
  ): Promise<ConventionCandidate | undefined> {
    const row = await this.repo.update(workspaceId, id, patch);
    return row ? toConventionDto(row) : undefined;
  }

  /** Default name/description/body for the skill built from the accepted candidates. */
  async skillDraft(
    workspaceId: string,
    repoId: string,
  ): Promise<{ name: string; description: string; body: string; count: number }> {
    await this.requireRepo(workspaceId, repoId);
    const accepted = (await this.repo.listAccepted(workspaceId, repoId)).map(toConventionDto);
    return {
      name: REPO_CONVENTIONS_SKILL_NAME,
      description: REPO_CONVENTIONS_SKILL_DESCRIPTION,
      body: buildConventionsSkillBody(accepted),
      count: accepted.length,
    };
  }

  /**
   * Compile accepted candidates into one skill (default name `repo-conventions`)
   * and link it to `agentId`. Re-running updates the same-named skill — its
   * body change bumps the skill version — instead of creating a duplicate.
   */
  async createSkill(
    workspaceId: string,
    repoId: string,
    input: CreateConventionsSkillInput,
  ): Promise<Skill> {
    const draft = await this.skillDraft(workspaceId, repoId);
    if (draft.count === 0) throw new ValidationError('Accept at least one convention first');
    const agent = await this.container.agentsRepo.getById(workspaceId, input.agentId);
    if (!agent) throw new NotFoundError('Agent not found');

    const name = input.name?.trim() || draft.name;
    const description = input.description ?? draft.description;
    const body = input.body?.trim() ? input.body : draft.body;

    // Only a skill this flow created earlier (source 'extracted') may be
    // updated in place. Re-using another skill's name would overwrite a
    // trusted skill with LLM output derived from repo content.
    const existing = (await this.skills.list(workspaceId)).find((s) => s.name === name);
    if (existing && existing.source !== 'extracted') {
      throw new ValidationError(`A skill named "${name}" already exists — pick another name`);
    }
    const skill = existing
      ? await this.skills.update(workspaceId, existing.id, { description, body, type: 'convention' })
      : await this.skills.create(workspaceId, {
          name,
          description,
          type: 'convention',
          body,
          source: 'extracted',
        });
    if (!skill) throw new NotFoundError('Skill not found');

    const links = await this.container.agentsRepo.linkedSkills(agent.id);
    if (!links.some((l) => l.skill.id === skill.id)) {
      await this.container.agentsRepo.linkSkill(agent.id, skill.id, links.length);
    }
    return (await this.skills.get(workspaceId, skill.id)) ?? skill;
  }

  /** Clone path of a workspace repo; throws NotFound when the repo isn't in this workspace. */
  private async requireRepo(workspaceId: string, repoId: string): Promise<string | null> {
    const clonePath = await this.repo.getRepoClonePath(workspaceId, repoId);
    if (clonePath === undefined) throw new NotFoundError('Repo not found');
    return clonePath;
  }

  /** Step 1 — deterministic sampling, no LLM: config files + top-ranked source files. */
  private async collectSamples(repoId: string, clonePath: string): Promise<SampleFile[]> {
    const configPaths = (await findConfigFiles(clonePath)).slice(0, MAX_CONFIG_FILES);
    const sourcePaths = await this.container.repoIntel.getConventionSamples(repoId, CONVENTION_SAMPLE_COUNT);

    const read = async (path: string, kind: SampleFile['kind']): Promise<SampleFile | null> => {
      const content = await readFile(join(clonePath, path), 'utf8').catch(() => null);
      return content === null ? null : { path, kind, content };
    };
    const files = await Promise.all([
      ...configPaths.map((p) => read(p, 'config')),
      ...sourcePaths.map((p) => read(p, 'source')),
    ]);
    return files.filter((f): f is SampleFile => f !== null);
  }
}

/** Repo-relative paths of config files at the clone root and up to CONFIG_MAX_DEPTH levels below. */
async function findConfigFiles(root: string, rel = '', depth = 0): Promise<string[]> {
  const entries = await readdir(join(root, rel), { withFileTypes: true }).catch(() => []);
  const out: string[] = [];
  for (const e of entries) {
    const path = rel ? `${rel}/${e.name}` : e.name;
    if (e.isFile() && isConfigFile(e.name)) out.push(path);
    else if (e.isDirectory() && depth < CONFIG_MAX_DEPTH && !CONFIG_SKIP_DIRS.has(e.name)) {
      out.push(...(await findConfigFiles(root, path, depth + 1)));
    }
  }
  return out.sort();
}

