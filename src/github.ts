import type { RemoteTicket } from './sync.js';

type GhIssue = {
  number?: number;
  title?: string;
  body?: string | null;
  state?: string;
  html_url?: string;
  pull_request?: unknown;
  merged_at?: string | null;
};

function apiRoot(webBase: string): string {
  try {
    const u = new URL(webBase);
    const host = u.hostname.toLowerCase();
    if (host === 'github.com' || host === 'www.github.com') {
      return 'https://api.github.com';
    }
    return `${u.origin}/api/v3`;
  } catch {
    return 'https://api.github.com';
  }
}

async function ghFetch(
  baseUrl: string,
  token: string,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const root = apiRoot(baseUrl);
  const res = await fetch(`${root}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'ailiak-cli',
      ...(init?.headers || {}),
    },
  });
  return res;
}

async function ghJson<T>(
  baseUrl: string,
  token: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await ghFetch(baseUrl, token, path, init);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`GitHub ${res.status}: ${text.slice(0, 200) || res.statusText}`);
  }
  return text ? (JSON.parse(text) as T) : ({} as T);
}

function mapIssue(issue: GhIssue, kind: 'issue' | 'pull'): RemoteTicket | null {
  const num = Number(issue.number);
  if (!Number.isFinite(num) || num <= 0) return null;
  if (kind === 'issue' && issue.pull_request) return null;
  const closed =
    kind === 'pull'
      ? Boolean(issue.merged_at) || /^closed$/i.test(String(issue.state || ''))
      : /^closed$/i.test(String(issue.state || ''));
  const url = String(issue.html_url || '').trim();
  if (!url.startsWith('https://')) return null;
  return {
    number: kind === 'pull' ? `pr-${num}` : String(num),
    title: String(issue.title || '').trim(),
    body: String(issue.body || '').trim(),
    state: closed && issue.merged_at ? 'merged' : String(issue.state || ''),
    url,
    done: closed,
    kind: kind === 'pull' ? 'pull' : 'issue',
  };
}

export async function githubListTickets(
  opts: { token: string; repo: string; baseUrl: string; state: 'open' | 'closed' | 'all' },
): Promise<RemoteTicket[]> {
  const [owner, repo] = opts.repo.split('/');
  const q = new URLSearchParams({
    state: opts.state,
    per_page: '100',
  });
  const issues = await ghJson<GhIssue[]>(
    opts.baseUrl,
    opts.token,
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues?${q}`,
  );
  const pulls = await ghJson<GhIssue[]>(
    opts.baseUrl,
    opts.token,
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls?${q}`,
  );

  const out: RemoteTicket[] = [];
  for (const issue of issues) {
    const t = mapIssue(issue, 'issue');
    if (t) out.push(t);
  }
  for (const pr of pulls) {
    const t = mapIssue(pr, 'pull');
    if (t) out.push(t);
  }
  return out;
}

export async function githubCreateIssue(
  opts: { token: string; repo: string; baseUrl: string; title: string; body?: string },
): Promise<RemoteTicket> {
  const [owner, repo] = opts.repo.split('/');
  const created = await ghJson<GhIssue>(
    opts.baseUrl,
    opts.token,
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: opts.title.slice(0, 255),
        body: (opts.body || '').slice(0, 65000),
      }),
    },
  );
  const t = mapIssue(created, 'issue');
  if (!t) throw new Error('GitHub created an issue but the response looked empty.');
  return t;
}

export async function githubTest(opts: {
  token: string;
  repo: string;
  baseUrl: string;
}): Promise<{ login: string; repo: string }> {
  const user = await ghJson<{ login?: string }>(opts.baseUrl, opts.token, '/user');
  const [owner, repo] = opts.repo.split('/');
  await ghJson(
    opts.baseUrl,
    opts.token,
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
  );
  return { login: user.login || 'you', repo: opts.repo };
}
