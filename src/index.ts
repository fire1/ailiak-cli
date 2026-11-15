#!/usr/bin/env node
import { Command } from 'commander';
import {
  applyGlobalOpts,
  cmdAuthClear,
  cmdAuthSet,
  cmdAuthStatus,
  cmdDesk,
  cmdDeskRead,
  cmdGithubConfig,
  cmdGithubImport,
  cmdGithubPush,
  cmdGithubSyncDone,
  cmdGithubTest,
  cmdGitlabConfig,
  cmdGitlabImport,
  cmdGitlabPush,
  cmdGitlabSyncDone,
  cmdGitlabTest,
  cmdGroups,
  cmdSkill,
  cmdTaskAdd,
  cmdTaskDate,
  cmdTaskDone,
  cmdTaskEstimate,
  cmdTaskReopen,
  cmdTaskShow,
  cmdTaskSpent,
  cmdTaskStart,
  cmdTaskStop,
  cmdTaskTimer,
  cmdTaskTrash,
  cmdWhoami,
  cmdWork,
  printError,
  type GlobalOpts,
} from './commands.js';

const program = new Command();

program
  .name('ailiak')
  .description('Calm CLI for ailiak.com — tasks in, tasks out, without the rush.')
  .version('0.3.0')
  .option('--json', 'Machine-readable JSON output')
  .option('--no-color', 'Disable color')
  .configureOutput({
    outputError: (str, write) => write(str),
  });

function globals(): GlobalOpts {
  const opts = program.opts<{ json?: boolean; color?: boolean }>();
  applyGlobalOpts(opts);
  return opts;
}

async function run(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    printError(err);
    process.exitCode = 1;
  }
}

program
  .command('whoami')
  .description('Show the account for this agent token')
  .action(() => run(() => cmdWhoami(globals())));

program
  .command('skill')
  .description('Load Init skill + hashtag skills (call first as an agent)')
  .action(() => run(() => cmdSkill(globals())));

program
  .command('groups')
  .description('List groups this token can access')
  .action(() => run(() => cmdGroups(globals())));

const desk = program
  .command('desk')
  .description('Browse open desk tasks (list by day #, read one fully)')
  .argument('[date]', 'Day to list (YYYY-MM-DD / today / tomorrow; default today)')
  .option('-t, --tag <tag>', 'Filter by hashtag')
  .option('-a, --all', 'All open tasks (ignore day)')
  .action((date: string | undefined, opts: { tag?: string; all?: boolean }) =>
    run(() => cmdDesk(date, { ...globals(), ...opts })),
  );

desk
  .command('list [date]')
  .description('Compact numbered list of open tasks (default: today)')
  .option('-t, --tag <tag>', 'Filter by hashtag')
  .option('-a, --all', 'All open tasks (ignore day)')
  .action((date: string | undefined, opts: { tag?: string; all?: boolean }) =>
    run(() => cmdDesk(date, { ...globals(), ...opts })),
  );

desk
  .command('read <ref>')
  .description('Read one task (day #, #ticket, or id) — title, detail, notes')
  .option('-n, --note <text>', 'Add a note under the task')
  .action((ref: string, opts: { note?: string }) =>
    run(() => cmdDeskRead(ref, { ...globals(), ...opts })),
  );

program
  .command('work <ref>')
  .description('Show a task, start a timer, stop on Enter (day # / #ticket / id)')
  .option('--done', 'Mark done when the timer stops')
  .action((ref: string, opts: { done?: boolean }) =>
    run(() => cmdWork(ref, { ...globals(), ...opts })),
  );

const auth = program.command('auth').description('Agent token setup');

auth
  .command('set <token>')
  .description('Save ailiak_… token from Studio → Agents')
  .option('--api-url <url>', 'Override API base (default https://api.ailiak.com)')
  .action((token: string, opts: { apiUrl?: string }) => run(() => cmdAuthSet(token, opts)));

auth
  .command('status')
  .description('Show whether a token is configured')
  .action(() => run(() => cmdAuthStatus(globals())));

auth
  .command('clear')
  .description('Remove saved token from config')
  .action(() => run(() => cmdAuthClear()));

const task = program.command('task').description('Create and update tasks');

task
  .command('show <ref>')
  .description('Show one task (day # / #ticket / id) — same as desk read')
  .action((ref: string) => run(() => cmdTaskShow(ref, globals())));

task
  .command('add <text...>')
  .description('Add a note/task (short line ≤255)')
  .option('--title <title>', 'Optional title')
  .option('--detail <detail>', 'Optional longer detail')
  .option('--date <day>', 'YYYY-MM-DD, today, tomorrow, or none')
  .option('--estimate <duration>', 'Planned time (e.g. 1h 30m)')
  .option('--link <url>', 'Optional https embed URL')
  .action(
    (
      text: string[],
      opts: { title?: string; detail?: string; date?: string; estimate?: string; link?: string },
    ) => run(() => cmdTaskAdd(text, { ...globals(), ...opts })),
  );

