import type { TaskSummary } from './types.js';

export type RemoteTicket = {
  number: string;
  title: string;
  body: string;
  state: string;
  url: string;
  done: boolean;
  kind: 'issue' | 'pull' | 'mr';
};

export function isGithubLink(url: string | null | undefined): boolean {
  const u = String(url || '').trim();
  return /\/(issues|pull)\/\d+/i.test(u);
}

export function isGitlabLink(url: string | null | undefined): boolean {
  const u = String(url || '').trim();
  return /\/-\/(issues|merge_requests)\/\d+/i.test(u);
}

export function closedRemoteKeys(tickets: RemoteTicket[]): {
  urls: Set<string>;
  numbers: Set<string>;
} {
  const urls = new Set<string>();
  const numbers = new Set<string>();
  for (const t of tickets) {
    if (!t.done) continue;
    if (t.url) urls.add(t.url.trim());
    if (t.number) numbers.add(String(t.number).replace(/^#/, '').trim());
  }
  return { urls, numbers };
}

export function notesToMarkDone(
  notes: TaskSummary[],
  closed: { urls: Set<string>; numbers: Set<string> },
  linkTest: (url: string | null | undefined) => boolean,
): TaskSummary[] {
  return notes.filter((n) => {
    if (n.done || n.kind === 'thread_note') return false;
    if (!linkTest(n.embedUrl)) return false;
    const url = String(n.embedUrl || '').trim();
    const num = String(n.taskNumber || '').replace(/^#/, '').trim();
    return (url && closed.urls.has(url)) || (num && closed.numbers.has(num));
  });
}

export function filterNewTickets(
  tickets: RemoteTicket[],
  existing: TaskSummary[],
): { tickets: RemoteTicket[]; skipped: number } {
  const urls = new Set(
    existing.map((n) => String(n.embedUrl || '').trim()).filter(Boolean),
  );
  const numbers = new Set(
    existing
      .map((n) => String(n.taskNumber || '').replace(/^#/, '').trim())
      .filter(Boolean),
  );
  const out: RemoteTicket[] = [];
  let skipped = 0;
  for (const t of tickets) {
    const url = t.url.trim();
    const num = String(t.number).replace(/^#/, '').trim();
    if ((url && urls.has(url)) || (num && numbers.has(num))) {
      skipped += 1;
      continue;
    }
    out.push(t);
  }
  return { tickets: out, skipped };
}

export function ticketToCreateArgs(t: RemoteTicket, forDate?: string): Record<string, unknown> {
  const title = (t.title || '').trim().slice(0, 80);
  const body = (t.body || '').trim().slice(0, 4000);
  const text = (title || body.slice(0, 80) || `#${t.number}`).slice(0, 255);
  const args: Record<string, unknown> = {
    text,
    title: title || undefined,
    detail: body || undefined,
    embedUrl: t.url,
    taskNumber: t.number,
  };
  if (forDate) args.forDate = forDate;
  return args;
}
