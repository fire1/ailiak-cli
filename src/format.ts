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

export function printTaskList(tasks: TaskSummary[], meta?: { forDate?: string | null; tag?: string | null; scope?: string }): void {
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

  for (const t of tasks) {
    process.stdout.write(`${formatTaskLine(t)}\n`);
  }
  process.stdout.write(`${c(DIM, `${tasks.length} open`)}\n`);
}

export function printTask(task: TaskSummary): void {
  const lines: string[] = [];
  lines.push(`${c(ACCENT, task.kind === 'thread_note' ? 'thread note' : 'task')}  ${c(DIM, task.id)}`);
  if (task.title) lines.push(`${c(BOLD, task.title)}`);
  lines.push(task.text || '(empty)');
  if (task.detail) lines.push('', task.detail);
  lines.push('');
  lines.push(`${c(DIM, 'date')}     ${task.forDate ?? 'unscheduled'}`);
  lines.push(`${c(DIM, 'done')}     ${task.done ? 'yes' : 'no'}`);
  if (task.pinned) lines.push(`${c(DIM, 'pinned')}   yes`);
  if (task.hashtags?.length) lines.push(`${c(DIM, 'tags')}     ${task.hashtags.map((t) => `#${t}`).join(' ')}`);
  if (task.estimateSeconds) lines.push(`${c(DIM, 'estimate')} ${formatDuration(task.estimateSeconds)}`);
  if (task.spentSeconds) lines.push(`${c(DIM, 'spent')}    ${formatDuration(task.spentSeconds)}`);
  if (task.taskNumber) lines.push(`${c(DIM, 'ticket')}   #${task.taskNumber}`);
  if (task.embedUrl) lines.push(`${c(DIM, 'link')}     ${task.embedUrl}`);
  if (task.parentId) {
    lines.push(`${c(DIM, 'parent')}   ${task.parentId}${task.parentText ? ` — ${task.parentText}` : ''}`);
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
