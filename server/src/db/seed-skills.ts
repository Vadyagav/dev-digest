/**
 * Built-in skills used by the seed, and which built-in agent each is linked to.
 *
 * The agent prompts in ./seed-prompts.ts are deliberately generic; these skills
 * carry the directive, rule-level knowledge. That split is what the HW2 control
 * experiments measure: run the agent with the skill unlinked/disabled → the
 * target issue is not reliably flagged; link/enable it → it is.
 *
 * Bodies are rendered into the agent's SYSTEM message as `## Skill: <name>`
 * blocks, in link order (reviewer-core/src/prompt.ts).
 */

export interface SeedSkill {
  name: string;
  description: string;
  type: 'rubric' | 'convention' | 'security' | 'custom';
  body: string;
}

export const TEST_COVERAGE_BRANCHES_SKILL: SeedSkill = {
  name: 'test-coverage-branches',
  description:
    'ALWAYS flag when a function changed in the PR has a branch or boundary input that the PR\'s tests never exercise — happy-path-only tests are a WARNING.',
  type: 'rubric',
  body: `# Test coverage: branches and boundaries

ALWAYS apply this rule when the diff changes production code AND adds or edits
tests for it.

## Rule
1. For every changed function, list its branches: \`if\`/\`else\`, ternaries,
   early \`return\`, \`throw\`, \`try\`/\`catch\`, \`switch\` cases, \`??\`/\`||\`
   fallbacks, loop-never-runs.
2. List its boundary inputs: empty string/array/object, \`null\`/\`undefined\`,
   \`0\`, negative numbers, the maximum/limit value, exactly-at-limit vs
   one-past (off-by-one), duplicate items.
3. Check which of those the PR's tests actually exercise.
4. If the tests cover ONLY the happy path — any branch or boundary from (1)/(2)
   is never hit — report a **WARNING** finding that:
   - cites the untested branch by file + line in the production code,
   - names the concrete missing edge case (e.g. "quantity = 0", "empty list"),
   - proposes the exact test to add (input → expected output/error).
5. An untested \`throw\`/error path on input validation, money, auth, or data
   deletion is **CRITICAL**.

Do not ask for tests of trivial getters or pure pass-through code.

## Bad (flag it)
\`\`\`ts
// src/cart.ts
export function discount(total: number, pct: number) {
  if (pct < 0 || pct > 100) throw new Error('invalid pct');
  if (total === 0) return 0;
  return total * (1 - pct / 100);
}
// src/cart.test.ts
it('applies a discount', () => {
  expect(discount(100, 10)).toBe(90);
});
\`\`\`
→ WARNING: the \`throw\` for pct < 0 / pct > 100 and the \`total === 0\` early
return are never exercised; add \`discount(100, -1)\` → throws,
\`discount(100, 101)\` → throws, \`discount(0, 10)\` → 0, and the boundaries
\`pct = 0\` / \`pct = 100\`.

## Good (do not flag)
\`\`\`ts
it.each([
  [100, 10, 90],
  [0, 10, 0],
  [100, 0, 100],
  [100, 100, 0],
])('discount(%i, %i) = %i', (t, p, out) => expect(discount(t, p)).toBe(out));
it('rejects out-of-range pct', () => {
  expect(() => discount(100, -1)).toThrow();
  expect(() => discount(100, 101)).toThrow();
});
\`\`\`
`,
};

export const BREAKING_CHANGE_SKILL: SeedSkill = {
  name: 'breaking-change',
  description:
    'ALWAYS flag as CRITICAL when a PR changes an existing route\'s path, method, params, query/body fields, field types, required-ness, or status codes in a way existing clients would break on.',
  type: 'rubric',
  body: `# API breaking changes

ALWAYS check every changed route (\`app.get/post/put/patch/delete\`) and every
changed Zod schema used as a route \`params\`/\`querystring\`/\`body\`/\`response\`.

## These are BREAKING — report as CRITICAL
- Route path or HTTP method changed, or a route removed.
- A path/query/body field renamed or removed.
- An optional request field made required, or a new required field added.
- A field's type changed (\`string\` → \`number\`, scalar → object, enum values
  removed or renamed).
- A success status code changed (\`200\` → \`201\`/\`204\`), or an error code a
  client branches on changed (\`404\` → \`400\`).
- A response field removed, renamed, or its type changed (see response-schema).

The finding must name the old contract, the new contract, and who breaks
("every client sending \`userId\` now gets 422"). Fix = keep the old shape working
(accept both, alias the field) or ship it as a new versioned route — see
semver-discipline and deprecation-policy.

## NOT breaking (do not flag as breaking)
Adding a new route, adding an OPTIONAL request field, adding a new response
field, widening an accepted type.

## Bad
\`\`\`ts
- app.get('/users/:id', { schema: { params: z.object({ id: z.string() }) } }, h);
+ app.get('/users/:userId', { schema: { params: z.object({ userId: z.string().uuid() }) } }, h);
\`\`\`
→ CRITICAL: path param renamed \`id\` → \`userId\` and narrowed to uuid; existing
non-uuid ids now 422.

## Good
\`\`\`ts
+ body: z.object({ name: z.string(), nickname: z.string().optional() })
\`\`\`
Only an optional field was added — backwards compatible.
`,
};

