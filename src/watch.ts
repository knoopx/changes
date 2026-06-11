import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export interface RepoWatcher {
  stop(): void;
}

const POLL_MS = 1500;
const DEBOUNCE_MS = 300;

interface Target {
  path: string;
  kind: "file" | "dir";
}

function sample(t: Target): string | number | null {
  try {
    return t.kind === "file"
      ? readFileSync(t.path, "utf8")
      : statSync(t.path).mtimeMs;
  } catch {
    return null;
  }
}

export function createRepoWatcher(
  workspaceRoot: string,
  onChange: () => void,
): RepoWatcher {
  const repo = join(workspaceRoot, ".jj", "repo");
  const opHeadFile = join(repo, "op_head");
  const opMetaHead = join(repo, "op_meta", "head");
  const opHeadsDir = join(repo, "op_heads", "heads");

  let target: Target;
  if (existsSync(opHeadFile)) target = { path: opHeadFile, kind: "file" };
  else if (existsSync(opMetaHead)) target = { path: opMetaHead, kind: "file" };
  else if (existsSync(opHeadsDir)) target = { path: opHeadsDir, kind: "dir" };
  else target = { path: repo, kind: "dir" };

  let lastSeen: string | number | null = null;
  let baseline = false;
  let stopped = false;
  let debounce: ReturnType<typeof setTimeout> | null = null;

  const tick = () => {
    const v = sample(target);
    if (v === null) return;
    if (!baseline) {
      baseline = true;
      lastSeen = v;
      return;
    }
    if (v === lastSeen) return;
    lastSeen = v;
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(() => {
      debounce = null;
      if (!stopped) onChange();
    }, DEBOUNCE_MS);
  };

  const interval = setInterval(tick, POLL_MS);
  tick();

  return {
    stop() {
      stopped = true;
      clearInterval(interval);
      if (debounce) {
        clearTimeout(debounce);
        debounce = null;
      }
    },
  };
}
