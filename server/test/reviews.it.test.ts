import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { waitForPrRuns } from './helpers/runs.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import { MockLLMProvider, MockEmbedder, MockGitClient } from '../src/adapters';
import * as t from '../src/db/schema.js';
import { eq } from 'drizzle-orm';
import type { Review, Finding } from '@devdigest/shared';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

const config = () => loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);

/**
 * A unified diff touching src/config.ts (line 11 added) so grounding can keep a
 * finding on line 11 and drop one on line 999 / a non-existent file.
 */
const DIFF = `diff --git a/src/config.ts b/src/config.ts
--- a/src/config.ts
+++ b/src/config.ts
@@ -10,3 +10,4 @@
   port: 3000,
+  stripeKey: "sk_live_xxx",
   redisUrl: x,`;

/** A Review fixture: one valid finding (line 11), one hallucinated (line 999). */
const REVIEW_FIXTURE: Review = {
  verdict: 'request_changes',
  summary: 'Hardcoded Stripe secret introduced.',
  score: 42,
  findings: [
    {
      id: 'f-valid',
      severity: 'CRITICAL',
      category: 'security',
      title: 'Hardcoded Stripe secret key',
      file: 'src/config.ts',
      start_line: 11,
      end_line: 11,
      rationale: 'A live Stripe key is committed in source.',
      suggestion: 'Move the key to an environment variable.',
      confidence: 0.95,
      kind: 'finding',
    },
    {
      id: 'f-halluc',
      severity: 'WARNING',
      category: 'bug',
      title: 'Phantom finding on a line not in the diff',
      file: 'src/config.ts',
      start_line: 999,
      end_line: 999,
      rationale: 'This line does not exist in the diff.',
      confidence: 0.5,
      kind: 'finding',
    },
  ],
};

/** `count` findings of one severity, all grounded on the diff's one real
 *  changed line (11) so none get dropped by grounding. */
function findingsFixture(count: number, severity: Finding['severity'], labelPrefix: string): Review {
  const findings: Finding[] = Array.from({ length: count }, (_, i) => ({
    id: `${labelPrefix}-${i}`,
    severity,
    category: 'bug',
    title: `${labelPrefix} finding ${i}`,
    file: 'src/config.ts',
    start_line: 11,
    end_line: 11,
    rationale: `${labelPrefix} rationale ${i}.`,
    confidence: 0.8,
    kind: 'finding',
  }));
  return { verdict: 'comment', summary: `${labelPrefix} pass.`, score: 90, findings };
}

let repoSeq = 0;
async function setupRepoAndPr(db: PgFixture['handle']['db'], workspaceId: string) {
  const name = `payments-api-${repoSeq++}`;
  const [repo] = await db
    .insert(t.repos)
    .values({ workspaceId, owner: 'acme', name, fullName: `acme/${name}` })
    .returning();
  const [pr] = await db
    .insert(t.pullRequests)
    .values({
      workspaceId,
      repoId: repo!.id,
      number: 482,
      title: 'Add rate limiting',
      author: 'marisa.koch',
      branch: 'feat/rl',
      base: 'main',
      headSha: 'a1b2c3d4',
      additions: 1,
      deletions: 0,
      filesCount: 1,
      status: 'needs_review',
      body: 'Add rate limiting. Closes #471.',
    })
    .returning();
  // persist the patch so the reviewer can reconstruct a diff (MockGit also returns one)
  await db.insert(t.prFiles).values({
    prId: pr!.id,
    path: 'src/config.ts',
    additions: 1,
    deletions: 0,
    patch: '@@ -10,3 +10,4 @@\n   port: 3000,\n+  stripeKey: "sk_live_xxx",\n   redisUrl: x,',
  });
  return { repo: repo!, pr: pr! };
}

