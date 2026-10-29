import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { and, eq } from 'drizzle-orm';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import * as t from '../src/db/schema.js';
import { MockGitClient, MockGitHubClient, MockLLMProvider } from '../src/adapters/mocks.js';
import type { RepoIntel } from '../src/modules/repo-intel/types.js';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

if (!hasDocker) {
  console.warn('[conventions] Docker not available — skipping integration tests.');
}

/**
 * Conventions: extract → persisted candidates → accept/reject/edit →
 * `repo-conventions` skill linked to an agent. The LLM is mocked; sampling
 * reads a real temp "clone" plus a stubbed repoIntel top-files list.
 */
d('conventions module', () => {
  let pg: PgFixture;
  let clone: string;
  let repoId: string;
  let workspaceId: string;
  const llm = new MockLLMProvider('openai', {
    structured: {
      candidates: [
        {
          category: 'naming',
          rule: 'Name service classes with a *Service suffix',
          evidence: { file: 'src/user-service.ts', line: 1 },
          confidence: 0.9,
        },
        {
          category: 'typing',
          rule: 'Enable strict mode in tsconfig',
          evidence: { file: 'tsconfig.json', line: 2 },
          confidence: 0.8,
        },
        {
          category: 'style',
          rule: 'Hallucinated file is dropped',
          evidence: { file: 'src/does-not-exist.ts', line: 1 },
          confidence: 0.99,
        },
      ],
    },
  });
  const sampleCalls: Array<[string, number]> = [];
  const repoIntel = {
    getConventionSamples: async (id: string, n: number) => {
      sampleCalls.push([id, n]);
      return ['src/user-service.ts'];
    },
  } as unknown as RepoIntel;

  beforeAll(async () => {
    pg = await startPg();
    ({ workspaceId } = await seed(pg.handle.db));
    clone = await mkdtemp(join(tmpdir(), 'conv-'));
    await mkdir(join(clone, 'src'));
    await writeFile(join(clone, 'tsconfig.json'), '{\n  "strict": true\n}\n');
    await writeFile(join(clone, 'src/user-service.ts'), 'export class UserService {}\n');
    const [repo] = await pg.handle.db.select().from(t.repos).where(eq(t.repos.workspaceId, workspaceId));
    repoId = repo!.id;
    await pg.handle.db.update(t.repos).set({ clonePath: clone }).where(eq(t.repos.id, repoId));
  });
  afterAll(async () => {
    await pg?.stop();
    if (clone) await rm(clone, { recursive: true, force: true });
  });

  function makeApp() {
    const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    return buildApp({
      config,
      db: pg.handle.db,
      overrides: {
        git: new MockGitClient(),
        github: new MockGitHubClient(),
        llm: { openai: llm, anthropic: llm, openrouter: llm },
        repoIntel,
      },
    });
  }

  it('extract samples configs + top-12 files, persists grounded candidates', async () => {
    const app = await makeApp();
    const res = await app.inject({ method: 'POST', url: `/repos/${repoId}/conventions/extract` });
    expect(res.statusCode).toBe(200);
    const list = res.json();
    expect(list.map((c: { rule: string }) => c.rule).sort()).toEqual([
      'Enable strict mode in tsconfig',
      'Name service classes with a *Service suffix',
    ]);
    expect(sampleCalls[0]).toEqual([repoId, 12]);
    const naming = list.find((c: { category: string }) => c.category === 'naming');
    expect(naming).toMatchObject({
      evidence_path: 'src/user-service.ts',
      evidence_line: 1,
      evidence_snippet: 'export class UserService {}',
      confidence: 0.9,
      status: 'pending',
    });

    // Persisted: a fresh app instance (≈ reload) still returns them.
    const again = await (await makeApp()).inject({ method: 'GET', url: `/repos/${repoId}/conventions` });
    expect(again.json()).toHaveLength(2);
  });

  it('rejected candidates stay hidden and do not come back on re-scan', async () => {
    const app = await makeApp();
    const list = (await app.inject({ method: 'GET', url: `/repos/${repoId}/conventions` })).json();
    const typing = list.find((c: { category: string }) => c.category === 'typing');
    const rej = await app.inject({
      method: 'PATCH',
      url: `/conventions/${typing.id}`,
      payload: { status: 'rejected' },
    });
    expect(rej.statusCode).toBe(200);

    const rescan = (
      await app.inject({ method: 'POST', url: `/repos/${repoId}/conventions/extract` })
    ).json();
    expect(rescan.map((c: { rule: string }) => c.rule)).toEqual([
      'Name service classes with a *Service suffix',
    ]);
  });

  it('accepted + edited candidates compile into a repo-conventions skill linked to the agent', async () => {
    const app = await makeApp();
    const [naming] = (await app.inject({ method: 'GET', url: `/repos/${repoId}/conventions` })).json();
    await app.inject({
      method: 'PATCH',
      url: `/conventions/${naming.id}`,
      payload: { status: 'accepted', rule: 'Suffix service classes with Service' },
    });

    const draft = (
      await app.inject({ method: 'GET', url: `/repos/${repoId}/conventions/skill-draft` })
    ).json();
    expect(draft.name).toBe('repo-conventions');
    expect(draft.body).toContain('Suffix service classes with Service');

    const [agent] = await pg.handle.db.select().from(t.agents).where(eq(t.agents.workspaceId, workspaceId));
    const created = await app.inject({
      method: 'POST',
      url: `/repos/${repoId}/conventions/skill`,
      payload: { agent_id: agent!.id },
    });
    expect(created.statusCode).toBe(201);
    const skill = created.json();
    expect(skill).toMatchObject({ name: 'repo-conventions', type: 'convention', source: 'extracted', agent_count: 1 });

    const links = await pg.handle.db
      .select()
      .from(t.agentSkills)
      .where(and(eq(t.agentSkills.agentId, agent!.id), eq(t.agentSkills.skillId, skill.id)));
    expect(links).toHaveLength(1);
  });

  it('refuses to overwrite a non-extracted skill that has the same name', async () => {
    const app = await makeApp();
    const manual = (
      await app.inject({
        method: 'POST',
        url: '/skills',
        payload: { name: 'team-rubric', type: 'rubric', body: '# keep me', source: 'manual' },
      })
    ).json();
    const [agent] = await pg.handle.db.select().from(t.agents).where(eq(t.agents.workspaceId, workspaceId));
    const res = await app.inject({
      method: 'POST',
      url: `/repos/${repoId}/conventions/skill`,
      payload: { agent_id: agent!.id, name: 'team-rubric' },
    });
    expect(res.statusCode).toBe(422);
    const after = (await app.inject({ method: 'GET', url: `/skills/${manual.id}` })).json();
    expect(after).toMatchObject({ body: '# keep me', version: 1, source: 'manual' });
  });

  it('PATCH with an empty or whitespace-only body is a 422, not a 500', async () => {
    const app = await makeApp();
    const [c] = (await app.inject({ method: 'GET', url: `/repos/${repoId}/conventions` })).json();
    const empty = await app.inject({ method: 'PATCH', url: `/conventions/${c.id}`, payload: {} });
    expect(empty.statusCode).toBe(422);
    const blank = await app.inject({ method: 'PATCH', url: `/conventions/${c.id}`, payload: { rule: '   ' } });
    expect(blank.statusCode).toBe(422);
  });
});
