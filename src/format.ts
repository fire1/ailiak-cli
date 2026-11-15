import { formatDuration } from './dates.js';
import type { GroupSummary, SkillPayload, TaskSummary, Whoami } from './types.js';

const ACCENT = '\x1b[38;2;22;159;132m'; // #169F84
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

let useColor = process.stdout.isTTY && !process.env.NO_COLOR;

export function setColor(enabled: boolean): void {
  useColor = enabled;
}

function c(code: string, text: string): string {
  return useColor ? `${code}${text}${RESET}` : text;
}

export function printJson(data: unknown): void {
  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
}

export function printError(err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`${c('\x1b[31m', 'error')} ${msg}\n`);
}

function tags(hashtags: string[] | undefined): string {
  if (!hashtags?.length) return '';
  return hashtags.map((t) => c(DIM, `#${t}`)).join(' ');
}

function kindLabel(task: TaskSummary): string {
  if (task.kind === 'thread_note') return c(DIM, 'note');
  if (task.pinned) return c(ACCENT, 'pin');
  return '';
}

function headline(task: TaskSummary): string {
  if (task.title) return task.title;
  return task.text || '(empty)';
}

function subtitle(task: TaskSummary): string {
  if (task.title && task.text) return task.text;
  return '';
}

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const sec = Math.round((Date.now() - t) / 1000);
  if (sec < 60) return 'just now';
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 86400 * 7) return `${Math.floor(sec / 86400)}d ago`;
  return iso.slice(0, 10);
}

/** Collapse runs of blank lines so imported ticket bodies stay scannable. */
function tidyBlock(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** One-line summary (used by printOk / work timer). */
export function formatTaskLine(task: TaskSummary): string {
  const id = c(DIM, task.id);
  const kind = kindLabel(task);
  const title = task.title ? `${c(BOLD, task.title)} — ` : '';
  const text = task.text || '(empty)';
  const date = task.forDate ? c(DIM, task.forDate) : c(DIM, 'unscheduled');
  const tagStr = tags(task.hashtags);
  const timeBits: string[] = [];
  if (task.spentSeconds) timeBits.push(formatDuration(task.spentSeconds));
  if (task.estimateSeconds) timeBits.push(`est ${formatDuration(task.estimateSeconds)}`);
  const time = timeBits.length ? c(DIM, timeBits.join(' / ')) : '';
  const link = task.embedUrl ? c(DIM, '↗') : '';
  const parent =
    task.kind === 'thread_note' && task.parentText
      ? c(DIM, `↳ ${task.parentText.slice(0, 40)}`)
      : '';
  const parts = [id, kind, `${title}${text}`, date, time, tagStr, link, parent].filter(Boolean);
  return parts.join('  ');
}

export function printTaskList(
  tasks: TaskSummary[],
  meta?: {
    forDate?: string | null;
    tag?: string | null;
    scope?: string;
    noteCounts?: Map<string, number>;
  },
): void {
  const headerBits: string[] = [c(ACCENT, 'desk')];
  if (meta?.forDate) headerBits.push(meta.forDate);
  else if (meta?.forDate === null) headerBits.push('all open');
  if (meta?.tag) headerBits.push(`#${meta.tag.replace(/^#/, '')}`);
  if (meta?.scope === 'group') headerBits.push(c(DIM, '(group)'));
  process.stdout.write(`${headerBits.join(' · ')}\n`);

  if (!tasks.length) {
    process.stdout.write(`${c(DIM, 'Nothing open. Nice and quiet.')}\n`);
    return;
  }

  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    const n = i + 1;
    const ticket = t.taskNumber ? c(ACCENT, `#${String(t.taskNumber).replace(/^#/, '')}`) : '';
    const pin = t.pinned ? c(ACCENT, 'pin') : '';
    const head = c(BOLD, headline(t));
    const sub = subtitle(t);

    process.stdout.write('\n');
    process.stdout.write(
      `${c(ACCENT, String(n).padStart(2, ' '))}  ${[ticket, pin, head].filter(Boolean).join('  ')}\n`,
    );
    if (sub) {
      const clipped = sub.length > 100 ? `${sub.slice(0, 97)}…` : sub;
      process.stdout.write(`    ${clipped}\n`);
    }

    const metaBits: string[] = [];
    if (t.estimateSeconds) metaBits.push(`est ${formatDuration(t.estimateSeconds)}`);
    if (t.spentSeconds) metaBits.push(formatDuration(t.spentSeconds));
    const notes = meta?.noteCounts?.get(t.id) || 0;
    if (notes) metaBits.push(`${notes} note${notes === 1 ? '' : 's'}`);
    if (t.hashtags?.length) metaBits.push(tags(t.hashtags));
    if (t.embedUrl) metaBits.push(c(DIM, '↗'));
    if (metaBits.length) {
      process.stdout.write(`    ${c(DIM, metaBits.join(' · '))}\n`);
    }
  }

  process.stdout.write('\n');
  process.stdout.write(
    `${c(DIM, `${tasks.length} open`)}  ·  ${c(DIM, 'ailiak desk read <n>')}\n`,
  );
}

