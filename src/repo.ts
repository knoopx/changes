import { execFile, execSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { promisify } from "node:util";
import { dirname, isAbsolute, join, resolve } from "node:path";
import type {
  Bookmark,
  Change,
  FileChange,
  FlatHunk,
  HunkListResult,
  OpLogEntry,
} from "./types";

const pExecFile = promisify(execFile);

const JJ = "jj";
const JJ_HUNK = "jj-hunk";

const DEFAULT_CHANGE_REVSET = "::";

let cachedRoot: string | null = null;

function resolveStartupDir(): string | null {
  for (const arg of process.argv) {
    if (arg.startsWith("-")) continue;
    let dir = arg;
    if (dir === "~" || dir.startsWith("~/")) {
      dir = join(process.env.HOME ?? "", dir.slice(1));
    }
    if (!isAbsolute(dir)) dir = resolve(process.cwd(), dir);
    if (existsSync(dir) && statSync(dir).isDirectory()) return dir;
  }
  return null;
}

export function findWorkspaceRoot(cwd?: string): string {
  if (cachedRoot) return cachedRoot;
  const start = cwd ?? resolveStartupDir() ?? process.cwd();
  let dir = start;
  for (;;) {
    if (existsSync(join(dir, ".jj"))) {
      cachedRoot = dir;
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      cachedRoot = start;
      return cachedRoot;
    }
    dir = parent;
  }
}

interface CliResult {
  stdout: string;
  stderr: string;
  code: number;
}

async function runExternalBinary(
  binary: string,
  args: string[],
  cwd?: string,
): Promise<CliResult> {
  const root = cwd ?? findWorkspaceRoot();
  try {
    const { stdout, stderr } = await pExecFile(binary, args, {
      cwd: root,
      maxBuffer: 16 * 1024 * 1024,
    });
    return { stdout, stderr, code: 0 };
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string; code?: number };
    return {
      stdout: err.stdout ?? "",
      stderr: err.stderr ?? String(e),
      code: err.code ?? 1,
    };
  }
}

export async function jj(args: string[], cwd?: string): Promise<CliResult> {
  return runExternalBinary(JJ, args, cwd);
}

export async function jjHunk(args: string[], cwd?: string): Promise<CliResult> {
  return runExternalBinary(JJ_HUNK, args, cwd);
}

async function jjOk(args: string[], cwd?: string): Promise<string> {
  const res = await jj(args, cwd);
  if (res.code !== 0) {
    throw new Error(res.stderr.trim() || `jj ${args.join(" ")} failed`);
  }
  return res.stdout;
}

async function jjOkQuiet(args: string[], cwd?: string): Promise<string | null> {
  const res = await jj(args, cwd);
  if (res.code !== 0) return null;
  return res.stdout;
}

const CHANGES_TEMPLATE =
  'change_id ++ "\t" ++ commit_id ++ "\t" ++ author.name() ++ "\t" ++ ' +
  'author.timestamp().format("%Y-%m-%d %H:%M") ++ "\t" ++ ' +
  'coalesce(immutable, false) ++ "\t" ++ description.first_line() ++ ' +
  '"\t" ++ empty ++ "\t" ++ conflict ++ "\t" ++ ' +
  'parents.map(|p| p.commit_id()).join(",") ++ "\n"';

export function sanitizeDescription(raw: string): string {
  const ascii = raw.replace(/[^\u0000-\u007f]/g, "");
  const normalized = ascii.split(/\s+/).filter(Boolean).join(" ");
  return normalized.length > 0 ? normalized : "(no description)";
}

export async function loadChanges(revsetStr: string): Promise<Change[]> {
  const revset =
    revsetStr.trim().length > 0 ? revsetStr : DEFAULT_CHANGE_REVSET;
  const out = await jjOk([
    "log",
    "-r",
    revset,
    "--no-graph",
    "--color",
    "never",
    "-T",
    CHANGES_TEMPLATE,
  ]);
  const changes: Change[] = [];
  for (const line of out.split("\n")) {
    if (line.trim().length === 0) continue;
    const parts = line.split("\t");
    if (parts.length < 9) continue;
    const [
      change_id,
      commit_id,
      author,
      timestamp,
      immutable,
      desc,
      empty,
      has_conflicts,
      parentsRaw,
    ] = parts;
    changes.push({
      change_id,
      commit_id,
      description: sanitizeDescription(desc ?? ""),
      author: (author ?? "").trim(),
      timestamp: timestamp ?? "",

      immutable: immutable === "true",
      empty: empty === "true",
      has_conflicts: has_conflicts === "true",

      parents: (parentsRaw ?? "")
        .split(",")
        .filter((p) => p.length > 0 && !/^0+$/.test(p)),
    });
  }
  return changes;
}