task
  .command('date <ref> <day>')
  .description('Schedule a task (YYYY-MM-DD / today / tomorrow / none)')
  .action((ref: string, day: string) => run(() => cmdTaskDate(ref, day, globals())));

task
  .command('done <ref>')
  .description('Mark a task finished')
  .action((ref: string) => run(() => cmdTaskDone(ref, globals())));

task
  .command('reopen <ref>')
  .description('Reopen a finished task')
  .action((ref: string) => run(() => cmdTaskReopen(ref, globals())));

task
  .command('trash <ref>')
  .description('Move a task to trash')
  .action((ref: string) => run(() => cmdTaskTrash(ref, globals())));

task
  .command('spent <ref> <duration>')
  .description('Add logged time (e.g. 25m, 1h 15m)')
  .action((ref: string, duration: string) => run(() => cmdTaskSpent(ref, duration, globals())));

task
  .command('estimate <ref> <duration>')
  .description('Set planned time (or 0 / none to clear)')
  .action((ref: string, duration: string) =>
    run(() => cmdTaskEstimate(ref, duration, globals())),
  );

task
  .command('start <ref>')
  .description('Start a local timer on a task')
  .action((ref: string) => run(() => cmdTaskStart(ref, globals())));

task
  .command('stop')
  .description('Stop the timer and add spent time')
  .option('--done', 'Also mark the task done')
  .action((opts: { done?: boolean }) => run(() => cmdTaskStop({ ...globals(), ...opts })));

task
  .command('timer')
  .description('Show the running timer')
  .action(() => run(() => cmdTaskTimer(globals())));

const github = program.command('github').description('GitHub import / sync / push');

github
  .command('config')
  .description('Save GitHub token + repo (or show current)')
  .option('--token <token>', 'GitHub personal access token')
  .option('--repo <owner/name>', 'Repository')
  .option('--base-url <url>', 'GitHub URL (default https://github.com)')
  .option('--clear', 'Remove GitHub config')
  .action((opts: { token?: string; repo?: string; baseUrl?: string; clear?: boolean }) =>
    run(() => cmdGithubConfig(opts)),
  );

github
  .command('test')
  .description('Verify GitHub token + repo')
  .action(() => run(() => cmdGithubTest(globals())));

github
  .command('import')
  .description('Import open issues/PRs onto the Desk')
  .option('--date <day>', 'Schedule imported tasks (default today)')
  .option('--dry-run', 'Preview only')
  .action((opts: { date?: string; dryRun?: boolean }) =>
    run(() => cmdGithubImport({ ...globals(), ...opts })),
  );

github
  .command('sync-done')
  .description('Mark linked Desk tasks done when GitHub issues/PRs close')
  .action(() => run(() => cmdGithubSyncDone(globals())));

github
  .command('push <ref>')
  .description('Create a GitHub issue from a Desk task and link it')
  .action((ref: string) => run(() => cmdGithubPush(ref, globals())));

const gitlab = program.command('gitlab').description('GitLab import / sync / push');

gitlab
  .command('config')
  .description('Save GitLab token + project (or show current)')
  .option('--token <token>', 'GitLab personal access token')
  .option('--project <path-or-id>', 'Project path or numeric id')
  .option('--base-url <url>', 'GitLab URL (default https://gitlab.com)')
  .option('--clear', 'Remove GitLab config')
  .action((opts: { token?: string; project?: string; baseUrl?: string; clear?: boolean }) =>
    run(() => cmdGitlabConfig(opts)),
  );

gitlab
  .command('test')
  .description('Verify GitLab token + project')
  .action(() => run(() => cmdGitlabTest(globals())));

gitlab
  .command('import')
  .description('Import open issues/MRs onto the Desk')
  .option('--date <day>', 'Schedule imported tasks (default today)')
  .option('--dry-run', 'Preview only')
  .action((opts: { date?: string; dryRun?: boolean }) =>
    run(() => cmdGitlabImport({ ...globals(), ...opts })),
  );

gitlab
  .command('sync-done')
  .description('Mark linked Desk tasks done when GitLab issues/MRs close')
  .action(() => run(() => cmdGitlabSyncDone(globals())));

gitlab
  .command('push <ref>')
  .description('Create a GitLab issue from a Desk task and link it')
  .action((ref: string) => run(() => cmdGitlabPush(ref, globals())));

program.addHelpText(
  'after',
  `
Examples:
  ailiak auth set ailiak_…
  ailiak desk
  ailiak desk read 2
  ailiak desk read 2 --note "waiting on review"
  ailiak work 2 --done
  ailiak task spent 2 25m
  ailiak github config --token ghp_… --repo owner/name
  ailiak github import --dry-run
  ailiak github sync-done
  ailiak gitlab push 3

Refs after desk list: day # (1, 2…), #ticket, or full id.

Token: https://ailiak.com/studio/agents
Desk:  https://ailiak.com/desk

Notes / spent / estimate need a current Agent API (deploy agent-api).
`,
);

await program.parseAsync(process.argv);
