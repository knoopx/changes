

import { setJjMock } from "../repo";
import {
  DEMO,
  DEMO_BOOKMARKS,
  DEMO_CHANGES,
  DEMO_EVOLOG,
  DEMO_HUNKS,
  DEMO_OPS,
  DEMO_WORKSPACES,
  type DemoChange,
  type DemoWorkspace,
} from "./demoData";

interface MockResult {
  stdout: string;
  stderr: string;
  code: number;
}

const ok = (stdout: string): MockResult => ({ stdout, stderr: "", code: 0 });

function has(args: string[], token: string): boolean {
  return args.includes(token);
}

function flagValue(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}




function filePatches(whole: string): Map<string, string> {
  const map = new Map<string, string>();
  const chunks = whole
    .split(/^diff --git /m)
    .filter((c) => c.trim().length > 0);
  for (const chunk of chunks) {
    const header = chunk.split("\n")[0] ?? "";
    const target = header.split(" ").pop() ?? "";
    const path = target.startsWith("b/") ? target.slice(2) : target;
    if (!path) continue;
    map.set(path, `diff --git ${chunk}`);
  }
  return map;
}

function resolveChange(token: string): DemoChange | undefined {
  if (token === "@" || token.length === 0) return DEMO_CHANGES[0];
  return DEMO_CHANGES.find(
    (c) =>
      c.changeId === token ||
      c.commitId === token ||
      c.changeId.startsWith(token) ||
      c.commitId.startsWith(token),
  );
}

function patchForToken(token: string): string {
  return resolveChange(token)?.patch ?? "";
}

function workspaceFor(cwd?: string): DemoWorkspace | null {
  if (!cwd) return null;
  const marker = ".jj/workspaces/";
  const i = cwd.indexOf(marker);
  if (i < 0) return null;
  const name = cwd.slice(i + marker.length).split("/")[0];
  return DEMO_WORKSPACES.find((w) => w.name === name) ?? null;
}



function changesOut(): string {
  return DEMO_CHANGES.map(
    (c) =>
      [
        c.changeId,
        c.commitId,
        c.author,
        c.timestamp,
        String(c.immutable === true),
        c.description,
        String(c.empty === true),
        String(c.conflict === true),
        c.parents.join(","),
      ].join("\t") + "\n",
  ).join("");
}

function bookmarksOut(): string {
  const desc = (changeId: string): string =>
    DEMO_CHANGES.find((c) => c.changeId === changeId)?.description ?? "";
  return (
    DEMO_BOOKMARKS.map(
      (b) =>
        [b.name, b.changeId, b.remote, desc(b.changeId), b.author].join("\t") +
        "\n",
    ).join("") + "\n"
  );
}

function opLogOut(limit: number): string {
  return DEMO_OPS.slice(0, limit)
    .map((op) => `${op.opId}\t${op.description}\n`)
    .join("");
}

function workspaceOut(): string {
  return (
    DEMO_WORKSPACES.map(
      (w) => `${w.name}: ${w.changeId} ${w.commitId} ${w.description}\n`,
    ).join("") + "\n"
  );
}

function evologOut(token: string): string {
  const entries =
    DEMO_EVOLOG[token] ??
    DEMO_EVOLOG[DEMO.evologTarget] ??
    DEMO_EVOLOG[resolveChange(token)?.changeId ?? ""];
  if (!entries) return "";
  return (
    entries
      .map(
        (e) =>
          [e.commitId, e.description, e.author, e.timestamp].join("\t") + "\n",
      )
      .join("") + "\n"
  );
}

function hunkJson(token: string): string {
  return JSON.stringify(DEMO_HUNKS[token] ?? DEMO_HUNKS[DEMO.hunkTarget]);
}



function diffArgs(args: string[], cwd?: string): string {
  const ws = workspaceFor(cwd);
  const whole = ws ? ws.patch : patchForToken(flagValue(args, "-r") ?? "");
  if (whole.length === 0) return "";
  const path = args.find(
    (a, i) => i > 0 && !a.startsWith("-") && args[i - 1] !== "-r",
  );
  if (!path) return whole;
  return filePatches(whole).get(path) ?? "";
}

function jjMock(args: string[], cwd?: string): MockResult {
  const [head] = args;

  if (head === "log") {
    const template = flagValue(args, "-T") ?? "";
    if (template.includes("local_bookmarks")) return ok(DEMO.headerBookmarks);
    if (template.includes("divergent")) return ok(`${DEMO.workingCopy}\n`);
    if (template.includes("commit_id")) return ok(changesOut());
    return ok(`${DEMO.workingCopy}\n`);
  }

  if (head === "bookmark" && has(args, "list")) return ok(bookmarksOut());

  if (head === "operation" || (head === "op" && has(args, "log"))) {
    if (has(args, "diff")) {
      const op = DEMO_OPS.find((o) => o.opId === flagValue(args, "--op"));
      return ok(op?.diff ?? "");
    }
    if (has(args, "-n") && (flagValue(args, "-T") ?? "").startsWith("id ++"))
      return ok(`${DEMO_OPS[0].opId}\n`);
    return ok(opLogOut(Number(flagValue(args, "--limit") ?? 100)));
  }

  if (head === "evolog") return ok(evologOut(flagValue(args, "-r") ?? ""));

  if (head === "workspace" && has(args, "list")) return ok(workspaceOut());

  if (head === "diff" && has(args, "--git")) return ok(diffArgs(args, cwd));

  if (head === "file" && has(args, "show")) {
    const path = args[2] ?? "";
    const patch = filePatches(patchForToken(flagValue(args, "-r") ?? "")).get(
      path,
    );
    return ok((patch ?? "").split("\n").filter((l) => l.startsWith("+") && !l.startsWith("+++")).map((l) => l.slice(1)).join("\n"));
  }

  return ok("");
}

function jjHunkMock(args: string[]): MockResult {
  if (args[0] === "list") return ok(hunkJson(flagValue(args, "-r") ?? ""));
  return ok("");
}

let installed = false;

export function installDemoData(): void {
  if (installed) return;
  installed = true;
  setJjMock((binary, args, cwd) =>
    binary === "jj-hunk" ? jjHunkMock(args) : jjMock(args, cwd),
  );
}


export const demo = DEMO;
