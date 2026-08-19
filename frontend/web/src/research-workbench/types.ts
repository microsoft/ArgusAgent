import type {
  ArtifactInfo,
  BacklogItem,
  ContinuousState,
  Daemon,
  EventMsg,
  GitDiffView,
  MissionDagNode,
  MissionView,
  ProjectRow,
  Role,
  Snapshot,
} from '../../../core/src/types';

export type {
  ArtifactInfo,
  BacklogItem,
  ContinuousState,
  Daemon,
  EventMsg,
  GitDiffView,
  MissionDagNode,
  MissionView,
  ProjectRow,
  Role,
  Snapshot,
};

export interface ProjectIndex {
  projects: ProjectRow[];
  local_cwd: string;
}

export interface StatusView {
  identity: string;
  backlog_pending: BacklogItem[];
  pending_questions: Array<Record<string, unknown>>;
  journal: JournalEntry[];
  continuous: ContinuousState;
  inbox_pending: number;
  daemon: Daemon;
  roles: Role[];
  active_role: string | null;
}

export interface Turn {
  ts: number;
  role: string;
  text: string;
}

export interface JournalEntry {
  id: string;
  ts: number;
  kind: string;
  title: string;
  summary: string;
  tags: string[];
  cost_usd?: number;
  extra?: Record<string, unknown>;
}

export interface PromptRewrite {
  original: string;
  rewritten: string;
  changes: string[];
  questions: string[];
  error: string;
}

export interface ManagerResult {
  kind?: string;
  reply?: string | null;
  item?: BacklogItem | null;
  daemon_alive?: boolean;
  [key: string]: unknown;
}

export type PageId =
  | 'overview'
  | 'experiments'
  | 'copilot'
  | 'literature'
  | 'inbox'
  | 'ide'
  | 'paper'
  | 'reviewer'
  | 'release';
