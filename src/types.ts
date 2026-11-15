/** Desk task or thread note — mirrors Agent API summarizeTask. */
export type TaskKind = 'task' | 'thread_note';

export type TaskSummary = {
  id: string;
  kind: TaskKind;
  title: string | null;
  text: string;
  detail: string | null;
  forDate: string | null;
  done: boolean;
  pinned: boolean;
  taskNumber: string | null;
  estimateSeconds: number;
  spentSeconds: number;
  hashtags: string[];
  createdAt: string | null;
  completedAt: string | null;
  embedUrl: string | null;
  parentId: string | null;
  parentText: string | null;
  groupId: string | null;
  /** Present on get_task for personal desk tasks (thread under the card). */
  notes?: TaskSummary[];
};

/** Last `ailiak desk` listing — maps day # / ticket # → task id. */
export type DeskIndexEntry = {
  n: number;
  id: string;
  taskNumber: string | null;
  title: string | null;
  text: string;
};

export type DeskIndex = {
  forDate: string | null;
  tag: string | null;
  updatedAt: string;
  entries: DeskIndexEntry[];
};

export type GroupSummary = {
  id: string;
  kind: 'public' | 'private';
  slug: string;
  ownerId: string;
  ownerHandle: string;
  role: string;
  tag: string;
};

export type Whoami = {
  uid: string;
  email: string | null;
  displayName: string;
  handle: string | null;
  token: {
    tokenId: string;
    label: string;
    scope: 'personal' | 'group';
    shareable: boolean;
  };
  group: {
    groupId: string;
    groupKind: 'public' | 'private';
    groupSlug: string;
    groupOwnerId: string;
    groupOwnerHandle: string;
    tag: string;
  } | null;
  skill: {
    instructions: string;
    hashtagSkills: { tag: string; description: string }[];
    hashtags: string[];
  };
};

export type SkillPayload = {
  tokenId: string;
  label: string;
  scope: 'personal' | 'group';
  group: Record<string, unknown> | null;
  initSkill: string;
  instructions: string;
  hashtagSkills: { tag: string; description: string }[];
  hashtags: string[];
  tip: string;
};

export type GithubConfig = {
  token?: string;
  repo?: string;
  baseUrl?: string;
};

export type GitlabConfig = {
  token?: string;
  project?: string;
  baseUrl?: string;
};

export type TimerState = {
  taskId: string;
  startedAt: string;
};

export type CliConfig = {
  token?: string;
  apiUrl?: string;
  github?: GithubConfig;
  gitlab?: GitlabConfig;
  timer?: TimerState | null;
  deskIndex?: DeskIndex | null;
};
