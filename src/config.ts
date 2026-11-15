import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import type { CliConfig, GithubConfig, GitlabConfig, TimerState } from './types.js';

export const DEFAULT_API_URL = 'https://api.ailiak.com';

export function configPath(): string {
  const xdg = process.env.XDG_CONFIG_HOME;
  const base = xdg ? xdg : join(homedir(), '.config');
  return join(base, 'ailiak', 'config.json');
}

export async function loadConfig(): Promise<CliConfig> {
  try {
    const raw = await readFile(configPath(), 'utf8');
    const parsed = JSON.parse(raw) as CliConfig;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return {};
    throw err;
  }
}

function scrubEmpty(obj: Record<string, unknown>): Record<string, unknown> | undefined {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === '') continue;
    out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

export async function saveConfig(patch: CliConfig): Promise<CliConfig> {
  const current = await loadConfig();
  const next: CliConfig = { ...current };

  if ('token' in patch) {
    if (patch.token) next.token = patch.token;
    else delete next.token;
  }
  if ('apiUrl' in patch) {
    if (patch.apiUrl) next.apiUrl = patch.apiUrl;
    else delete next.apiUrl;
  }
  if ('github' in patch) {
    if (!patch.github || Object.keys(patch.github).length === 0) {
      delete next.github;
    } else {
      const merged = scrubEmpty({
        ...(current.github || {}),
        ...patch.github,
      }) as GithubConfig | undefined;
      if (merged) next.github = merged;
      else delete next.github;
    }
  }
  if ('gitlab' in patch) {
    if (!patch.gitlab || Object.keys(patch.gitlab).length === 0) {
      delete next.gitlab;
    } else {
      const merged = scrubEmpty({
        ...(current.gitlab || {}),
        ...patch.gitlab,
      }) as GitlabConfig | undefined;
      if (merged) next.gitlab = merged;
      else delete next.gitlab;
    }
  }
  if ('timer' in patch) {
    if (patch.timer) next.timer = patch.timer;
    else delete next.timer;
  }

  const path = configPath();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
  return next;
}

export async function resolveSettings(): Promise<{ token: string; apiUrl: string }> {
  const cfg = await loadConfig();
  const token = (process.env.AILIAK_TOKEN || cfg.token || '').trim();
  const apiUrl = (
    process.env.AILIAK_API_URL ||
    cfg.apiUrl ||
    DEFAULT_API_URL
  ).replace(/\/+$/, '');

  if (!token) {
    throw new Error(
      'No agent token yet. Create one at https://ailiak.com/studio/agents, then run:\n  ailiak auth set <token>\nor set AILIAK_TOKEN.',
    );
  }
  if (!token.startsWith('ailiak_')) {
    throw new Error('Token should look like ailiak_… (from Studio → Agents).');
  }
  return { token, apiUrl };
}

export async function resolveGithub(): Promise<Required<GithubConfig>> {
  const cfg = await loadConfig();
  const token = (process.env.GITHUB_TOKEN || cfg.github?.token || '').trim();
  const repo = (process.env.AILIAK_GITHUB_REPO || cfg.github?.repo || '').trim();
  const baseUrl = (
    process.env.AILIAK_GITHUB_URL ||
    cfg.github?.baseUrl ||
    'https://github.com'
  ).replace(/\/+$/, '');
  if (!token) {
    throw new Error(
      'No GitHub token. Run:\n  ailiak github config --token ghp_… --repo owner/name\nor set GITHUB_TOKEN.',
    );
  }
  if (!repo || !repo.includes('/')) {
    throw new Error('GitHub repo should look like owner/name. Run: ailiak github config --repo owner/name');
  }
  return { token, repo, baseUrl };
}

export async function resolveGitlab(): Promise<Required<GitlabConfig>> {
  const cfg = await loadConfig();
  const token = (process.env.GITLAB_TOKEN || cfg.gitlab?.token || '').trim();
  const project = (process.env.AILIAK_GITLAB_PROJECT || cfg.gitlab?.project || '').trim();
  const baseUrl = (
    process.env.AILIAK_GITLAB_URL ||
    cfg.gitlab?.baseUrl ||
    'https://gitlab.com'
  ).replace(/\/+$/, '');
  if (!token) {
    throw new Error(
      'No GitLab token. Run:\n  ailiak gitlab config --token glpat-… --project group/name\nor set GITLAB_TOKEN.',
    );
  }
  if (!project) {
    throw new Error('GitLab project path or id required. Run: ailiak gitlab config --project group/name');
  }
  return { token, project, baseUrl };
}

export async function getTimer(): Promise<TimerState | null> {
  const cfg = await loadConfig();
  return cfg.timer || null;
}

export async function setTimer(timer: TimerState | null): Promise<void> {
  await saveConfig({ timer });
}
