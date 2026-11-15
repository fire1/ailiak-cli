/** Local calendar day as YYYY-MM-DD. */
export function todayLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function tomorrowLocal(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Parse a day argument: today | tomorrow | YYYY-MM-DD | none | null
 * Returns null for unscheduled / clear.
 */
export function parseDay(raw: string | undefined | null): string | null | undefined {
  if (raw === undefined) return undefined;
  const v = String(raw).trim().toLowerCase();
  if (v === '' || v === 'none' || v === 'null' || v === '-' || v === 'clear') {
    return null;
  }
  if (v === 'today') return todayLocal();
  if (v === 'tomorrow' || v === 'todo') return tomorrowLocal();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  throw new Error(`Date should be YYYY-MM-DD, today, tomorrow, or none — got “${raw}”`);
}

export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  if (m && s && seconds < 3600) return `${m}m ${s}s`;
  if (m) return `${m}m`;
  return `${s}s`;
}

/** Mirror web compose `/spent` / `/estimate` duration parsing. */
export function parseDurationToSeconds(raw: string): number {
  const s = (raw || '').trim().toLowerCase();
  if (!s) return 0;

  const colon = /^(\d+):(\d{1,2})(?::(\d{1,2}))?$/.exec(s);
  if (colon) {
    const a = Number(colon[1]);
    const b = Number(colon[2]);
    const c = colon[3] != null ? Number(colon[3]) : null;
    if (c != null) return Math.max(0, a * 3600 + b * 60 + c);
    return Math.max(0, a * 3600 + b * 60);
  }

  if (/^\d+(\.\d+)?$/.test(s)) {
    return Math.max(0, Math.round(parseFloat(s) * 60));
  }

  let total = 0;
  let matched = false;
  const unitRe =
    /(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours|m|min|mins|minute|minutes|s|sec|secs|second|seconds)\b/g;
  let m: RegExpExecArray | null;
  while ((m = unitRe.exec(s)) !== null) {
    matched = true;
    const n = parseFloat(m[1]);
    const u = m[2];
    if (u.startsWith('h')) total += n * 3600;
    else if (u.startsWith('m')) total += n * 60;
    else total += n;
  }
  return matched ? Math.max(0, Math.round(total)) : 0;
}

export function requireDuration(raw: string): number {
  const sec = parseDurationToSeconds(raw);
  if (sec <= 0) {
    throw new Error(`Duration should look like 30m, 1h 15m, or 1:30 — got “${raw}”`);
  }
  return sec;
}

export function elapsedSeconds(startedAt: string): number {
  const start = Date.parse(startedAt);
  if (!Number.isFinite(start)) return 0;
  return Math.max(0, Math.floor((Date.now() - start) / 1000));
}
