import { createInterface } from 'node:readline';
import {
  configPath,
  getDeskIndex,
  getTimer,
  loadConfig,
  resolveGithub,
  resolveGitlab,
  saveConfig,
  saveDeskIndex,
  setTimer,
  DEFAULT_API_URL,
} from './config.js';
import {
  elapsedSeconds,
  formatDuration,
  parseDay,
  requireDuration,
  todayLocal,
} from './dates.js';
import {
  printError,
  printGroups,
  printJson,
  printOk,
  printSkill,
  printTask,
  printTaskList,
  printWhoami,
  setColor,
} from './format.js';
import { githubCreateIssue, githubListTickets, githubTest } from './github.js';
import { gitlabCreateIssue, gitlabListTickets, gitlabTest } from './gitlab.js';
import { McpClient } from './mcp.js';
import {
  buildDeskIndex,
  deskTasksOnly,
  noteCountByParent,
  resolveTaskRef,
} from './resolve.js';
import {
  closedRemoteKeys,
  filterNewTickets,
  isGithubLink,
  isGitlabLink,
  notesToMarkDone,
  ticketToCreateArgs,
} from './sync.js';
import type { GroupSummary, SkillPayload, TaskSummary, Whoami } from './types.js';

export type GlobalOpts = {
  json?: boolean;
  color?: boolean;
};

function wantJson(opts: GlobalOpts): boolean {
  return Boolean(opts.json);
}

async function client(): Promise<McpClient> {
  return McpClient.connect();
}

function hintApiUpgrade(err: unknown): never {
  const msg = err instanceof Error ? err.message : String(err);
  if (
    /unknown tool|method not found|add_task_spent|set_task_estimate|link_task|add_task_note/i.test(
      msg,
    )
  ) {
    throw new Error(
      `${msg}\n\nThis needs a newer Agent API (add_task_note / spent / estimate). From the ailiak repo:\n  cd agent-api && yarn deploy\nOr point AILIAK_API_URL at a local wrangler dev Worker.`,
    );
  }
  throw err instanceof Error ? err : new Error(msg);
}

async function taskId(ref: string): Promise<string> {
  return resolveTaskRef(ref);
}

async function listAllOpen(mcp: McpClient): Promise<TaskSummary[]> {
  const data = await mcp.callTool<{ tasks: TaskSummary[] }>('list_open_tasks', {});
  return data.tasks || [];
}

function waitForEnter(prompt: string): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(prompt, () => {
      rl.close();
      resolve();
    });
  });
}

export async function cmdAuthSet(token: string, opts: { apiUrl?: string }): Promise<void> {
  const trimmed = token.trim();
  if (!trimmed.startsWith('ailiak_')) {
    throw new Error('Token should look like ailiak_… (from Studio → Agents).');
  }
  const patch: { token: string; apiUrl?: string } = { token: trimmed };
  if (opts.apiUrl) patch.apiUrl = opts.apiUrl.replace(/\/+$/, '');
  await saveConfig(patch);
  process.stdout.write(`Saved token to ${configPath()}\n`);
  if (patch.apiUrl) process.stdout.write(`API URL: ${patch.apiUrl}\n`);
}

export async function cmdAuthStatus(opts: GlobalOpts): Promise<void> {
  const cfg = await loadConfig();
  const envToken = Boolean(process.env.AILIAK_TOKEN);
  const envUrl = process.env.AILIAK_API_URL;
  const hasToken = envToken || Boolean(cfg.token);
  const apiUrl = (envUrl || cfg.apiUrl || DEFAULT_API_URL).replace(/\/+$/, '');
  const data = {
    hasToken,
    tokenSource: envToken ? 'env' : cfg.token ? 'config' : 'none',
    apiUrl,
    apiUrlSource: envUrl ? 'env' : cfg.apiUrl ? 'config' : 'default',
    configPath: configPath(),
    github: Boolean(cfg.github?.token && cfg.github?.repo),
    gitlab: Boolean(cfg.gitlab?.token && cfg.gitlab?.project),
    timer: cfg.timer || null,
  };
  if (wantJson(opts)) {
    printJson(data);
    return;
  }
  process.stdout.write(`token   ${hasToken ? `yes (${data.tokenSource})` : 'no'}\n`);
  process.stdout.write(`api     ${apiUrl} (${data.apiUrlSource})\n`);
  process.stdout.write(`github  ${data.github ? 'configured' : 'no'}\n`);
  process.stdout.write(`gitlab  ${data.gitlab ? 'configured' : 'no'}\n`);
  process.stdout.write(`config  ${configPath()}\n`);
  if (cfg.timer) {
    process.stdout.write(
      `timer   ${cfg.timer.taskId} · ${formatDuration(elapsedSeconds(cfg.timer.startedAt))} running\n`,
    );
  }
  if (!hasToken) {
    process.stdout.write('\nCreate a token at https://ailiak.com/studio/agents\n');
    process.stdout.write('then:  ailiak auth set ailiak_…\n');
  }
}