d('A2 reviews + agents (Testcontainers pg)', () => {
  let pg: PgFixture;
  let workspaceId: string;

  beforeAll(async () => {
    pg = await startPg();
    await seed(pg.handle.db);
    const [ws] = await pg.handle.db.select().from(t.workspaces);
    workspaceId = ws!.id;
  });
  afterAll(async () => {
    await pg?.stop();
  });

  function appWith(structured: unknown, provider: 'openai' | 'anthropic' = 'openai') {
    return buildApp({
      config: config(),
      db: pg.handle.db,
      overrides: {
        embedder: new MockEmbedder(),
        git: new MockGitClient({ diff: DIFF }),
        llm: {
          [provider]: new MockLLMProvider(provider, { structured }),
        },
      },
    });
  }

  it('agents CRUD', async () => {
    const app = await appWith(REVIEW_FIXTURE);

    const created = await app.inject({
      method: 'POST',
      url: '/agents',
      payload: {
        name: 'Test Reviewer',
        provider: 'openai',
        model: 'gpt-4.1',
        system_prompt: 'You are a reviewer.',
      },
    });
    expect(created.statusCode).toBe(201);
    const agent = created.json();
    expect(agent.version).toBe(1);

    const list = (await app.inject({ method: 'GET', url: '/agents' })).json();
    expect(list.some((a: { id: string }) => a.id === agent.id)).toBe(true);

    // a config change bumps version
    const updated = (
      await app.inject({
        method: 'PUT',
        url: `/agents/${agent.id}`,
        payload: { system_prompt: 'Updated prompt.' },
      })
    ).json();
    expect(updated.version).toBe(2);

    await app.close();
  });

  it('runs a review: map-reduce + grounding drops the hallucinated finding, keeps the valid one', async () => {
    const app = await appWith(REVIEW_FIXTURE);
    const { pr } = await setupRepoAndPr(pg.handle.db, workspaceId);

    const agent = (
      await app.inject({
        method: 'POST',
        url: '/agents',
        payload: { name: 'Sec', provider: 'openai', model: 'gpt-4.1', system_prompt: 'sec' },
      })
    ).json();

    const res = await app.inject({
      method: 'POST',
      url: `/pulls/${pr.id}/review`,
      payload: { agentId: agent.id },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.runs).toHaveLength(1);

    // runReview is fire-and-forget: wait for the background run, then read the
    // persisted reviews (the POST returns runIds, not the reviews themselves).
    await waitForPrRuns(pg.handle.db, pr.id, { expected: 1 });
    const reviews = (
      await app.inject({ method: 'GET', url: `/pulls/${pr.id}/reviews` })
    ).json();
    expect(reviews).toHaveLength(1);

    const review = reviews[0];
    expect(review.verdict).toBe('request_changes');
    // Score is derived from the GROUNDED findings, not the model's self-reported
    // 42: grounding keeps one CRITICAL (line 11) ⇒ 100 − 35 = 65.
    expect(review.score).toBe(65);
    // grounding kept only the valid finding (line 11), dropped the line-999 one
    expect(review.findings).toHaveLength(1);
    expect(review.findings[0].file).toBe('src/config.ts');
    expect(review.findings[0].start_line).toBe(11);

    // a run_traces document was written (single doc)
    const runId = body.runs[0].run_id;
    const trace = (await app.inject({ method: 'GET', url: `/runs/${runId}/trace` })).json();
    expect(trace.config.model).toBe('gpt-4.1');
    expect(trace.stats.grounding).toBe('1/2 passed');
    expect(trace.log.length).toBeGreaterThan(0);
    // MockLLMProvider reports costUsd: 0.001 per call — the run's USD spend
    // should flow through to the persisted trace, not be dropped.
    expect(trace.stats.cost_usd).toBeGreaterThan(0);

    // agent_runs row populated for A5 to aggregate
    const [run] = await pg.handle.db.select().from(t.agentRuns).where(eq(t.agentRuns.id, runId));
    expect(run!.status).toBe('done');
    expect(run!.findingsCount).toBe(1);
    expect(run!.grounding).toBe('1/2 passed');
    expect(run!.costUsd).toBeGreaterThan(0);

    // and the same cost surfaces on the PR list's COST column (one run so far)
    const prList = (
      await app.inject({ method: 'GET', url: `/repos/${pr.repoId}/pulls` })
    ).json();
    const listedPr = prList.find((p: { id: string }) => p.id === pr.id);
    expect(listedPr.cost_usd).toBe(run!.costUsd);
    // the FINDINGS column breakdown: only the surviving grounded CRITICAL
    // finding counts — the dropped hallucinated WARNING never persisted.
    expect(listedPr.findings_by_severity).toEqual({ CRITICAL: 1 });

    await app.close();
  });

  it("PR list's FINDINGS column sums each agent's LATEST run only; COST sums EVERY run", async () => {
    const { pr } = await setupRepoAndPr(pg.handle.db, workspaceId);

    // Test Quality Reviewer runs once: 3 SUGGESTION findings.
    const tqrApp = await appWith(findingsFixture(3, 'SUGGESTION', 'tqr'));
    const tqr = (
      await tqrApp.inject({
        method: 'POST',
        url: '/agents',
        payload: { name: 'Test Quality Reviewer', provider: 'openai', model: 'gpt-4.1', system_prompt: 'tqr' },
      })
    ).json();
    await tqrApp.inject({ method: 'POST', url: `/pulls/${pr.id}/review`, payload: { agentId: tqr.id } });
    await waitForPrRuns(pg.handle.db, pr.id, { expected: 1 });
    await tqrApp.close();

    // General Reviewer runs THREE TIMES in a row (re-reviews) — only its
    // FINAL run's 4 WARNING findings should count, not 1 + 2 + 4.
    const grApp1 = await appWith(findingsFixture(1, 'WARNING', 'gr1'));
    const gr = (
      await grApp1.inject({
        method: 'POST',
        url: '/agents',
        payload: { name: 'General Reviewer', provider: 'openai', model: 'gpt-4.1', system_prompt: 'gr' },
      })
    ).json();
    await grApp1.inject({ method: 'POST', url: `/pulls/${pr.id}/review`, payload: { agentId: gr.id } });
    await waitForPrRuns(pg.handle.db, pr.id, { expected: 2 });
    await grApp1.close();

    const grApp2 = await appWith(findingsFixture(2, 'WARNING', 'gr2'));
    await grApp2.inject({ method: 'POST', url: `/pulls/${pr.id}/review`, payload: { agentId: gr.id } });
    await waitForPrRuns(pg.handle.db, pr.id, { expected: 3 });
    await grApp2.close();

    const grApp3 = await appWith(findingsFixture(4, 'WARNING', 'gr3'));
    await grApp3.inject({ method: 'POST', url: `/pulls/${pr.id}/review`, payload: { agentId: gr.id } });
    await waitForPrRuns(pg.handle.db, pr.id, { expected: 4 });

    const runs = await pg.handle.db.select().from(t.agentRuns).where(eq(t.agentRuns.prId, pr.id));
    expect(runs).toHaveLength(4); // 1 (TQR) + 3 (GR)
    const sumOfAllRunCosts = runs.reduce((sum, r) => sum + (r.costUsd ?? 0), 0);
    const tqrRun = runs.find((r) => r.agentId === tqr.id)!;
    const grLatestRun = runs
      .filter((r) => r.agentId === gr.id)
      .sort((a, b) => b.ranAt!.getTime() - a.ranAt!.getTime())[0]!;
    const perAgentLatestCost = (tqrRun.costUsd ?? 0) + (grLatestRun.costUsd ?? 0);
    // The three General Reviewer runs must each have cost, so summing ALL
    // four runs differs from summing just the two agents' latest runs —
    // otherwise this test can't tell which rule the endpoint actually used.
    expect(sumOfAllRunCosts).not.toBeCloseTo(perAgentLatestCost, 10);

    const prList = (
      await grApp3.inject({ method: 'GET', url: `/repos/${pr.repoId}/pulls` })
    ).json();
    const listedPr = prList.find((p: { id: string }) => p.id === pr.id);
    // COST is money already spent — ALL 4 runs' cost, not deduped per agent.
    expect(listedPr.cost_usd).toBeCloseTo(sumOfAllRunCosts, 10);
    expect(listedPr.cost_usd).not.toBeCloseTo(perAgentLatestCost, 10);
    // FINDINGS reflects current outstanding issues: 3 (TQR's only run) + 4
    // (GR's FINAL run only) = 7 — NOT 3 + (1 + 2 + 4) = 10, which is what
    // summing every GR run individually would give.
    expect(listedPr.findings_by_severity).toEqual({ SUGGESTION: 3, WARNING: 4 });

    await grApp3.close();
  });

  it('dual-provider structured output: anthropic provider returns the same Review shape', async () => {
    const app = await appWith(REVIEW_FIXTURE, 'anthropic');
    const { pr } = await setupRepoAndPr(pg.handle.db, workspaceId);
    const agent = (
      await app.inject({
        method: 'POST',
        url: '/agents',
        payload: { name: 'Claude Rev', provider: 'anthropic', model: 'claude-x', system_prompt: 'rev' },
      })
    ).json();
    await app.inject({ method: 'POST', url: `/pulls/${pr.id}/review`, payload: { agentId: agent.id } });
    await waitForPrRuns(pg.handle.db, pr.id, { expected: 1 });
    const reviews = (
      await app.inject({ method: 'GET', url: `/pulls/${pr.id}/reviews` })
    ).json();
    expect(reviews[0].findings).toHaveLength(1);
    expect(reviews[0].model).toBe('claude-x');
    await app.close();
  });

  it('finding actions: accept, dismiss', async () => {
    const app = await appWith(REVIEW_FIXTURE);
    const { pr } = await setupRepoAndPr(pg.handle.db, workspaceId);
    const agent = (
      await app.inject({
        method: 'POST',
        url: '/agents',
        payload: { name: 'ActAgent', provider: 'openai', model: 'gpt-4.1', system_prompt: 's' },
      })
    ).json();
    await app.inject({ method: 'POST', url: `/pulls/${pr.id}/review`, payload: { agentId: agent.id } });
    await waitForPrRuns(pg.handle.db, pr.id, { expected: 1 });
    const reviews = (
      await app.inject({ method: 'GET', url: `/pulls/${pr.id}/reviews` })
    ).json();
    const findingId = reviews[0].findings[0].id;

    const accepted = (
      await app.inject({ method: 'POST', url: `/findings/${findingId}/accept` })
    ).json();
    expect(accepted.finding.accepted_at).not.toBeNull();

    const dismissed = (
      await app.inject({ method: 'POST', url: `/findings/${findingId}/dismiss` })
    ).json();
    expect(dismissed.finding.dismissed_at).not.toBeNull();
    expect(dismissed.finding.accepted_at).toBeNull();

    await app.close();
  });

  it('SSE: /runs/:id/events streams events and completes', async () => {
    const app = await appWith(REVIEW_FIXTURE);
    const { pr } = await setupRepoAndPr(pg.handle.db, workspaceId);
    const agent = (
      await app.inject({
        method: 'POST',
        url: '/agents',
        payload: { name: 'SseAgent', provider: 'openai', model: 'gpt-4.1', system_prompt: 's' },
      })
    ).json();
    // The run is synchronous; events are buffered on the bus. Subscribing after
    // the run still replays the buffer (replay-first semantics), then completes.
    const body = (
      await app.inject({ method: 'POST', url: `/pulls/${pr.id}/review`, payload: { agentId: agent.id } })
    ).json();
    const runId = body.runs[0].run_id;

    const sse = await app.inject({ method: 'GET', url: `/runs/${runId}/events` });
    expect(sse.statusCode).toBe(200);
    expect(sse.headers['content-type']).toContain('text/event-stream');
    // The replay buffer should contain our log lines as SSE `data:` frames.
    expect(sse.payload).toContain('Starting review');
    expect(sse.payload).toContain('Citation grounding');
    await app.close();
  });

  it('run all enabled agents reviews with each enabled agent', async () => {
    const app = await appWith(REVIEW_FIXTURE);
    const { pr } = await setupRepoAndPr(pg.handle.db, workspaceId);
    const body = (
      await app.inject({ method: 'POST', url: `/pulls/${pr.id}/review`, payload: { all: true } })
    ).json();
    // seed has 2 enabled agents; we may have created more above in this PR's ws.
    expect(body.runs.length).toBeGreaterThanOrEqual(2);
    await app.close();
  });
});
