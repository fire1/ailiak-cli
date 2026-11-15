# ailiak

Calm CLI for [ailiak.com](https://ailiak.com) — short notes become today’s tasks, finish them when ready.

**Tasks in, tasks out… without the rush.**

Talks to the hosted Agent API (`https://api.ailiak.com`) with a personal `ailiak_…` token. GitHub / GitLab use your own PATs from the terminal (same idea as Studio Sync).

Works on **Linux**, **macOS**, and **Windows** (Node 18+). Quick install script below is for Linux / macOS.

---

## Install

### Quick install (Linux / macOS)

```bash
curl -fsSL https://raw.githubusercontent.com/fire1/ailiak-cli/main/install.sh | bash
```

Checks Node 18+, installs from GitHub, then prints `ailiak --version`.

| Variable | Meaning |
|----------|---------|
| `AILIAK_CLI_REPO` | GitHub repo (default `fire1/ailiak-cli`) |
| `AILIAK_CLI_REF` | Branch or tag (default `main`) |

Example — pin a tag:

```bash
AILIAK_CLI_REF=v0.2.0 bash <(curl -fsSL https://raw.githubusercontent.com/fire1/ailiak-cli/main/install.sh)
```

### npm (Linux / macOS / Windows)

```bash
npm install -g github:fire1/ailiak-cli
```

Pin a ref:

```bash
npm install -g github:fire1/ailiak-cli#v0.2.0
```

### From a local clone (dev)

```bash
git clone https://github.com/fire1/ailiak-cli.git
cd ailiak-cli
npm install
npm run make          # build + npm link → `ailiak` on PATH
```

Useful scripts:

| Script | What it does |
|--------|----------------|
| `npm run build` | Compile TypeScript → `dist/` |
| `npm run make` | `build` + `npm link` |
| `npm run dev -- desk` | Run without linking |
| `npm start -- whoami` | Run built `dist/` |

Uninstall global install: `npm uninstall -g ailiak`  
Unlink local: `npm unlink -g ailiak`

---

## Quick start

1. Sign in at [ailiak.com](https://ailiak.com)
2. Studio → [AI agents](https://ailiak.com/studio/agents) → create a token
3. Save it:

```bash
ailiak auth set ailiak_YOUR_TOKEN
ailiak whoami
ailiak desk
```

Config file: `~/.config/ailiak/config.json` (mode `0600`).

| Env | Meaning |
|-----|---------|
| `AILIAK_TOKEN` | Agent token (overrides config) |
| `AILIAK_API_URL` | API base (default `https://api.ailiak.com`) |
| `NO_COLOR` | Disable color (same as `--no-color`) |

---

## Global options

| Option | What it does |
|--------|----------------|
| `-V, --version` | Print version |
| `-h, --help` | Help |
| `--json` | Machine-readable JSON |
| `--no-color` | Disable teal accents |

---

## Commands

### Auth

| Command | What it does |
|---------|----------------|
| `ailiak auth set <token>` | Save `ailiak_…` token |
| `ailiak auth set <token> --api-url <url>` | Save token + custom API URL |
| `ailiak auth status` | Token, API, GitHub/GitLab, timer |
| `ailiak auth clear` | Remove saved token |

### Identity & desk

| Command | What it does |
|---------|----------------|
| `ailiak whoami` | Account + token scope |
| `ailiak skill` | Init skill + hashtag skills |
| `ailiak groups` | Groups this token can see |
| `ailiak desk [date]` | Open tasks for a day (default **today**) |
| `ailiak desk --all` / `-a` | All open tasks (ignore day) |
| `ailiak desk -t, --tag <tag>` | Filter by hashtag |
| `ailiak work <id>` | Show task, start timer, stop on Enter |
| `ailiak work <id> --done` | Same, then mark done |

Dates: `YYYY-MM-DD`, `today`, `tomorrow`, or `none` (unscheduled).

### Tasks

| Command | What it does |
|---------|----------------|
| `ailiak task show <id>` | One task or thread note |
| `ailiak task add <text…>` | Create a note (short line ≤255) |
| `ailiak task date <id> <day>` | Schedule / unschedule |
| `ailiak task done <id>` | Finish |
| `ailiak task reopen <id>` | Undo finish |
| `ailiak task trash <id>` | Soft-delete |

**`task add` options**

| Option | What it does |
|--------|----------------|
| `--title <title>` | Optional title (≤80) |
| `--detail <detail>` | Longer body |
| `--date <day>` | `today` / `tomorrow` / `YYYY-MM-DD` / `none` |
| `--estimate <duration>` | Planned time (`1h 30m`, `1:30`, …) |
| `--link <url>` | Optional `https://` embed (issue URL) |

### Time tracking

Needs **Agent API ≥1.3.0** (`add_task_spent` / `set_task_estimate`).

| Command | What it does |
|---------|----------------|
| `ailiak task spent <id> <duration>` | Add logged time (`25m`, `1h 15m`, `1:30`) |
| `ailiak task estimate <id> <duration>` | Set planned time (`0` / `none` clears) |
| `ailiak task start <id>` | Start a local timer |
| `ailiak task stop` | Stop timer → add spent |
| `ailiak task stop --done` | Stop + mark done |
| `ailiak task timer` | Show running timer |

### GitHub

Talks to GitHub’s API with your PAT; links Desk notes via `embedUrl` + `taskNumber`.

| Command | What it does |
|---------|----------------|
| `ailiak github config` | Show saved config |
| `ailiak github config --token <tok> --repo owner/name` | Save token + repo |
| `ailiak github config --base-url <url>` | GitHub Enterprise / custom host |
| `ailiak github config --clear` | Remove GitHub config |
| `ailiak github test` | Verify token + repo |
| `ailiak github import` | Import open issues/PRs onto the Desk |
| `ailiak github import --dry-run` | Preview only |
| `ailiak github import --date <day>` | Schedule imported tasks |
| `ailiak github sync-done` | Mark linked Desk tasks done when issues/PRs close |
| `ailiak github push <id>` | Create a GitHub issue from a Desk task and link it |

| Env | Meaning |
|-----|---------|
| `GITHUB_TOKEN` | GitHub PAT |
| `AILIAK_GITHUB_REPO` | `owner/name` |
| `AILIAK_GITHUB_URL` | Web base (default `https://github.com`) |

### GitLab

Same pattern as GitHub.

| Command | What it does |
|---------|----------------|
| `ailiak gitlab config` | Show saved config |
| `ailiak gitlab config --token <tok> --project group/name` | Save token + project |
| `ailiak gitlab config --base-url <url>` | Self-managed GitLab host |
| `ailiak gitlab config --clear` | Remove GitLab config |
| `ailiak gitlab test` | Verify token + project |
| `ailiak gitlab import` | Import open issues/MRs onto the Desk |
| `ailiak gitlab import --dry-run` | Preview only |
| `ailiak gitlab import --date <day>` | Schedule imported tasks |
| `ailiak gitlab sync-done` | Mark linked Desk tasks done when issues/MRs close |
| `ailiak gitlab push <id>` | Create a GitLab issue from a Desk task and link it |

| Env | Meaning |
|-----|---------|
| `GITLAB_TOKEN` | GitLab PAT |
| `AILIAK_GITLAB_PROJECT` | Project path or numeric id |
| `AILIAK_GITLAB_URL` | Base URL (default `https://gitlab.com`) |

`import` / `push` / linking need **Agent API ≥1.3.0** (`embedUrl` on create + `link_task`).

---

## Examples

```bash
ailiak auth set ailiak_…
ailiak desk
ailiak desk tomorrow --tag work
ailiak task add "buy oat milk" --date today --estimate 15m
ailiak work <id> --done
ailiak task spent <id> 25m

ailiak github config --token ghp_… --repo owner/name
ailiak github import --dry-run
ailiak github sync-done
ailiak gitlab push <id>
```

---

## Agent API (≥1.3.0 for spent / link)

Spent, estimate, and ticket links need the Worker tools from the main [ailiak](https://github.com/fire1/ailiak) `agent-api` package.

```bash
cd agent-api
yarn deploy
```

Local Worker + CLI:

```bash
cd agent-api && yarn dev
export AILIAK_API_URL=http://127.0.0.1:8787
ailiak whoami
```

---

## Links

| What | URL |
|------|-----|
| Web app | https://ailiak.com |
| Desk | https://ailiak.com/desk |
| Create agent token | https://ailiak.com/studio/agents |
| Agent API | https://api.ailiak.com |

## License

MIT