export async function getCurrentChangeId(): Promise<string | null> {
  const out = await jjOkQuiet([
    "log",
    "-r",
    "@",
    "--no-graph",
    "--color",
    "never",
    "-T",
    'change_id ++ if(divergent, "/" ++ change_offset, "")',
  ]);
  const id = out?.trim() ?? "";
  return id.length > 0 ? id : null;
}

export async function getVcsLabel(): Promise<string | null> {
  let names = "";
  const out = await jjOkQuiet([
    "log",
    "-r",
    "ancestors(@, 50) & bookmarks()",
    "--no-graph",
    "--color",
    "never",
    "-n",
    "1",
    "-T",
    "local_bookmarks",
  ]);
  if (out && out.trim().length > 0) {
    names = out
      .replace(/[\[\]]/g, "")
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .join(", ");
  }
  const wcId = await getCurrentChangeId();
  const short8 = (wcId ?? "").slice(0, 8);
  const dirty =
    (await (await jj(["diff", "--git", "-r", "@"])).stdout.trim()).length > 0;
  const marker = dirty ? "*" : "";

  if (names.length > 0) return `${names}${marker}`;
  if (short8.length > 0) return `${short8}${marker}`;
  return null;
}

export const IMPLICIT_GIT_REMOTE = "git";

const BOOKMARKS_TEMPLATE =
  'name ++ "\t" ++ if(normal_target, normal_target.change_id(), "") ++ "\t" ++ remote ++ "\t" ++ ' +
  'if(normal_target, normal_target.description(), "") ++ "\t" ++ ' +
  'if(normal_target, normal_target.author().name(), "") ++ "\n"';

export async function listBookmarks(): Promise<Bookmark[]> {
  const out = await jjOk([
    "bookmark",
    "list",
    "--all-remotes",
    "--color",
    "never",
    "-T",
    BOOKMARKS_TEMPLATE,
  ]);
  const seen = new Set<string>();
  const bookmarks: Bookmark[] = [];
  for (const line of out.split("\n")) {
    if (line.trim().length === 0) continue;
    const [name, change_id, remote, description, author] = line.split("\t");
    if (!name) continue;
    if (remote === IMPLICIT_GIT_REMOTE) continue;
    const reference = remote ? `${remote}/${name}` : name;
    if (seen.has(reference)) continue;
    seen.add(reference);
    bookmarks.push({
      name,
      change_id: change_id ?? "",
      description: description ?? "",
      author: author ?? "",
      remote: remote ?? "",
      reference,
    });
  }
  return bookmarks;
}

export async function loadOpLog(limit = 100): Promise<OpLogEntry[]> {
  const out = await jjOk([
    "operation",
    "log",
    "--no-graph",
    "--color",
    "never",
    "-T",
    'id ++ "\t" ++ description ++ "\n"',
  ]);
  const entries: OpLogEntry[] = [];
  for (const line of out.split("\n")) {
    if (line.trim().length === 0) continue;
    const idx = line.indexOf("\t");
    if (idx < 0) continue;
    entries.push({
      op_id: line.slice(0, idx),
      description: line.slice(idx + 1),
    });
    if (entries.length >= limit) break;
  }
  return entries;
}

export async function getOpDiff(opId: string): Promise<string> {
  const res = await jj([
    "operation",
    "diff",
    "--op",
    opId,
    "--git",
    "--color",
    "never",
  ]);
  return res.code === 0 ? res.stdout : "";
}

