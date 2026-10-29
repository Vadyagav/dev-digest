/** Constants for the conventions module. */

/** How many top-ranked source files `repoIntel.getConventionSamples()` feeds the scan. */
export const CONVENTION_SAMPLE_COUNT = 12;

/**
 * Tooling-config files sampled alongside the source files — matched by exact
 * basename (`.eslintrc.json`, `tsconfig.base.json`, …) via `isConfigFile`.
 */
export const CONFIG_FILE_PREFIXES = [
  '.eslintrc',
  'eslint.config.',
  'tsconfig',
  '.prettierrc',
  'prettier.config.',
  '.editorconfig',
] as const;

/** Directories never walked while looking for config files. */
export const CONFIG_SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage', 'clones']);

/** Config files are looked up at the repo root and this many levels below it (monorepo packages). */
export const CONFIG_MAX_DEPTH = 1;

/** Upper bound on config files sent to the model (keeps the prompt bounded). */
export const MAX_CONFIG_FILES = 8;

/** Per-file cap on lines sent to the model; files are line-numbered so evidence can cite a line. */
export const MAX_SAMPLE_LINES = 200;

/** Per-file cap on characters (after line-capping) — guards minified/long-line files. */
export const MAX_SAMPLE_CHARS = 8000;

/** Upper bound on candidates kept from one scan. */
export const MAX_CANDIDATES = 25;

/** Default name of the skill built from approved candidates. */
export const REPO_CONVENTIONS_SKILL_NAME = 'repo-conventions';

export const REPO_CONVENTIONS_SKILL_DESCRIPTION =
  "ALWAYS apply when reviewing code in this repository: house conventions extracted from the repo's own code and approved by the team.";
