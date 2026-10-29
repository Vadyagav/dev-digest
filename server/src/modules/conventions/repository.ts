import { and, asc, desc, eq, ne } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';
import type { ConventionStatus } from '@devdigest/shared';
import type { ConventionRow } from '../../db/rows.js';
import type { GroundedCandidate } from './helpers.js';

export type { ConventionRow };

/**
 * Conventions data-access. Sole owner of the `conventions` table (candidates
 * extracted per repo). Also reads the repo's clone path — read-only, scoped
 * to the workspace — so the service can sample files from it.
 */

export interface UpdateConvention {
  status?: ConventionStatus;
  category?: string;
  rule?: string;
  evidencePath?: string;
  evidenceLine?: number | null;
}

export class ConventionsRepository {
  constructor(private db: Db) {}

  /** The repo row's clone path (null when not cloned), or undefined when not in this workspace. */
  async getRepoClonePath(workspaceId: string, repoId: string): Promise<string | null | undefined> {
    const [row] = await this.db
      .select({ clonePath: t.repos.clonePath })
      .from(t.repos)
      .where(and(eq(t.repos.workspaceId, workspaceId), eq(t.repos.id, repoId)));
    return row ? row.clonePath : undefined;
  }

  /** Visible candidates for a repo (rejected ones are hidden), highest confidence first. */
  async listVisible(workspaceId: string, repoId: string): Promise<ConventionRow[]> {
    return this.db
      .select()
      .from(t.conventions)
      .where(
        and(
          eq(t.conventions.workspaceId, workspaceId),
          eq(t.conventions.repoId, repoId),
          ne(t.conventions.status, 'rejected'),
        ),
      )
      .orderBy(desc(t.conventions.confidence), asc(t.conventions.createdAt));
  }

  /** Every candidate for a repo, including rejected — used to de-duplicate a re-scan. */
  async listAll(workspaceId: string, repoId: string): Promise<ConventionRow[]> {
    return this.db
      .select()
      .from(t.conventions)
      .where(and(eq(t.conventions.workspaceId, workspaceId), eq(t.conventions.repoId, repoId)));
  }

  async listAccepted(workspaceId: string, repoId: string): Promise<ConventionRow[]> {
    return this.db
      .select()
      .from(t.conventions)
      .where(
        and(
          eq(t.conventions.workspaceId, workspaceId),
          eq(t.conventions.repoId, repoId),
          eq(t.conventions.status, 'accepted'),
        ),
      )
      .orderBy(asc(t.conventions.category), desc(t.conventions.confidence));
  }

  /**
   * Replace a repo's still-pending candidates with a fresh scan's, in one
   * transaction. Accepted and rejected rows are kept: accepted feed the skill,
   * rejected keep the same rule from resurfacing.
   */
  async replacePending(
    workspaceId: string,
    repoId: string,
    candidates: GroundedCandidate[],
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx
        .delete(t.conventions)
        .where(
          and(
            eq(t.conventions.workspaceId, workspaceId),
            eq(t.conventions.repoId, repoId),
            eq(t.conventions.status, 'pending'),
          ),
        );
      if (candidates.length === 0) return;
      await tx.insert(t.conventions).values(
        candidates.map((c) => ({
          workspaceId,
          repoId,
          category: c.category,
          rule: c.rule,
          evidencePath: c.evidencePath,
          evidenceLine: c.evidenceLine,
          evidenceSnippet: c.evidenceSnippet,
          confidence: c.confidence,
          status: 'pending' as const,
        })),
      );
    });
  }

  async update(
    workspaceId: string,
    id: string,
    patch: UpdateConvention,
  ): Promise<ConventionRow | undefined> {
    const [row] = await this.db
      .update(t.conventions)
      .set({
        ...(patch.status !== undefined
          ? { status: patch.status, accepted: patch.status === 'accepted' }
          : {}),
        ...(patch.category !== undefined ? { category: patch.category } : {}),
        ...(patch.rule !== undefined ? { rule: patch.rule } : {}),
        ...(patch.evidencePath !== undefined ? { evidencePath: patch.evidencePath } : {}),
        ...(patch.evidenceLine !== undefined ? { evidenceLine: patch.evidenceLine } : {}),
      })
      .where(and(eq(t.conventions.workspaceId, workspaceId), eq(t.conventions.id, id)))
      .returning();
    return row;
  }
}