export function splitOpDiff(raw: string): {
  header: string[];
  patch: string;
  footer: string[];
} {
  const lines = raw.split("\n");
  const first = lines.findIndex((l) => /^\s+diff --git/.test(l));
  if (first < 0)
    return {
      header: lines.filter((l) => l.trim().length > 0),
      patch: "",
      footer: [],
    };
  const indent = lines[first].length - lines[first].trimStart().length;
  let last = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].startsWith(" ")) {
      last = i;
      break;
    }
  }
  if (last < first) last = first;
  const deindent = (l: string) =>
    l.length >= indent && l.startsWith(" ".repeat(indent))
      ? l.slice(indent)
      : l;
  return {
    header: lines.slice(0, first).filter((l) => l.trim().length > 0),
    patch: lines
      .slice(first, last + 1)
      .map(deindent)
      .join("\n"),
    footer: lines.slice(last + 1).filter((l) => l.trim().length > 0),
  };
}

const changedFilesCache = new Map<string, FileChange[]>();
const rawDiffCache = new Map<string, string>();

export async function getOpHead(): Promise<string> {
  const out = await jjOkQuiet([
    "operation",
    "log",
    "-n",
    "1",
    "--no-graph",
    "--color",
    "never",
    "-T",
    'id ++ "\n"',
  ]);
  return (out ?? "").trim();
}

async function diffCacheKey(changeId: string): Promise<string> {
  return `${changeId}:${await getOpHead()}`;
}

export function extractDiffFiles(
  patch: string,
): Array<{ path: string; status: FileChange["status"] }> {
  const lines = patch.split("\n");
  const out: Array<{ path: string; status: FileChange["status"] }> = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith("diff --git")) continue;
    const token = line.split(" ")[3] ?? "";
    const path = token.startsWith("a/")
      ? token.slice(2)
      : token.startsWith("b/")
        ? token.slice(2)
        : token;
    if (!path) continue;
    let fromDevNull = false;
    let toDevNull = false;
    for (let j = i + 1; j < lines.length; j++) {
      const l = lines[j];
      if (l.startsWith("diff --git")) break;
      if (l.startsWith("--- ") && l.slice(4) === "/dev/null")
        fromDevNull = true;
      else if (l.startsWith("+++ ") && l.slice(4) === "/dev/null")
        toDevNull = true;
    }
    const status: FileChange["status"] = fromDevNull
      ? "A"
      : toDevNull
        ? "D"
        : "M";
    out.push({ path, status });
  }
  return out;
}

export async function loadChangedFiles(
  changeId: string,
): Promise<FileChange[]> {
  const key = await diffCacheKey(changeId);
  const cached = changedFilesCache.get(key);
  if (cached) return cached;

  const whole = (await jj(["diff", "--git", "-r", changeId])).stdout;
  const entries = extractDiffFiles(whole);
  const results = await mapConcurrent(entries, 8, async (entry) => {
    const out = (await jj(["diff", "--git", "-r", changeId, entry.path]))
      .stdout;
    const stat = filePatchStats(out);
    return {
      path: entry.path,

      status: entry.status,
      insertions: stat.insertions,
      deletions: stat.deletions,
    };
  });
  const files = results.sort((a, b) => a.path.localeCompare(b.path));
  changedFilesCache.set(key, files);
  return files;
}

interface FileStat {
  status: FileChange["status"];
  insertions: number;
  deletions: number;
}

export function filePatchStats(patch: string): FileStat {
  let insertions = 0;
  let deletions = 0;
  let fromDevNull = false;
  let toDevNull = false;
  for (const line of patch.split("\n")) {
    if (line.startsWith("--- ")) {
      if (line.slice(4) === "/dev/null") fromDevNull = true;
    } else if (line.startsWith("+++ ")) {
      if (line.slice(4) === "/dev/null") toDevNull = true;
    } else if (line.startsWith("+")) {
      insertions++;
    } else if (line.startsWith("-")) {
      deletions++;
    }
  }
  const status: FileChange["status"] = fromDevNull
    ? "A"
    : toDevNull
      ? "D"
      : "M";
  return { status, insertions, deletions };
}

