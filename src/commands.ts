import { spawnDetached } from "./repo";
import { bindingMatches, type Kbd, type KeyMods } from "./shortcuts";

export interface Command {
  id: string;

  keys: Kbd[];

  cmd: string;

  args: string[];
}

export function findCommandBinding(
  commands: Command[],
  key: string,
  mods: KeyMods = {},
): Command | null {
  let best: Command | null = null;
  let bestScore = -1;
  for (const c of commands) {
    for (const b of c.keys) {
      if (!bindingMatches(b, key, mods)) continue;
      const score = (Array.isArray(b) ? b : [b]).length - 1;
      if (score > bestScore) {
        best = c;
        bestScore = score;
      }
    }
  }
  return best;
}

export function runCommand(
  cmd: Command,
  ctx: { root: string; change: string; changes: string[] },
): void {
  const args = cmd.args.map((a) =>
    a
      .split("{root}")
      .join(ctx.root)
      .split("{change}")
      .join(ctx.change)
      .split("{changes}")
      .join(ctx.changes.join(" ")),
  );
  spawnDetached(cmd.cmd, args);
}
