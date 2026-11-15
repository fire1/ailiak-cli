import { getDeskIndex } from './config.js';
import type { DeskIndex, TaskSummary } from './types.js';

/** Top-level desk tasks only (hide thread notes from the day list). */
export function deskTasksOnly(tasks: TaskSummary[]): TaskSummary[] {
  return tasks.filter((t) => (t.kind || 'task') === 'task');
}

export function noteCountByParent(tasks: TaskSummary[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const t of tasks) {
    if (t.kind !== 'thread_note' || !t.parentId) continue;
    counts.set(t.parentId, (counts.get(t.parentId) || 0) + 1);
  }
  return counts;
}

export function buildDeskIndex(
  tasks: TaskSummary[],
  meta: { forDate: string | null; tag: string | null },
): DeskIndex {
  const entries = deskTasksOnly(tasks).map((t, i) => ({
    n: i + 1,
    id: t.id,
    taskNumber: t.taskNumber || null,
    title: t.title || null,
    text: t.text || '',
  }));
  return {
    forDate: meta.forDate,
    tag: meta.tag,
    updatedAt: new Date().toISOString(),
    entries,
  };
}

function findByTaskNumber(index: DeskIndex | null, num: string): string | null {
  if (!index || !num) return null;
  const needle = num.replace(/^#/, '').trim().toLowerCase();
  if (!needle) return null;
  const hit = index.entries.find(
    (e) => (e.taskNumber || '').replace(/^#/, '').trim().toLowerCase() === needle,
  );
  return hit?.id || null;
}

/**
 * Resolve a short desk ref to a Firestore task id.
 *
 * - `3` — day list number from the last `ailiak desk`
 * - `#12` / `pr-3` — ticket number from that list (or last list)
 * - `c:parent:comment` / long ids — passed through
 */
export async function resolveTaskRef(ref: string): Promise<string> {
  const raw = (ref || '').trim();
  if (!raw) throw new Error('Task ref required.');

  if (raw.startsWith('c:')) return raw;

  const index = await getDeskIndex();

  // Day list number: 1…999
  if (/^\d{1,3}$/.test(raw)) {
    const n = Number(raw);
    const hit = index?.entries.find((e) => e.n === n);
    if (hit) return hit.id;
    throw new Error(
      `No day #${n} in the last desk list. Run \`ailiak desk\` first, then: ailiak desk read ${n}`,
    );
  }

  // Explicit ticket: #12
  if (raw.startsWith('#')) {
    const id = findByTaskNumber(index, raw);
    if (id) return id;
    throw new Error(
      `No ticket ${raw} in the last desk list. Run \`ailiak desk\` first.`,
    );
  }

  // Soft ticket match (pr-3, mr-12) without colliding with firestore ids
  if (/^[a-z]+-\d+$/i.test(raw) || /^\d+$/.test(raw)) {
    const id = findByTaskNumber(index, raw);
    if (id) return id;
  }

  return raw;
}