export async function mapConcurrent<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      for (;;) {
        const i = next++;
        if (i >= items.length) break;
        results[i] = await fn(items[i]);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

export async function getRawDiff(
  changeId: string,
  filePath?: string,
): Promise<string> {
  const key = `${await diffCacheKey(changeId)}${filePath ? `:${filePath}` : ""}`;
  const cached = rawDiffCache.get(key);
  if (cached !== undefined) return cached;
  const args = ["diff", "--git", "-r", changeId];
  if (filePath) args.push(filePath);
  const out = (await jj(args)).stdout;
  rawDiffCache.set(key, out);
  return out;
}

export function jjHunkAvailable(): boolean {
  try {
    execSync(`command -v ${JJ_HUNK}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export async function loadHunks(changeId: string): Promise<HunkListResult> {
  const res = await jjHunk(["list", "--format", "json", "-r", changeId]);
  if (res.code !== 0)
    throw new Error(res.stderr.trim() || `jj-hunk list failed`);
  return JSON.parse(res.stdout) as HunkListResult;
}

export function flattenHunks(result: HunkListResult): FlatHunk[] {
  const flat: FlatHunk[] = [];
  for (const file of result.files) {
    for (const hunk of file.hunks) {
      flat.push({ file_path: file.path, file_status: file.status, hunk });
    }
  }
  return flat;
}

export function filterByFile(hunks: FlatHunk[], filePath: string): FlatHunk[] {
  return hunks.filter((h) => h.file_path === filePath);
}

export async function splitSelectedHunks(
  changeId: string,
  selections: Array<{ file_path: string; hunk_id: string }>,
  message?: string,
): Promise<void> {
  await runHunkSpec(changeId, selections, "keep", message);
}

export async function discardSelectedHunks(
  changeId: string,
  selections: Array<{ file_path: string; hunk_id: string }>,
): Promise<void> {
  await runHunkSpec(changeId, selections, "reset", "Discard selected hunks");
}

async function runHunkSplit(
  changeId: string,
  files: Record<string, { ids: string[] }>,
  defaultAction: "keep" | "reset",
  defaultMessage: string,
  message?: string,
): Promise<void> {
  const { tmpdir } = await import("node:os");
  const { writeFileSync, rmSync } = await import("node:fs");
  const spec = { files, default: defaultAction };
  const specPath = join(tmpdir(), `jj-hunk-spec-${process.pid}.json`);
  writeFileSync(specPath, JSON.stringify(spec));
  try {
    const msg = message ?? defaultMessage;

    const res = await jjHunk(["split", "-r", changeId, "-f", specPath, msg]);
    if (res.code !== 0) throw new Error(res.stderr.trim());
  } finally {
    rmSync(specPath, { force: true });
  }
}

async function runHunkSpec(
  changeId: string,
  selections: Array<{ file_path: string; hunk_id: string }>,
  defaultAction: "keep" | "reset",
  message?: string,
): Promise<void> {
  const files: Record<string, { ids: string[] }> = {};
  for (const sel of selections) {
    (files[sel.file_path] ??= { ids: [] }).ids.push(sel.hunk_id);
  }
  await runHunkSplit(
    changeId,
    files,
    defaultAction,
    `Split selected hunks from change ${changeId.slice(0, 8)}`,
    message,
  );
}

export async function updateStaleWorkspace(): Promise<void> {
  await jjOkQuiet(["workspace", "update-stale"]);
}

export async function newChange(changeId: string): Promise<string> {
  await jjOk(["new", changeId]);
  return `Created new change on ${changeId.slice(0, 8)}`;
}

export async function editChange(changeId: string): Promise<string> {
  await jjOk(["edit", changeId]);
  return `Set working copy to ${changeId.slice(0, 8)}`;
}

export async function abandonChange(changeId: string): Promise<string> {
  await jjOk(["abandon", changeId]);
  return `Abandoned change ${changeId.slice(0, 8)}`;
}

export async function splitChange(changeId: string): Promise<string> {
  await jjOk(["new", changeId]);
  return `Split change ${changeId.slice(0, 8)}`;
}

export async function splitFileChange(
  changeId: string,
  filePath: string,
): Promise<string> {
  const msg = `Moved ${filePath} from change ${changeId.slice(0, 8)} to a new change`;
  await jjOk([
    "split",
    "-m",
    msg,
    "-r",
    changeId,
    "--insert-after",
    changeId,
    filePath,
  ]);
  return msg;
}

async function parentChangeId(changeId: string): Promise<string | null> {
  const out = await jjOkQuiet([
    "log",
    "-r",
    changeId,
    "--no-graph",
    "--color",
    "never",
    "-T",
    'parents.map(|p| p.change_id()).join(",")',
  ]);
  const first = out?.split(",")[0]?.trim();
  return first && first.length > 0 ? first : null;
}

export async function squashChange(changeId: string): Promise<string> {
  const parent = await parentChangeId(changeId);
  if (!parent) throw new Error("Cannot squash root change (no parent)");
  await jjOk(["squash", "-u", "-r", changeId]);
  return "Squashed change into parent";
}

export async function revertChange(changeId: string): Promise<string> {
  await jjOk(["revert", changeId]);
  return `Reverted change ${changeId.slice(0, 8)}`;
}

export async function restoreFile(
  changeId: string,
  filePath: string,
): Promise<string> {
  await jjOk(["restore", "--changes-in", changeId, filePath]);
  return `Restored file '${filePath}'`;
}

export async function setBookmarkToChange(
  bookmarkName: string,
  changeId: string,
): Promise<string> {
  const name = bookmarkName.split("@")[0]!.trim();
  if (!name) throw new Error("Bookmark name is required");
  await jjOk(["bookmark", "set", "--allow-backwards", name, "-r", changeId]);
  return `Set bookmark '${name}' to ${changeId.slice(0, 8)}`;
}

export async function forgetBookmark(bookmarkRef: string): Promise<string> {
  const name = bookmarkRef.split("@")[0]!.trim();
  if (!name) return "";
  await jjOk(["bookmark", "forget", "--include-remotes", name]);
  return `Forgot bookmark '${name}'`;
}

export async function pushBookmarks(names: string[]): Promise<void> {
  for (const name of names) {
    await jjOk(["git", "push", "-b", name]);
  }
}

export async function gitFetch(): Promise<void> {
  await jjOk(["git", "fetch"]);
}

export async function undoOp(): Promise<string> {
  await jjOk(["undo"]);
  return "Undid operation";
}

export async function redoOp(): Promise<string> {
  await jjOk(["redo"]);
  return "Redid operation";
}

export async function restoreOp(opId: string): Promise<string> {
  await jjOk(["op", "restore", opId]);
  return `Restored to operation ${opId.slice(0, 8)}`;
}

export async function absorbChange(changeId: string): Promise<string> {
  await jjOk(["absorb", "-f", changeId]);
  return `Absorbed change ${changeId.slice(0, 8)}`;
}



export interface EvologEntry {
  commit_id: string;
  description: string;
  author: string;
  timestamp: string;
}

const EVOLONG_TEMPLATE =
  'commit.commit_id() ++ "\t" ++ commit.description().first_line() ++ "\t" ++ ' +
  'commit.author().name() ++ "\t" ++ ' +
  'commit.author().timestamp().format("%Y-%m-%d %H:%M:%S") ++ "\n"';

export async function loadEvolog(
  changeId: string,
  limit = 50,
): Promise<EvologEntry[]> {
  const out = await jjOk([
    "evolog",
    "-r",
    changeId,
    "-n",
    String(limit),
    "--no-graph",
    "--color",
    "never",
    "-T",
    EVOLONG_TEMPLATE,
  ]);
  const entries: EvologEntry[] = [];
  for (const line of out.split("\n")) {
    if (line.trim().length === 0) continue;
    const parts = line.split("\t");
    if (parts.length < 4) continue;
    entries.push({
      commit_id: parts[0] ?? "",
      description: sanitizeDescription(parts[1] ?? ""),
      author: (parts[2] ?? "").trim(),
      timestamp: parts[3] ?? "",
    });
  }
  return entries;
}


export async function getEvologDiff(commitId: string): Promise<string> {
  const res = await jj(["diff", "--git", "-r", commitId]);
  return res.code === 0 ? res.stdout : "";
}



export interface RestoreHunk {
  index: number;
  
  postStart: number;
  
  postLines: number;
  
  preLines: string[];
  
  label: string;
}


export function parseRestoreHunks(patch: string): RestoreHunk[] {
  const lines = patch.split("\n");
  
  
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  const hunks: RestoreHunk[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(
      lines[i] ?? "",
    );
    if (!m) continue;
    const postStart = parseInt(m[3] ?? "1", 10);
    const postLines =
      m[4] !== undefined ? parseInt(m[4], 10) : postStart > 0 ? 1 : 0;
    const preLines: string[] = [];
    let j = i + 1;
    while (j < lines.length) {
      const l = lines[j] ?? "";
      if (l.startsWith("diff --git") || l.startsWith("@@")) break;
      if (l.startsWith("-")) preLines.push(l.slice(1));
      else if (l.startsWith(" ") || l === "") preLines.push(l.slice(1));
      else if (l.startsWith("+")) {
        
      }
      j++;
    }
    hunks.push({
      index: hunks.length,
      postStart,
      postLines,
      preLines,
      label: `${postStart}:${postLines}`,
    });
    i = j - 1;
  }
  return hunks;
}

export async function getFileRestoreHunks(
  changeId: string,
  filePath: string,
): Promise<RestoreHunk[]> {
  const patch = (await jj(["diff", "--git", "-r", changeId, filePath]))
    .stdout;
  return parseRestoreHunks(patch);
}


export async function getFileContentAt(
  changeId: string,
  filePath: string,
): Promise<string> {
  const out = await jjOk(["file", "show", filePath, "-r", changeId]);
  return out;
}


export function buildRestoredContent(
  current: string,
  selected: RestoreHunk[],
): string {
  const lines = current.split("\n");
  const ordered = [...selected].sort(
    (a, b) => b.postStart - a.postStart || b.postLines - a.postLines,
  );
  for (const h of ordered) {
    const start = h.postStart - 1;
    const end = h.postLines > 0 ? start + h.postLines : start;
    lines.splice(start, end - start, ...h.preLines);
  }
  return lines.join("\n");
}


export async function applyRestoreHunks(
  changeId: string,
  filePath: string,
  selected: RestoreHunk[],
): Promise<string> {
  const current = await getFileContentAt(changeId, filePath);
  const next = buildRestoredContent(current, selected);
  const root = findWorkspaceRoot();
  const target = join(root, filePath);
  mkdirSync(dirname(target), { recursive: true });
  const { writeFileSync } = await import("node:fs");
  writeFileSync(target, next);
  await jjOkQuiet(["util", "snapshot"]);
  return `Restored ${selected.length} hunk(s) of '${filePath}'`;
}

export async function rebaseChange(
  changeId: string,
  targetChangeId: string,
  after: boolean,
): Promise<string> {
  let onto = targetChangeId;
  if (!after) {
    const parent = await parentChangeId(targetChangeId);
    if (!parent) throw new Error("Target change has no parent");
    onto = parent;
  }
  await jjOk(["rebase", "-r", changeId, "-o", onto]);
  return `Rebased change ${changeId.slice(0, 8)}`;
}

export { readFileSync };

export interface WorkspaceEntry {
  name: string;
  changeId: string;
  description: string;
  path: string;
  isDefault: boolean;
  status: "running" | "idle" | "completed";
}

export interface WorkspaceFile {
  path: string;
  status: FileChange["status"];
  insertions: number;
  deletions: number;
}

export async function tmuxSessionStatus(
  name: string,
): Promise<"running" | "idle" | "completed"> {
  try {
    await pExecFile("tmux", ["has", "-t", name]);
  } catch {
    return "completed";
  }
  try {
    const { stdout } = await pExecFile("tmux", [
      "list-panes",
      "-t",
      name,
      "-F",
      "#{pane_current_command}",
    ]);
    const cmd = stdout.trim();
    return cmd.includes("pi") || cmd.includes("node") || cmd.includes("bun")
      ? "running"
      : "idle";
  } catch {
    return "completed";
  }
}

export async function listWorkspaces(): Promise<WorkspaceEntry[]> {
  const root = findWorkspaceRoot();
  const out = await jjOk(["workspace", "list"]);
  const entries: WorkspaceEntry[] = [];
  for (const line of out.split("\n")) {
    if (line.trim().length === 0) continue;
    const m = /^(\S+):\s+(\S+)\s*(.*)$/.exec(line);
    if (!m) continue;
    const name = m[1];
    const isIde = name.startsWith("ide-");
    entries.push({
      name,
      changeId: m[2],
      description: sanitizeDescription(m[3] ?? ""),
      path: join(root, ".jj", "workspaces", name),
      isDefault: name === "default",

      status: isIde ? await tmuxSessionStatus(name) : "completed",
    });
  }
  return entries;
}

export async function createWorkspace(description: string): Promise<string> {
  const root = findWorkspaceRoot();
  const name = `ide-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const path = join(root, ".jj", "workspaces", name);
  mkdirSync(dirname(path), { recursive: true });
  await jjOk([
    "workspace",
    "add",
    path,
    "--name",
    name,
    "-r",
    "@",
    "-m",
    description,
  ]);
  return name;
}

export function spawnDetached(cmd: string, args: string[]): void {
  const child = spawn(cmd, args, { detached: true, stdio: "ignore" });
  child.unref();
}

export async function forgetWorkspace(name: string): Promise<string> {
  spawnDetached("tmux", ["kill-session", "-t", name]);
  await jjOk(["workspace", "forget", name]);
  rmSync(join(findWorkspaceRoot(), ".jj", "workspaces", name), {
    recursive: true,
    force: true,
  });
  return `Deleted workspace ${name}`;
}

export async function loadWorkspaceFiles(
  name: string,
): Promise<WorkspaceFile[]> {
  const wsPath = join(findWorkspaceRoot(), ".jj", "workspaces", name);
  const whole = (await jj(["diff", "--git", "-r", "@"], wsPath)).stdout;
  const entries = extractDiffFiles(whole);
  const results = await mapConcurrent(entries, 8, async (entry) => {
    const out = (await jj(["diff", "--git", "-r", "@", entry.path], wsPath))
      .stdout;
    const stat = filePatchStats(out);
    return {
      path: entry.path,
      status: entry.status,
      insertions: stat.insertions,
      deletions: stat.deletions,
    };
  });
  return results.sort((a, b) => a.path.localeCompare(b.path));
}

export async function getWorkspaceDiff(
  name: string,
  filePath?: string,
): Promise<string> {
  const wsPath = join(findWorkspaceRoot(), ".jj", "workspaces", name);
  const args = ["diff", "--git", "-r", "@"];
  if (filePath) args.push(filePath);
  return (await jj(args, wsPath)).stdout;
}

export async function discardWorkspaceFile(
  name: string,
  filePath: string,
): Promise<string> {
  const wsPath = join(findWorkspaceRoot(), ".jj", "workspaces", name);
  await jjOk(["restore", "--changes-in", `${name}@`, filePath], wsPath);
  return `Restored file '${filePath}' in ${name}`;
}

export async function rebaseWorkspace(name: string): Promise<string> {
  await jjOk(["rebase", "-s", `${name}@`, "-o", "@"]);
  await jjOk(["squash", "-u", "-r", `${name}@`]);
  return `Rebased & squashed ${name} into working copy`;
}

export function openInEditor(path: string): void {
  spawnDetached(process.env.EDITOR ?? "vi", [path]);
}

export async function describeChange(
  changeId: string,
  message: string,
): Promise<string> {
  await jjOk(["describe", "-r", changeId, "-m", message]);
  return `Described change ${changeId.slice(0, 8)}`;
}

export function openFileInEditor(filePath: string): void {
  spawnDetached(process.env.EDITOR ?? "vi", [
    join(findWorkspaceRoot(), filePath),
  ]);
}

export function openTerminal(name: string, path: string): void {
  const shell = process.env.SHELL ?? "bash";
  try {
    execSync("command -v wezterm", { stdio: "ignore" });
    spawnDetached("wezterm", ["start", "--cwd", path, "--", shell]);
    return;
  } catch {}
  try {
    execSync("command -v tmux", { stdio: "ignore" });
    spawnDetached("tmux", [
      "new-session",
      "-d",
      "-s",
      `changes-${name}`,
      "-c",
      path,
      shell,
    ]);
    return;
  } catch {}
  throw new Error("No terminal available (install wezterm or tmux)");
}

export async function attachWorkspace(name: string): Promise<void> {
  if (process.env.TMUX) {
    spawnDetached("tmux", ["switch-client", "-t", name]);
    return;
  }
  try {
    execSync("command -v wezterm", { stdio: "ignore" });
    spawnDetached("wezterm", ["start", "--", "tmux", "attach", "-t", name]);
    return;
  } catch {}
  spawnDetached("tmux", ["attach", "-t", name]);
}
