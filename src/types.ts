export interface Change {
  change_id: string;
  commit_id: string;
  description: string;
  author: string;
  timestamp: string;
  immutable: boolean;
  empty: boolean;
  has_conflicts: boolean;
  parents: string[];
}

export interface FileChange {
  status: "A" | "M" | "D";
  path: string;
  insertions: number;
  deletions: number;
}

export interface Bookmark {
  name: string;
  change_id: string;
  description: string;
  author: string;
  remote: string;
  reference: string;
}

export interface OpLogEntry {
  op_id: string;
  description: string;
}

export interface HunkRange {
  start: number;
  lines: number;
}

export interface HunkContext {
  pre: string;
  post: string;
}

export interface HunkBlock {
  index: number;
  id: string;
  type: string;
  removed: string;
  added: string;
  before: HunkRange;
  after: HunkRange;

  context?: HunkContext;
}

export interface FileHunks {
  path: string;
  status: string;
  hunks: HunkBlock[];
}

export interface HunkListResult {
  files: FileHunks[];
}

export interface FlatHunk {
  file_path: string;
  file_status: string;
  hunk: HunkBlock;
}

export const REVISION_FILTERS: ReadonlyArray<
  readonly [label: string, revset: string]
> = [
  ["All", "::"],
  ["Stack", "ancestors(@) ~ root()"],
  ["Mine", "mine()"],
  ["Tracked", "bookmarks()"],
  ["Recent", "committer_date(after:'30 days ago')"],
];

export type View =
  | { kind: "changes" }
  | { kind: "bookmarks" }
  | { kind: "oplog" }
  | { kind: "hunks"; changeId: string; filePath?: string }
  | { kind: "workspaces" };

import type { Shortcut } from "./shortcuts";

export interface ViewProps {
  navigate: (view: View) => void;

  onHints?: (hints: Shortcut[] | null) => void;
}
