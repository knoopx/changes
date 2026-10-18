

export interface RevsetFunction {
  name: string;
  
  signature: string;
  description: string;
}

export const REVSET_FUNCTIONS: RevsetFunction[] = [
  {
    name: "ancestors",
    signature: "ancestors(revisions, depth)",
    description: "Revisions that are ancestors of the given revisions",
  },
  {
    name: "descendants",
    signature: "descendants(revisions, depth)",
    description: "Revisions that are descendants of the given revisions",
  },
  {
    name: "connected",
    signature: "connected(revisions)",
    description: "Revisions directly connected to the given revisions (parents/children)",
  },
  {
    name: "files",
    signature: "files(globs...)",
    description: "Revisions that modified the given file paths (globs)",
  },
  {
    name: "bookmarks",
    signature: "bookmarks(patterns...)",
    description: "Revisions pointed to by bookmarks (optionally matching a pattern)",
  },
  {
    name: "local_bookmarks",
    signature: "local_bookmarks(patterns...)",
    description: "Revisions pointed to by local bookmarks",
  },
  {
    name: "remote_bookmarks",
    signature: "remote_bookmarks(remote, patterns...)",
    description: "Revisions pointed to by bookmarks on a remote",
  },
  {
    name: "git_refs",
    signature: "git_refs(patterns...)",
    description: "Revisions pointed to by git refs",
  },
  {
    name: "git_ref",
    signature: "git_ref(name)",
    description: "Revision pointed to by a specific git ref",
  },
  {
    name: "tags",
    signature: "tags(patterns...)",
    description: "Revisions pointed to by tags",
  },
  {
    name: "mine",
    signature: "mine()",
    description: "Revisions authored by the current user",
  },
  {
    name: "authors",
    signature: "authors(name_or_email)",
    description: "Revisions authored by the given author",
  },
  {
    name: "committers",
    signature: "committers(name_or_email)",
    description: "Revisions committed by the given committer",
  },
  {
    name: "description",
    signature: "description(patterns...)",
    description: "Revisions whose description matches the patterns",
  },
  {
    name: "commit_id",
    signature: "commit_id(patterns...)",
    description: "Revisions whose commit id matches the patterns",
  },
  {
    name: "change_id",
    signature: "change_id(patterns...)",
    description: "Revisions whose change id matches the patterns",
  },
  {
    name: "author_date",
    signature: "author_date(from, to)",
    description: "Revisions with an author date in the range (e.g. '2024-01-01')",
  },
  {
    name: "committer_date",
    signature: "committer_date(from, to)",
    description: "Revisions with a committer date in the range (e.g. '30 days ago')",
  },
  {
    name: "head",
    signature: "head(revisions)",
    description: "Revisions in the set that are not ancestors of other revisions in the set",
  },
  {
    name: "heads",
    signature: "heads(revisions)",
    description: "Alias of head()",
  },
  {
    name: "root",
    signature: "root(revisions)",
    description: "Revisions in the set that have no ancestors in the set",
  },
  {
    name: "roots",
    signature: "roots(revisions)",
    description: "Alias of root()",
  },
  {
    name: "trunk",
    signature: "trunk()",
    description: "The configured trunk revision (default: git HEAD)",
  },
  {
    name: "working_copies",
    signature: "working_copies()",
    description: "Working-copy revisions of all workspaces",
  },
  {
    name: "mutable",
    signature: "mutable()",
    description: "Mutable revisions",
  },
  {
    name: "immutable",
    signature: "immutable()",
    description: "Immutable revisions",
  },
  {
    name: "independent",
    signature: "independent()",
    description: "Revisions not connected to any other revision (orphans)",
  },
  {
    name: "divergent",
    signature: "divergent()",
    description: "Revisions whose change id has diverged (multiple commits)",
  },
  {
    name: "hidden",
    signature: "hidden()",
    description: "Hidden revisions",
  },
  {
    name: "conflict",
    signature: "conflict()",
    description: "Revisions containing conflicts",
  },
  {
    name: "divisible",
    signature: "divisible()",
    description: "Revisions that can be split into two non-empty revisions",
  },
  {
    name: "empty",
    signature: "empty()",
    description: "Revisions with no diff against their parent",
  },
  {
    name: "latest",
    signature: "latest(revisions)",
    description: "The most recent revision in the set",
  },
  {
    name: "earliest",
    signature: "earliest(revisions)",
    description: "The oldest revision in the set",
  },
  {
    name: "first",
    signature: "first(revisions, count)",
    description: "The first N revisions of the set (topologically)",
  },
  {
    name: "last",
    signature: "last(revisions, count)",
    description: "The last N revisions of the set (topologically)",
  },
  {
    name: "search",
    signature: "search(patterns...)",
    description: "Revisions matching the search patterns (description, ids, authors...)",
  },
  {
    name: "visible",
    signature: "visible()",
    description: "Visible (non-hidden) revisions",
  },
  {
    name: "all",
    signature: "all()",
    description: "All revisions in the repository",
  },
  {
    name: "none",
    signature: "none()",
    description: "No revisions",
  },
];


