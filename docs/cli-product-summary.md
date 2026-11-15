# Ailiak — product summary for CLI / agent clients

Audience: AI agents and humans designing a **CLI client** for [ailiak.com](https://ailiak.com).

This is a feature map of the web app, plus what already exists for remote access. Prefer building CLI commands that mirror these product nouns, not inventing a second task model.

Related:

- Repo / product context: [`AGENTS.md`](../AGENTS.md)
- Hosted API (MCP + token auth): [`agent-api/README.md`](../agent-api/README.md)
- In-app help copy: Studio → Help (`src/pages/StudioHelp.vue`)

---

## One-liner

**Ailiak** is a calm personal desk: short notes become today’s tasks; finish them when ready. Tone is “айляк” (slowing down / not rushing) — not hustle, inbox-zero, or chatbot UX.

Promise: **Tasks in, tasks out… without the rush.**

---

## Mental model (use these nouns in the CLI)

| Noun | Meaning |
|------|---------|
| **Desk** | Day timeline of open personal notes/tasks (`forDate = YYYY-MM-DD`) |
| **Note / task** | Same object (`posts`). Short line ≤255 chars; optional title, detail, tags, date, done, pin, draft, trash |
| **Thread note** | Comment under a task (personal desk). Agents treat these as executable items (`kind=thread_note`) |
| **Done** | Finished tasks (soft “done”; can reopen) |
| **Diary** | Calendar view of open + done across month / week / year |
| **Draft** | Background preset (`template: true`) — not on Desk; refills compose |
| **Trash** | Soft-deleted; restore or purge |
| **Group** | Shared desk: `+slug` public (anyone can join) or `-slug` private (invite-only) |
| **Hashtag** | `#tag` on notes; also used for agent “skills” |
| **Studio** | Power tools (organize day, import/export, integrations, agents, settings) |
| **Agent token** | `ailiak_…` PAT; API acts **as that user** |

CLI naming tip: prefer `ailiak desk`, `ailiak done`, `ailiak task …` over generic `todo` / `sprint` language.

---

## Auth & identity

- Sign-in: **email/password** or **Google**
- Profile: `displayName`, unique `handle` (`@…`, 3–20 chars `a-z0-9_`), `bio`, `photoURL`
- Guest mode (web only): local canvas on device; can import into account on first sign-in
- Handles are unique via `handles/{handle}`

**CLI auth (recommended):** do **not** reimplement Firebase Auth in the CLI unless necessary. Users create a personal access token in the web app (**Studio → Agents**); CLI uses `Authorization: Bearer ailiak_…` against the Agent API.

Group admins can also create **shareable group-scoped** tokens (MCP limited to that group).

---

## Core note / task model

Primary collection: `posts` (personal). Group tasks: `groups/{groupId}/posts`.

### Fields that matter for a CLI

| Field | Role |
|-------|------|
| `text` | Short line (max **255**) |
| `title` | Optional short title (compose `/title`, ≤80 via API) |
| `detail` | Optional longer body |
| `forDate` | `YYYY-MM-DD` or null (unscheduled) |
| `done` | Soft finish |
| `pinned` | Focus list (open tasks) |
| `template` | Draft / background preset (UI: `/draft`, `/tpl`) |
| `trashed` / `trashedAt` | Soft delete |
| `hashtags` | Tags without requiring `#` in storage |
| `taskNumber` | Optional ticket id (import/CSV) |
| `dayOrder` | Order within a day |
| `estimateSeconds` / `spentSeconds` | Planned vs logged time |
| `completedAt` | When marked done |
| `embedUrl` | Optional link embed |
| `groupId` / `groupKind` / `groupSlug` / owner fields | Group attachment |

Author denorm: `authorId`, `authorName`, `authorHandle`, …

### Lifecycle (product verbs)

1. **Create** — note/task on a day (default today) or unscheduled  
2. **Schedule / move** — set or clear `forDate`  
3. **Reorder** — `dayOrder` within a day (Studio → Organize day)  
4. **Pin** / unpin  
5. **Draft** — hide from Desk (`template`)  
6. **Finish** — `done: true`  
7. **Reopen** — `done: false`  
8. **Trash** → restore or permanent delete  

### Thread notes (comments)

Under a personal task: short replies. Compose supports `/spent` (add time) and `/done`. Agent API exposes them as `kind=thread_note` with ids like `c:parentId:commentId`.

---

## Surfaces in the web app (feature inventory)

### Desk (`/desk`)

- Day picker (prev/next; jump to today)
- Composer (slash commands, `#` tags, `+`/`-` groups)
- Day list of open items for `forDate`
- **Notice** banner: unfinished from earlier days / unscheduled → bring to today, park (unschedule), or trash
- Task actions: finish, pin, open thread, timer pin (if enabled)
- Guest canvas when signed out

### Done (`/done`)

- Finished tasks; time spent vs estimate summary
- Reopen back to Desk
- Search of own tasks (also via right rail)

### Diary (`/diary`)

- Month (default) / week / year
- Dots for days with tasks; open Desk for that day

### Hashtag (`/hashtag/:tag`)

- Filter notes by tag

### Profile (`/profile/:handle?`)

- Public-ish profile + notes; edit own display name / handle / bio
- Groups the user can access may appear

### Groups (`/:handle/+/slug` or `/:handle/-/slug`)

- Shared desk for that group
- Public (`+`): join freely; Private (`-`): invite / approve members
- Roles: `admin` | `member`; status: invited / pending / approved / denied
- Members create & finish group tasks
- Optional Web Push when others create/complete/reopen (not for own actions)
- Group AI agent tokens (admin)

### Studio

| Tool | Path | What it does |
|------|------|----------------|
| Hub / Explore | `/studio` | Studio entry |
| Organize day | `/studio/day` | Pick + drag order for a date; estimates vs workday budget |
| Drafts | `/studio/drafts` | Manage `/draft` presets |
| Import | `/studio/import` | CSV import |
| Export | `/studio/export` | Export tasks |
| Sync | `/studio/sync` | GitLab / GitHub sync helpers |
| GitLab | `/studio/gitlab` | Issues / MRs via Agent API proxy |
| GitHub | `/studio/github` | Issues / PRs via Agent API proxy |
| Integrations | `/studio/integrations` | Index of integrations |
| Agents | `/studio/agents` | Create/revoke PATs, token skills |
| Trash | `/studio/trash` | Restore / purge |
| Settings | `/studio/settings` | Org (layout, workday, timer, cleanup), appearance, notifications |
| Help | `/studio/help` | In-app manual |
| Week board | `/studio/board` | Placeholder (“soon”) |

### Secondary / ops

- Landing, Auth, Cookies, Privacy
- Admin (`/admin`) — owners only; not a CLI target for normal users

---

## Composer language (web → CLI parity)

Users type one field; slash commands parse into structured fields. A CLI can either accept structured flags **or** the same slash dialect.

| Command | Effect |
|---------|--------|
| `/title …` | Title until newline |
| `/help …` | Single-line details |
| `/details …` | Multi-line details (put last) |
| `/todo` | Schedule for **tomorrow** |
| `/from` / `/date` | Day: `today`, `tomorrow`, `MM-DD`, `yy-mm-dd`, `YYYY-MM-DD` |
| `/draft` / `/tpl` | Draft flag; optional name → title |
| `/estimate 1h 30m` | Planned duration |
| `/spent` / `/spend` | Logged duration |
| `/done` | Create already done |
| `#tag` | Hashtag |
| `+slug` / `-slug` | Attach to public/private group |

Parser source of truth: `src/utils/composeCommands.ts`.

---

## Settings (web; low priority for v1 CLI)

- Workday hours (budget for Organize day)
- Timer on/off (live pin + rail)
- Theme / accent / background / content width
- Desk/Done layout preferences
- Group push notification opt-in
- Cleanup / trash retention behavior

CLI v1 can ignore appearance; optionally expose timer logging as `/spent` equivalents.

---

## Existing remote API (build the CLI on this)

Base URL (production): **`https://api.ailiak.com`**

Auth: `Authorization: Bearer ailiak_<token>`

### MCP tools (primary task surface)

Endpoint: `POST/GET https://api.ailiak.com/mcp`

| Tool | CLI-shaped intent |
|------|-------------------|
| `get_skill` | Load token Init skill + hashtag skills (**call first**) |
| `whoami` | Show account + scope |
| `list_groups` | List accessible groups |
| `list_open_tasks` | List open desk tasks + thread notes (or group tasks); optional `forDate`, `tag` |
| `get_task` | Show one task / thread note |
| `create_task` | Add note/task (`text`, optional `title`, `detail`, `forDate`) |
| `set_task_date` | Schedule / unschedule |
| `mark_task_done` | Finish |
| `reopen_task` | Undo finish |
| `trash_task` | Soft-delete |

Token skills (`get_skill`):

- **Init skill** — short instructions for the agent/CLI session  
- **Hashtag skills** — `{ tag, description }[]` — prefer those tags when filtering

Scope:

- **Personal** token → personal desk (+ thread notes); `list_groups` for navigation  
- **Group** token → only that group’s tasks  

Details: [`agent-api/README.md`](../agent-api/README.md), types in `agent-api/src/types.ts`, tools in `agent-api/src/mcp.ts`.

### Other Agent API routes (usually not needed for CLI v1)

- Token CRUD / skills: `/v1/tokens…` (needs Firebase ID token from browser session)
- Group tokens: `/v1/groups/:groupId/tokens…`
- GitLab / GitHub CORS proxies (browser Studio)
- Group Web Push notify

---

## Suggested CLI command map (v1)

Align with MCP + product nouns. Example shape (illustrative):

```text
ailiak whoami
ailiak skill                 # get_skill
ailiak groups
ailiak desk [YYYY-MM-DD] [--tag TAG]
ailiak task show <id>
ailiak task add <text> [--title …] [--detail …] [--date YYYY-MM-DD|null]
ailiak task date <id> <YYYY-MM-DD|none>
ailiak task done <id>
ailiak task reopen <id>
ailiak task trash <id>
```

Nice-to-haves after v1 (web has them; API may need extension):

- Pin / unpin  
- Drafts list / import into compose  
- Done list / Diary ranges  
- Search own notes  
- Reorder day  
- Estimate / spent (and thread `/spent`)  
- CSV import/export  
- Group membership admin  
- Create group / join / invite  

If a feature is missing from MCP, either call out a gap in the Agent API or keep it web-only for now. Prefer extending the Worker over teaching the CLI to talk to Firestore with user credentials.

---

## Explicit non-goals for a calm CLI

- Hustle dashboards, streaks, gamification  
- Chatbot personality / “AI assistant” framing (agents are a quiet Studio tool)  
- Payment / plans (Spark / free only)  
- Replacing Studio GitLab/GitHub UI in v1  
- Using Firebase app domains in user-facing copy — prefer **ailiak.com** / **api.ailiak.com**

---

## Tone & copy

- Casual, light, human — “айляк” energy  
- Avoid: “crush your todos”, “inbox zero”, “productivity”, raw Firebase errors  
- Brand accent: `#169F84` (if the CLI ever prints color)

---

## Quick reference links

| What | URL |
|------|-----|
| Web app | https://ailiak.com |
| Desk | https://ailiak.com/desk |
| Agent API / MCP | https://api.ailiak.com/mcp |
| Create token | https://ailiak.com/studio/agents |

---

## Implementation notes for agents writing the CLI

1. **Data model first** — one Note/Task type with `forDate` + `done` + tags; groups are scopes, not a separate product.  
2. **Auth via PAT** — store `ailiak_…` in env / config (`AILIAK_TOKEN`); never commit secrets.  
3. **Call `get_skill` on start** when acting as an agent; honor Init + hashtag skills.  
4. **Dates** are calendar days `YYYY-MM-DD` (local day semantics in the web app).  
5. **255-char** short line limit matches UI + rules + API.  
6. **Thread notes** are first-class for agents (`c:…` ids); surface them clearly in `desk` / `list`.  
7. Extend **`agent-api`** when CLI needs pin, search, done-list, etc. — keep one backend.  
8. Keep help text short and calm; mirror Studio Help vocabulary (Desk, Done, Diary, Draft, Trash, Group).