export async function cmdAuthClear(): Promise<void> {
  await saveConfig({ token: '', apiUrl: '' });
  process.stdout.write(`Cleared token in ${configPath()}\n`);
}

export async function cmdWhoami(opts: GlobalOpts): Promise<void> {
  const mcp = await client();
  const data = await mcp.callTool<Whoami>('whoami');
  if (wantJson(opts)) printJson(data);
  else printWhoami(data);
}

export async function cmdSkill(opts: GlobalOpts): Promise<void> {
  const mcp = await client();
  const data = await mcp.callTool<SkillPayload>('get_skill');
  if (wantJson(opts)) printJson(data);
  else printSkill(data);
}

export async function cmdGroups(opts: GlobalOpts): Promise<void> {
  const mcp = await client();
  const data = await mcp.callTool<{ count: number; groups: GroupSummary[] }>('list_groups');
  if (wantJson(opts)) printJson(data);
  else printGroups(data.groups || []);
}

export async function cmdDesk(
  dateArg: string | undefined,
  opts: GlobalOpts & { tag?: string; all?: boolean },
): Promise<void> {
  const mcp = await client();
  const args: Record<string, unknown> = {};
  if (opts.tag) args.tag = opts.tag.replace(/^#/, '');
  if (!opts.all) {
    const day = dateArg !== undefined ? parseDay(dateArg) : todayLocal();
    if (day !== undefined && day !== null) args.forDate = day;
  }

  const data = await mcp.callTool<{
    count: number;
    forDate: string | null;
    tag: string | null;
    scope: string;
    tasks: TaskSummary[];
  }>('list_open_tasks', args);

  const all = data.tasks || [];
  const tasks = deskTasksOnly(all);
  const forDate = opts.all ? null : (data.forDate ?? (args.forDate as string) ?? todayLocal());
  const tag = data.tag ? String(data.tag).replace(/^#/, '') : null;
  await saveDeskIndex(buildDeskIndex(all, { forDate, tag }));

  if (wantJson(opts)) {
    printJson({
      ...data,
      count: tasks.length,
      tasks,
      dayIndex: tasks.map((t, i) => ({ n: i + 1, id: t.id, taskNumber: t.taskNumber })),
    });
    return;
  }
  printTaskList(tasks, {
    forDate,
    tag,
    scope: data.scope,
    noteCounts: noteCountByParent(all),
  });
}

async function loadTaskWithNotes(mcp: McpClient, id: string): Promise<TaskSummary> {
  const task = await mcp.callTool<TaskSummary>('get_task', { id });
  if (task.kind === 'thread_note') return task;
  if (Array.isArray(task.notes)) return task;

  // Older Agent API: notes come as thread_note rows on list_open_tasks.
  try {
    const data = await mcp.callTool<{ tasks: TaskSummary[] }>('list_open_tasks', {
      forDate: task.forDate || undefined,
    });
    const notes = (data.tasks || [])
      .filter((t) => t.kind === 'thread_note' && t.parentId === id)
      .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
    return { ...task, notes };
  } catch {
    return { ...task, notes: [] };
  }
}

export async function cmdDeskRead(
  ref: string,
  opts: GlobalOpts & { note?: string },
): Promise<void> {
  const id = await taskId(ref);
  const mcp = await client();

  if (opts.note !== undefined) {
    const text = opts.note.trim();
    if (!text) throw new Error('Pass a note with --note "…"');
    if (text.length > 280) throw new Error(`Note is max 280 chars (got ${text.length}).`);
    try {
      await mcp.callTool<{ ok: boolean; note: TaskSummary }>('add_task_note', { id, text });
    } catch (err) {
      hintApiUpgrade(err);
    }
  }

  const task = await loadTaskWithNotes(mcp, id);
  const index = await getDeskIndex();
  const dayNumber = index?.entries.find((e) => e.id === id)?.n;

  if (wantJson(opts)) {
    printJson({ ...task, dayNumber: dayNumber ?? null });
    return;
  }
  printTask(task, { dayNumber });
  if (opts.note !== undefined) {
    process.stdout.write('\nNote added.\n');
  }
}

export async function cmdTaskShow(ref: string, opts: GlobalOpts): Promise<void> {
  await cmdDeskRead(ref, opts);
}

export async function cmdTaskAdd(
  textParts: string[],
  opts: GlobalOpts & {
    title?: string;
    detail?: string;
    date?: string;
    estimate?: string;
    link?: string;
  },
): Promise<void> {
  const text = textParts.join(' ').trim();
  if (!text) throw new Error('Add a short note (≤255 chars).');
  if (text.length > 255) throw new Error(`Short line is max 255 chars (got ${text.length}).`);

  const args: Record<string, unknown> = { text };
  if (opts.title) args.title = opts.title.slice(0, 80);
  if (opts.detail) args.detail = opts.detail;
  if (opts.date !== undefined) {
    const day = parseDay(opts.date);
    args.forDate = day === undefined ? undefined : day;
  }
  if (opts.estimate) args.estimateSeconds = requireDuration(opts.estimate);
  if (opts.link) args.embedUrl = opts.link;

  const mcp = await client();
  try {
    const data = await mcp.callTool<{ ok: boolean; task: TaskSummary }>('create_task', args);
    if (wantJson(opts)) printJson(data);
    else printOk('added', data.task);
  } catch (err) {
    hintApiUpgrade(err);
  }
}

export async function cmdTaskDate(ref: string, dateRaw: string, opts: GlobalOpts): Promise<void> {
  const id = await taskId(ref);
  const forDate = parseDay(dateRaw);
  const mcp = await client();
  const data = await mcp.callTool<{ ok: boolean; task: TaskSummary }>('set_task_date', {
    id,
    forDate: forDate ?? null,
  });
  if (wantJson(opts)) printJson(data);
  else printOk(forDate ? `scheduled ${forDate}` : 'unscheduled', data.task);
}

export async function cmdTaskDone(ref: string, opts: GlobalOpts): Promise<void> {
  const id = await taskId(ref);
  const mcp = await client();
  const data = await mcp.callTool<{ ok: boolean; task: TaskSummary }>('mark_task_done', { id });
  if (wantJson(opts)) printJson(data);
  else printOk('done', data.task);
}

export async function cmdTaskReopen(ref: string, opts: GlobalOpts): Promise<void> {
  const id = await taskId(ref);
  const mcp = await client();
  const data = await mcp.callTool<{ ok: boolean; task: TaskSummary }>('reopen_task', { id });
  if (wantJson(opts)) printJson(data);
  else printOk('reopened', data.task);
}

export async function cmdTaskTrash(ref: string, opts: GlobalOpts): Promise<void> {
  const id = await taskId(ref);
  const mcp = await client();
  const data = await mcp.callTool<{ ok: boolean; task: TaskSummary }>('trash_task', { id });
  if (wantJson(opts)) printJson(data);
  else printOk('trashed', data.task);
}

export async function cmdTaskSpent(ref: string, duration: string, opts: GlobalOpts): Promise<void> {
  const id = await taskId(ref);
  const seconds = requireDuration(duration);
  const mcp = await client();
  try {
    const data = await mcp.callTool<{ ok: boolean; task: TaskSummary }>('add_task_spent', {
      id,
      seconds,
    });
    if (wantJson(opts)) printJson(data);
    else printOk(`spent +${formatDuration(seconds)}`, data.task);
  } catch (err) {
    hintApiUpgrade(err);
  }
}

export async function cmdTaskEstimate(
  ref: string,
  duration: string,
  opts: GlobalOpts,
): Promise<void> {
  const id = await taskId(ref);
  const seconds = duration.trim() === '0' || duration.trim().toLowerCase() === 'none'
    ? 0
    : requireDuration(duration);
  const mcp = await client();
  try {
    const data = await mcp.callTool<{ ok: boolean; task: TaskSummary }>('set_task_estimate', {
      id,
      seconds,
    });
    if (wantJson(opts)) printJson(data);
    else printOk(seconds ? `estimate ${formatDuration(seconds)}` : 'estimate cleared', data.task);
  } catch (err) {
    hintApiUpgrade(err);
  }
}

export async function cmdTaskStart(ref: string, opts: GlobalOpts): Promise<void> {
  const id = await taskId(ref);
  const mcp = await client();
  const task = await mcp.callTool<TaskSummary>('get_task', { id });
  const existing = await getTimer();
  if (existing && existing.taskId !== id) {
    throw new Error(
      `Timer already running on ${existing.taskId} (${formatDuration(elapsedSeconds(existing.startedAt))}). Stop it first.`,
    );
  }
  if (existing && existing.taskId === id) {
    if (wantJson(opts)) printJson({ timer: existing, task });
    else process.stdout.write(`Already timing ${id} · ${formatDuration(elapsedSeconds(existing.startedAt))}\n`);
    return;
  }
  const timer = { taskId: id, startedAt: new Date().toISOString() };
  await setTimer(timer);
  if (wantJson(opts)) printJson({ timer, task });
  else printOk('timer started', task);
}

export async function cmdTaskStop(opts: GlobalOpts & { done?: boolean }): Promise<void> {
  const timer = await getTimer();
  if (!timer) throw new Error('No timer running. Start with: ailiak task start <id>');
  const seconds = elapsedSeconds(timer.startedAt);
  await setTimer(null);
  const mcp = await client();
  let task: TaskSummary | undefined;
  if (seconds > 0) {
    try {
      const data = await mcp.callTool<{ ok: boolean; task: TaskSummary }>('add_task_spent', {
        id: timer.taskId,
        seconds,
      });
      task = data.task;
    } catch (err) {
      hintApiUpgrade(err);
    }
  } else {
    task = await mcp.callTool<TaskSummary>('get_task', { id: timer.taskId });
  }
  if (opts.done) {
    const data = await mcp.callTool<{ ok: boolean; task: TaskSummary }>('mark_task_done', {
      id: timer.taskId,
    });
    task = data.task;
  }
  if (wantJson(opts)) printJson({ seconds, task });
  else {
    printOk(`timer stopped · +${formatDuration(seconds) || '0s'}`, task);
    if (opts.done) process.stdout.write('Marked done.\n');
  }
}

export async function cmdTaskTimer(opts: GlobalOpts): Promise<void> {
  const timer = await getTimer();
  if (!timer) {
    if (wantJson(opts)) printJson({ timer: null });
    else process.stdout.write('No timer running.\n');
    return;
  }
  const seconds = elapsedSeconds(timer.startedAt);
  if (wantJson(opts)) printJson({ timer, seconds });
  else {
    process.stdout.write(
      `timing  ${timer.taskId} · ${formatDuration(seconds)} (started ${timer.startedAt})\n`,
    );
  }
}

export async function cmdWork(
  ref: string,
  opts: GlobalOpts & { done?: boolean },
): Promise<void> {
  const id = await taskId(ref);
  const mcp = await client();
  const task = await mcp.callTool<TaskSummary>('get_task', { id });
  const index = await getDeskIndex();
  const dayNumber = index?.entries.find((e) => e.id === id)?.n;
  if (!wantJson(opts)) {
    printTask(task, { dayNumber });
    process.stdout.write('\n');
  }
  await cmdTaskStart(id, opts);
  if (!wantJson(opts)) {
    await waitForEnter('Working… press Enter to stop timer. ');
  }
  await cmdTaskStop({ ...opts, done: opts.done });
}

/* ——— GitHub ——— */

export async function cmdGithubConfig(opts: {
  token?: string;
  repo?: string;
  baseUrl?: string;
  clear?: boolean;
}): Promise<void> {
  if (opts.clear) {
    await saveConfig({ github: {} });
    process.stdout.write('Cleared GitHub config.\n');
    return;
  }
  const patch: { token?: string; repo?: string; baseUrl?: string } = {};
  if (opts.token) patch.token = opts.token.trim();
  if (opts.repo) patch.repo = opts.repo.trim();
  if (opts.baseUrl) patch.baseUrl = opts.baseUrl.replace(/\/+$/, '');
  if (!Object.keys(patch).length) {
    const cfg = await loadConfig();
    process.stdout.write(
      `github  repo ${cfg.github?.repo || '(unset)'} · token ${cfg.github?.token ? 'yes' : 'no'} · ${cfg.github?.baseUrl || 'https://github.com'}\n`,
    );
    return;
  }
  await saveConfig({ github: patch });
  process.stdout.write(`Saved GitHub config to ${configPath()}\n`);
}

export async function cmdGithubTest(opts: GlobalOpts): Promise<void> {
  const gh = await resolveGithub();
  const result = await githubTest(gh);
  if (wantJson(opts)) printJson(result);
  else process.stdout.write(`ok  @${result.login} · ${result.repo}\n`);
}

export async function cmdGithubImport(
  opts: GlobalOpts & { date?: string; dryRun?: boolean },
): Promise<void> {
  const gh = await resolveGithub();
  const tickets = (await githubListTickets({ ...gh, state: 'open' })).filter((t) => !t.done);
  const mcp = await client();
  const existing = await listAllOpen(mcp);
  const { tickets: fresh, skipped } = filterNewTickets(tickets, existing);
  const forDate = opts.date !== undefined ? parseDay(opts.date) : todayLocal();

  if (wantJson(opts)) {
    printJson({ count: fresh.length, skipped, tickets: fresh, dryRun: Boolean(opts.dryRun) });
    return;
  }
  process.stdout.write(`github import · ${fresh.length} new · ${skipped} already linked\n`);
  if (opts.dryRun || !fresh.length) {
    for (const t of fresh.slice(0, 20)) {
      process.stdout.write(`  #${t.number}  ${t.title}\n`);
    }
    if (opts.dryRun) process.stdout.write('(dry run — nothing created)\n');
    return;
  }

  let ok = 0;
  for (const t of fresh) {
    try {
      const args = ticketToCreateArgs(t, forDate || undefined);
      await mcp.callTool('create_task', args);
      ok += 1;
      process.stdout.write(`  + #${t.number}  ${t.title.slice(0, 60)}\n`);
    } catch (err) {
      process.stderr.write(`  ! #${t.number}  ${err instanceof Error ? err.message : err}\n`);
    }
  }
  process.stdout.write(`Imported ${ok}/${fresh.length}.\n`);
}

export async function cmdGithubSyncDone(opts: GlobalOpts): Promise<void> {
  const gh = await resolveGithub();
  const closed = await githubListTickets({ ...gh, state: 'closed' });
  const mcp = await client();
  const open = await listAllOpen(mcp);
  const toDone = notesToMarkDone(open, closedRemoteKeys(closed), isGithubLink);

  if (wantJson(opts)) {
    printJson({ count: toDone.length, tasks: toDone });
    return;
  }
  if (!toDone.length) {
    process.stdout.write('Everything linked is already in sync.\n');
    return;
  }
  let ok = 0;
  for (const note of toDone) {
    try {
      await mcp.callTool('mark_task_done', { id: note.id });
      ok += 1;
      printOk('done', note);
    } catch (err) {
      process.stderr.write(`  ! ${note.id}  ${err instanceof Error ? err.message : err}\n`);
    }
  }
  process.stdout.write(`Marked ${ok} done from GitHub.\n`);
}

export async function cmdGithubPush(ref: string, opts: GlobalOpts): Promise<void> {
  const id = await taskId(ref);
  const gh = await resolveGithub();
  const mcp = await client();
  const task = await mcp.callTool<TaskSummary>('get_task', { id });
  if (isGithubLink(task.embedUrl)) {
    throw new Error(`Already linked: ${task.embedUrl}`);
  }
  const title = (task.title || task.text || 'Desk note').trim().slice(0, 255);
  const body = [task.detail, task.title && task.text ? task.text : '']
    .map((s) => String(s || '').trim())
    .filter(Boolean)
    .join('\n\n');
  const created = await githubCreateIssue({ ...gh, title, body });
  try {
    const data = await mcp.callTool<{ ok: boolean; task: TaskSummary }>('link_task', {
      id,
      embedUrl: created.url,
      taskNumber: created.number,
    });
    if (wantJson(opts)) printJson({ issue: created, task: data.task });
    else {
      process.stdout.write(`pushed  ${created.url}\n`);
      printOk('linked', data.task);
    }
  } catch (err) {
    hintApiUpgrade(err);
  }
}

/* ——— GitLab ——— */

export async function cmdGitlabConfig(opts: {
  token?: string;
  project?: string;
  baseUrl?: string;
  clear?: boolean;
}): Promise<void> {
  if (opts.clear) {
    await saveConfig({ gitlab: {} });
    process.stdout.write('Cleared GitLab config.\n');
    return;
  }
  const patch: { token?: string; project?: string; baseUrl?: string } = {};
  if (opts.token) patch.token = opts.token.trim();
  if (opts.project) patch.project = opts.project.trim();
  if (opts.baseUrl) patch.baseUrl = opts.baseUrl.replace(/\/+$/, '');
  if (!Object.keys(patch).length) {
    const cfg = await loadConfig();
    process.stdout.write(
      `gitlab  project ${cfg.gitlab?.project || '(unset)'} · token ${cfg.gitlab?.token ? 'yes' : 'no'} · ${cfg.gitlab?.baseUrl || 'https://gitlab.com'}\n`,
    );
    return;
  }
  await saveConfig({ gitlab: patch });
  process.stdout.write(`Saved GitLab config to ${configPath()}\n`);
}

export async function cmdGitlabTest(opts: GlobalOpts): Promise<void> {
  const gl = await resolveGitlab();
  const result = await gitlabTest(gl);
  if (wantJson(opts)) printJson(result);
  else process.stdout.write(`ok  @${result.username} · ${result.project}\n`);
}

export async function cmdGitlabImport(
  opts: GlobalOpts & { date?: string; dryRun?: boolean },
): Promise<void> {
  const gl = await resolveGitlab();
  const tickets = (await gitlabListTickets({ ...gl, state: 'opened' })).filter((t) => !t.done);
  const mcp = await client();
  const existing = await listAllOpen(mcp);
  const { tickets: fresh, skipped } = filterNewTickets(tickets, existing);
  const forDate = opts.date !== undefined ? parseDay(opts.date) : todayLocal();

  if (wantJson(opts)) {
    printJson({ count: fresh.length, skipped, tickets: fresh, dryRun: Boolean(opts.dryRun) });
    return;
  }
  process.stdout.write(`gitlab import · ${fresh.length} new · ${skipped} already linked\n`);
  if (opts.dryRun || !fresh.length) {
    for (const t of fresh.slice(0, 20)) {
      process.stdout.write(`  #${t.number}  ${t.title}\n`);
    }
    if (opts.dryRun) process.stdout.write('(dry run — nothing created)\n');
    return;
  }

  let ok = 0;
  for (const t of fresh) {
    try {
      const args = ticketToCreateArgs(t, forDate || undefined);
      await mcp.callTool('create_task', args);
      ok += 1;
      process.stdout.write(`  + #${t.number}  ${t.title.slice(0, 60)}\n`);
    } catch (err) {
      process.stderr.write(`  ! #${t.number}  ${err instanceof Error ? err.message : err}\n`);
    }
  }
  process.stdout.write(`Imported ${ok}/${fresh.length}.\n`);
}

export async function cmdGitlabSyncDone(opts: GlobalOpts): Promise<void> {
  const gl = await resolveGitlab();
  const closed = await gitlabListTickets({ ...gl, state: 'closed' });
  const mcp = await client();
  const open = await listAllOpen(mcp);
  const toDone = notesToMarkDone(open, closedRemoteKeys(closed), isGitlabLink);

  if (wantJson(opts)) {
    printJson({ count: toDone.length, tasks: toDone });
    return;
  }
  if (!toDone.length) {
    process.stdout.write('Everything linked is already in sync.\n');
    return;
  }
  let ok = 0;
  for (const note of toDone) {
    try {
      await mcp.callTool('mark_task_done', { id: note.id });
      ok += 1;
      printOk('done', note);
    } catch (err) {
      process.stderr.write(`  ! ${note.id}  ${err instanceof Error ? err.message : err}\n`);
    }
  }
  process.stdout.write(`Marked ${ok} done from GitLab.\n`);
}

export async function cmdGitlabPush(ref: string, opts: GlobalOpts): Promise<void> {
  const id = await taskId(ref);
  const gl = await resolveGitlab();
  const mcp = await client();
  const task = await mcp.callTool<TaskSummary>('get_task', { id });
  if (isGitlabLink(task.embedUrl)) {
    throw new Error(`Already linked: ${task.embedUrl}`);
  }
  const title = (task.title || task.text || 'Desk note').trim().slice(0, 255);
  const description = [task.detail, task.title && task.text ? task.text : '']
    .map((s) => String(s || '').trim())
    .filter(Boolean)
    .join('\n\n');
  const created = await gitlabCreateIssue({ ...gl, title, description });
  try {
    const data = await mcp.callTool<{ ok: boolean; task: TaskSummary }>('link_task', {
      id,
      embedUrl: created.url,
      taskNumber: created.number,
    });
    if (wantJson(opts)) printJson({ issue: created, task: data.task });
    else {
      process.stdout.write(`pushed  ${created.url}\n`);
      printOk('linked', data.task);
    }
  } catch (err) {
    hintApiUpgrade(err);
  }
}

export function applyGlobalOpts(opts: GlobalOpts): void {
  if (opts.color === false || process.env.NO_COLOR) setColor(false);
  else if (opts.color === true) setColor(true);
}

export { printError };