export const REVSET_KEYWORDS: ReadonlyArray<readonly [name: string, hint: string]> = [
  ["@", "working copy"],
  ["@-", "parent of working copy"],
  ["@~5", "5th ancestor of working copy"],
  ["::", "all revisions (::)"],
  ["..", "range between revisions"],
  ["~", "set difference"],
  ["&", "intersection"],
  ["|", "union"],
  ["!", "negation"],
  ["#", "comment to end of line"],
];

export interface RevsetCandidate {
  
  insert: string;
  
  label: string;
  
  detail?: string;
  
  kind: "filter" | "function" | "keyword" | "bookmark" | "change" | "file";
}

export interface RevsetContext {
  
  filters: ReadonlyArray<readonly [string, string]>;
  bookmarkNames: string[];
  changeIds: string[];
  filePaths: string[];
}


export function completeRevset(
  input: string,
  ctx: RevsetContext,
): RevsetCandidate[] {
  const trimmed = input.trimEnd();
  const openParen = /\($/.test(trimmed);
  
  const m = /([A-Za-z0-9_@.:/-]+)$/.exec(trimmed);
  const word = m?.[1] ?? "";

  
  if (openParen) {
    const funcName = word || trimmed.slice(0, -1).trim().split(/[\s|&~()]+/).pop();
    const fn = REVSET_FUNCTIONS.find((f) => f.name === funcName);
    const out: RevsetCandidate[] = [];
    if (fn?.name === "bookmarks" || fn?.name === "local_bookmarks") {
      for (const b of ctx.bookmarkNames) out.push({ insert: `'${b}'`, label: b, detail: "bookmark", kind: "bookmark" });
    } else if (fn?.name === "files") {
      for (const f of ctx.filePaths) out.push({ insert: `'${f}'`, label: f, detail: "file glob", kind: "file" });
    } else if (fn && (fn.name === "author_date" || fn.name === "committer_date")) {
      out.push({ insert: "'30 days ago'", label: "'30 days ago'", detail: "relative date", kind: "keyword" });
      out.push({ insert: "'2024-01-01'", label: "'2024-01-01'", detail: "absolute date", kind: "keyword" });
    }
    if (out.length === 0) {
      out.push({ insert: ")", label: ")", detail: "close arguments", kind: "keyword" });
    }
    return out.slice(0, 12);
  }

  if (word.length === 0) {
    
    const out: RevsetCandidate[] = ctx.filters.map((f) => ({
      insert: f[1],
      label: f[0],
      detail: f[1],
      kind: "filter" as const,
    }));
    for (const [name, hint] of REVSET_KEYWORDS)
      out.push({ insert: name, label: name, detail: hint, kind: "keyword" });
    for (const f of REVSET_FUNCTIONS.slice(0, 10))
      out.push({ insert: f.name + "(", label: f.signature, detail: f.description, kind: "function" });
    return out.slice(0, 12);
  }

  const q = word.toLowerCase();
  const out: RevsetCandidate[] = [];
  for (const f of REVSET_FUNCTIONS)
    if (f.name.toLowerCase().startsWith(q))
      out.push({ insert: f.name + "(", label: f.signature, detail: f.description, kind: "function" });
  for (const [name, hint] of REVSET_KEYWORDS)
    if (name.toLowerCase().startsWith(q))
      out.push({ insert: name, label: name, detail: hint, kind: "keyword" });
  for (const b of ctx.bookmarkNames)
    if (b.toLowerCase().startsWith(q))
      out.push({ insert: `bookmark('${b}')`, label: b, detail: "bookmark", kind: "bookmark" });
  for (const c of ctx.changeIds)
    if (c.toLowerCase().startsWith(q) && c.length <= 12)
      out.push({ insert: c, label: c, detail: "change id", kind: "change" });
  return out.slice(0, 12);
}


export function revsetSignatureHelp(
  input: string,
): { signature: string; description: string } | null {
  const trimmed = input.trimEnd();
  const m = /([A-Za-z0-9_]+)\($/.exec(trimmed);
  if (!m) return null;
  const fn = REVSET_FUNCTIONS.find((f) => f.name === m[1]);
  return fn ? { signature: fn.signature, description: fn.description } : null;
}
