import type { RemoteTicket } from './sync.js';

type GlIssue = {
  iid?: number;
  title?: string;
  description?: string | null;
  state?: string;
  web_url?: string;
};

type GlMr = GlIssue;

function encodeProject(project: string): string {
  return encodeURIComponent(project);
}

async function glFetch(
  baseUrl: string,
  token: string,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const root = baseUrl.replace(/\/+$/, '');
  const res = await fetch(`${root}/api/v4${path}`, {
    ...init,
    headers: {
      'PRIVATE-TOKEN': token,
      Accept: 'application/json',
      'User-Agent': 'ailiak-cli',
      ...(init?.headers || {}),
    },
  });
  return res;
}

async function glJson<T>(
  baseUrl: string,
  token: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await glFetch(baseUrl, token, path, init);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`GitLab ${res.status}: ${text.slice(0, 200) || res.statusText}`);
  }
  return text ? (JSON.parse(text) as T) : ({} as T);
}

function mapIssue(issue: GlIssue): RemoteTicket | null {
  const iid = Number(issue.iid);
  if (!Number.isFinite(iid) || iid <= 0) return null;
  const state = String(issue.state || '').toLowerCase();
  const closed = state === 'closed';
  const url = String(issue.web_url || '').trim();
  if (!url.startsWith('https://')) return null;
  return {
    number: String(iid),
    title: String(issue.title || '').trim(),
    body: String(issue.description || '').trim(),
    state,
    url,
    done: closed,
    kind: 'issue',
  };
}

function mapMr(mr: GlMr): RemoteTicket | null {
  const iid = Number(mr.iid);
  if (!Number.isFinite(iid) || iid <= 0) return null;
  const state = String(mr.state || '').toLowerCase();
  const closed = state === 'closed' || state === 'merged';
  const url = String(mr.web_url || '').trim();
  if (!url.startsWith('https://')) return null;
  return {
    number: `mr-${iid}`,
    title: String(mr.title || '').trim(),
    body: String(mr.description || '').trim(),
    state,
    url,
    done: closed,
    kind: 'mr',
  };
}

export async function gitlabListTickets(
  opts: {
    token: string;
    project: string;
    baseUrl: string;
    state: 'opened' | 'closed' | 'all';
  },
): Promise<RemoteTicket[]> {
  const q = new URLSearchParams({
    state: opts.state,
    per_page: '100',
  });
  const proj = encodeProject(opts.project);
  const issues = await glJson<GlIssue[]>(
    opts.baseUrl,
    opts.token,
    `/projects/${proj}/issues?${q}`,
  );
  const mrs = await glJson<GlMr[]>(
    opts.baseUrl,
    opts.token,
    `/projects/${proj}/merge_requests?${q}`,
  );
  const out: RemoteTicket[] = [];
  for (const issue of issues) {
    const t = mapIssue(issue);
    if (t) out.push(t);
  }
  for (const mr of mrs) {
    const t = mapMr(mr);
    if (t) out.push(t);
  }
  return out;
}

export async function gitlabCreateIssue(
  opts: {
    token: string;
    project: string;
    baseUrl: string;
    title: string;
    description?: string;
  },
): Promise<RemoteTicket> {
  const created = await glJson<GlIssue>(
    opts.baseUrl,
    opts.token,
    `/projects/${encodeProject(opts.project)}/issues`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: opts.title.slice(0, 255),
        description: (opts.description || '').slice(0, 1000000),
      }),
    },
  );
  const t = mapIssue(created);
  if (!t) throw new Error('GitLab created an issue but the response looked empty.');
  return t;
}

export async function gitlabTest(opts: {
  token: string;
  project: string;
  baseUrl: string;
}): Promise<{ username: string; project: string }> {
  const user = await glJson<{ username?: string }>(opts.baseUrl, opts.token, '/user');
  await glJson(opts.baseUrl, opts.token, `/projects/${encodeProject(opts.project)}`);
  return { username: user.username || 'you', project: opts.project };
}
