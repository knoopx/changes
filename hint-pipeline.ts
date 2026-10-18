import { CHANGES_LEFT, hints, type Shortcut } from "./src/shortcuts";
import { resolveCommands } from "./src/config";
import { groupHints } from "adwaita-gpuix";
import { loadConfig } from "./src/config";

// simulate the ChangesView effect
const cfg = loadConfig();
const commands = cfg.commands;
console.log("loaded commands:", commands.map(c => c.id));

const base = CHANGES_LEFT;
const merged = base.map((s: any) => ({ ...s, kbds: [...s.kbds] }));
const byId = new Map(merged.map((s: any) => [s.id, s]));
for (const c of commands) {
  const existing = byId.get(c.id);
  if (existing) {
    existing.kbds.push(...c.keys);
  } else {
    const entry: Shortcut = { id: c.id, kbds: [...c.keys], desc: c.id, hint: true };
    byId.set(c.id, entry);
    merged.push(entry);
  }
}
const out = hints(merged);
console.log("hint count:", out.length);
for (const g of groupHints(out)) {
  console.log(`  ${g.desc}:`, JSON.stringify(g.kbds));
}