/** Full task view — mirrors the Desk notes sheet (title, detail, notes). */
export function printTask(task: TaskSummary, opts?: { dayNumber?: number }): void {
  const lines: string[] = [];
  const kind = task.kind === 'thread_note' ? 'thread note' : 'task';
  const day = opts?.dayNumber ? `day ${opts.dayNumber}` : '';
  const ticket = task.taskNumber
    ? `#${String(task.taskNumber).replace(/^#/, '')}`
    : '';
  const headBits = [c(ACCENT, kind), day, ticket, c(DIM, task.id)].filter(Boolean);
  lines.push(headBits.join('  '));
  lines.push('');
  lines.push(c(BOLD, headline(task)));
  const sub = subtitle(task);
  if (sub) lines.push(tidyBlock(sub));
  if (task.detail) {
    const detail = tidyBlock(task.detail);
    if (detail) {
      lines.push('');
      lines.push(detail);
    }
  }

  const notes = task.notes || [];
  if (task.kind !== 'thread_note') {
    lines.push('');
    lines.push(c(DIM, '── notes ──'));
    if (!notes.length) {
      lines.push(c(DIM, '  (none yet)'));
    } else {
      for (const n of notes) {
        const when = relativeTime(n.createdAt);
        const prefix = when ? c(DIM, `  · ${when}`) : c(DIM, '  ·');
        lines.push(`${prefix}  ${n.text || '(empty)'}`);
      }
    }
  }

  lines.push('');
  lines.push(`${c(DIM, 'date')}     ${task.forDate ?? 'unscheduled'}`);
  lines.push(`${c(DIM, 'done')}     ${task.done ? 'yes' : 'no'}`);
  if (task.pinned) lines.push(`${c(DIM, 'pinned')}   yes`);
  if (task.hashtags?.length) {
    lines.push(`${c(DIM, 'tags')}     ${task.hashtags.map((t) => `#${t}`).join(' ')}`);
  }
  if (task.estimateSeconds) {
    lines.push(`${c(DIM, 'estimate')} ${formatDuration(task.estimateSeconds)}`);
  }
  if (task.spentSeconds) {
    lines.push(`${c(DIM, 'spent')}    ${formatDuration(task.spentSeconds)}`);
  }
  if (task.embedUrl) lines.push(`${c(DIM, 'link')}     ${task.embedUrl}`);
  if (task.parentId) {
    lines.push(
      `${c(DIM, 'parent')}   ${task.parentId}${task.parentText ? ` — ${task.parentText}` : ''}`,
    );
  }
  if (task.groupId) lines.push(`${c(DIM, 'group')}    ${task.groupId}`);
  process.stdout.write(`${lines.join('\n')}\n`);
}

export function printWhoami(data: Whoami): void {
  const name = data.displayName || 'you';
  const handle = data.handle || '';
  process.stdout.write(`${c(ACCENT, 'ailiak')}  ${c(BOLD, name)}${handle ? `  ${c(DIM, handle)}` : ''}\n`);
  if (data.email) process.stdout.write(`${c(DIM, 'email')}   ${data.email}\n`);
  process.stdout.write(
    `${c(DIM, 'token')}   ${data.token.label} · ${data.token.scope}${data.token.shareable ? ' · shareable' : ''}\n`,
  );
  if (data.group) {
    process.stdout.write(`${c(DIM, 'group')}   ${data.group.tag} (${data.group.groupSlug})\n`);
  }
  if (data.skill.instructions) {
    process.stdout.write(`${c(DIM, 'skill')}   ${data.skill.instructions.slice(0, 120)}\n`);
  }
  if (data.skill.hashtags.length) {
    process.stdout.write(
      `${c(DIM, 'tags')}    ${data.skill.hashtags.map((t) => `#${t}`).join(' ')}\n`,
    );
  }
}

export function printSkill(data: SkillPayload): void {
  process.stdout.write(`${c(ACCENT, 'skill')}  ${data.label} · ${data.scope}\n`);
  if (data.initSkill) {
    process.stdout.write(`\n${c(BOLD, 'Init')}\n${data.initSkill}\n`);
  } else {
    process.stdout.write(`\n${c(DIM, 'No Init skill set yet.')}\n`);
  }
  if (data.hashtagSkills.length) {
    process.stdout.write(`\n${c(BOLD, 'Hashtags')}\n`);
    for (const h of data.hashtagSkills) {
      const desc = h.description ? ` — ${h.description}` : '';
      process.stdout.write(`  #${h.tag}${desc}\n`);
    }
  }
  if (data.tip) process.stdout.write(`\n${c(DIM, data.tip)}\n`);
}

export function printGroups(groups: GroupSummary[]): void {
  process.stdout.write(`${c(ACCENT, 'groups')}\n`);
  if (!groups.length) {
    process.stdout.write(`${c(DIM, 'No groups yet.')}\n`);
    return;
  }
  for (const g of groups) {
    const owner = g.ownerHandle ? `@${g.ownerHandle}` : g.ownerId;
    process.stdout.write(
      `  ${c(BOLD, g.tag)}  ${c(DIM, g.role)}  ${c(DIM, owner)}  ${c(DIM, g.id)}\n`,
    );
  }
}

export function printOk(action: string, task?: TaskSummary): void {
  if (task) {
    process.stdout.write(`${c(ACCENT, action)}  ${formatTaskLine(task)}\n`);
  } else {
    process.stdout.write(`${c(ACCENT, action)}\n`);
  }
}