export const RESPONSE_SCHEMA_SKILL: SeedSkill = {
  name: 'response-schema',
  description:
    'ALWAYS flag when a changed route returns a response shape with no declared Zod response schema, or removes/renames a field of an existing response.',
  type: 'convention',
  body: `# Response schemas are part of the contract

ALWAYS apply when the diff adds or changes a route handler's return value.

## Rule
- Every route must declare its success response via
  \`schema: { response: { 200: ResponseSchema } }\` using a Zod schema from the
  shared contracts — not return an ad-hoc object literal.
- Removing or renaming a response field, or changing its type, is a breaking
  change → CRITICAL (see breaking-change).
- Making a previously-always-present field nullable/optional is breaking for
  clients that dereference it → WARNING at least.
- A new route returning an undeclared shape → WARNING.

## Bad
\`\`\`ts
app.get('/skills/:id', async () => {
  const s = await svc.get(id);
- return { id: s.id, name: s.name, version: s.version };
+ return { id: s.id, title: s.name };        // name → title, version dropped
});
\`\`\`
→ CRITICAL: response field \`name\` renamed to \`title\` and \`version\` removed;
no response schema declared, so nothing caught it.

## Good
\`\`\`ts
app.get('/skills/:id', { schema: { params: IdParams, response: { 200: Skill } } }, h);
\`\`\`
`,
};

export const SEMVER_DISCIPLINE_SKILL: SeedSkill = {
  name: 'semver-discipline',
  description:
    'ALWAYS flag when a PR ships a breaking API change without a major version bump or a new versioned route (e.g. /v2/...) and a changelog entry.',
  type: 'rubric',
  body: `# Semver discipline for API changes

ALWAYS apply when breaking-change applies to anything in the diff.

## Rule
- A breaking change is only allowed together with ONE of:
  - a new versioned route (\`/v2/users/:userId\`) while \`/v1/...\` keeps the old
    contract, or
  - a MAJOR version bump of the published API/package (\`1.4.2\` → \`2.0.0\`).
- Additive, backwards-compatible changes are MINOR; fixes are PATCH. Bumping
  MAJOR for an additive change is a SUGGESTION-level nit.
- Every breaking change needs a CHANGELOG / release-note entry describing the
  migration. Missing → WARNING.
- Breaking change in place with no version signal → CRITICAL.

## Bad
\`\`\`diff
- app.post('/orders', { schema: { body: OrderV1 } }, create);
+ app.post('/orders', { schema: { body: OrderV2 } }, create);   // amount: string → number
  "version": "1.6.0" → "1.7.0"
\`\`\`
→ CRITICAL: breaking body change shipped as a MINOR bump in place.

## Good
\`\`\`ts
app.post('/orders', { schema: { body: OrderV1 } }, createV1);      // unchanged
app.post('/v2/orders', { schema: { body: OrderV2 } }, createV2);   // new contract
// CHANGELOG: "Added /v2/orders (amount is a number). /orders deprecated, sunset 2027-01-01."
\`\`\`
`,
};

export const DEPRECATION_POLICY_SKILL: SeedSkill = {
  name: 'deprecation-policy',
  description:
    'ALWAYS flag when a PR removes a route or field outright instead of deprecating it first (keep it working, mark deprecated, Deprecation/Sunset headers, migration window).',
  type: 'convention',
  body: `# Deprecate before you remove

ALWAYS apply when the diff deletes or renames a route, a request field, or a
response field.

## Rule
1. Never remove in one step. First release: keep the old route/field working,
   add the replacement next to it.
2. Mark it deprecated: \`.describe('DEPRECATED: use userId')\` / \`@deprecated\`
   JSDoc on the schema field, and on routes send
   \`Deprecation: true\` and \`Sunset: <HTTP-date>\` response headers
   (RFC 8594), plus a \`Link: <new-url>; rel="successor-version"\` where it
   applies.
3. Give a migration window (at least one minor release / a documented date)
   before the removal PR.
4. Outright removal with no prior deprecation → CRITICAL. Deprecation present
   but no Sunset date or no replacement → WARNING.

## Bad
\`\`\`diff
- app.get('/repos/:id/summary', getSummary);
\`\`\`
→ CRITICAL: route deleted with no deprecation period; clients get 404 overnight.

## Good
\`\`\`ts
app.get('/repos/:id/summary', async (req, reply) => {
  reply.header('Deprecation', 'true');
  reply.header('Sunset', 'Fri, 01 Jan 2027 00:00:00 GMT');
  reply.header('Link', '</repos/' + req.params.id + '/overview>; rel="successor-version"');
  return getSummary(req);
});
\`\`\`
`,
};

/** Skills linked to each seeded agent (by agent name), in prompt order. */
export const SEED_AGENT_SKILLS: Record<string, SeedSkill[]> = {
  'Test Quality Reviewer': [TEST_COVERAGE_BRANCHES_SKILL],
  'API Contract Reviewer': [
    BREAKING_CHANGE_SKILL,
    RESPONSE_SCHEMA_SKILL,
    SEMVER_DISCIPLINE_SKILL,
    DEPRECATION_POLICY_SKILL,
  ],
};
