import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { ConventionCategory, ConventionStatus } from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { NotFoundError } from '../../platform/errors.js';
import { ConventionsService } from './service.js';

/**
 * Conventions module.
 *   GET   /repos/:id/conventions              → visible candidates (rejected hidden)
 *   POST  /repos/:id/conventions/extract      → run / re-run the scan (persists candidates)
 *   PATCH /conventions/:id                    → accept / reject / inline edit
 *   GET   /repos/:id/conventions/skill-draft  → default name/description/body from accepted
 *   POST  /repos/:id/conventions/skill        → compile accepted into `repo-conventions`, link to agent
 */

const UpdateConventionBody = z
  .object({
    status: ConventionStatus.optional(),
    category: ConventionCategory.optional(),
    rule: z.string().trim().min(1).optional(),
    evidence_path: z.string().trim().min(1).optional(),
    evidence_line: z.number().int().positive().nullable().optional(),
  })
  .refine((b) => Object.values(b).some((v) => v !== undefined), {
    message: 'Provide at least one field to update',
  });

const CreateSkillBody = z.object({
  agent_id: z.string().uuid(),
  name: z.string().trim().min(1).optional(),
  description: z.string().optional(),
  body: z.string().optional(),
});

export default async function conventionsRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const service = new ConventionsService(app.container);

  app.get('/repos/:id/conventions', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    return service.list(workspaceId, req.params.id);
  });

  app.post('/repos/:id/conventions/extract', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    return service.extract(workspaceId, req.params.id);
  });

  app.patch(
    '/conventions/:id',
    { schema: { params: IdParams, body: UpdateConventionBody } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      const b = req.body;
      const row = await service.update(workspaceId, req.params.id, {
        ...(b.status !== undefined ? { status: b.status } : {}),
        ...(b.category !== undefined ? { category: b.category } : {}),
        ...(b.rule !== undefined ? { rule: b.rule } : {}),
        ...(b.evidence_path !== undefined ? { evidencePath: b.evidence_path } : {}),
        ...(b.evidence_line !== undefined ? { evidenceLine: b.evidence_line } : {}),
      });
      if (!row) throw new NotFoundError('Convention not found');
      return row;
    },
  );

  app.get('/repos/:id/conventions/skill-draft', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    return service.skillDraft(workspaceId, req.params.id);
  });

  app.post(
    '/repos/:id/conventions/skill',
    { schema: { params: IdParams, body: CreateSkillBody } },
    async (req, reply) => {
      const { workspaceId } = await getContext(app.container, req);
      const b = req.body;
      const skill = await service.createSkill(workspaceId, req.params.id, {
        agentId: b.agent_id,
        ...(b.name !== undefined ? { name: b.name } : {}),
        ...(b.description !== undefined ? { description: b.description } : {}),
        ...(b.body !== undefined ? { body: b.body } : {}),
      });
      reply.status(201);
      return skill;
    },
  );
}
