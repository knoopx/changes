import { appConfigPath, loadJsonConfig } from "adwaita-gpuix";
import { REVISION_FILTERS } from "./types";
import { createConfigWatcher, type RepoWatcher } from "./watch";
import type { Command } from "./commands";

export interface FilterDef {
  label: string;
  revset: string;
}

export interface ResolvedFilters {
  filters: ReadonlyArray<readonly [string, string]>;

  defaultIndex: number;
  commands: Command[];
}

export const DEFAULT_FILTER_LABEL = "Stack";

interface RawConfig {
  filters?: FilterDef[];
  defaultFilter?: string;
  commands?: Command[];
}

function defaultFilters(): ResolvedFilters {
  const filters = REVISION_FILTERS.map((f) => [f[0], f[1]] as const);
  const idx = filters.findIndex((f) => f[0] === DEFAULT_FILTER_LABEL);
  return { filters, defaultIndex: idx >= 0 ? idx : 0, commands: [] };
}

function resolveCommands(raw: RawConfig): Command[] {
  if (!Array.isArray(raw.commands)) return [];
  return raw.commands
    .filter(
      (c): c is Command =>
        !!c &&
        typeof c.id === "string" &&
        c.id.length > 0 &&
        Array.isArray(c.keys) &&
        c.keys.length > 0 &&
        c.keys.every(
          (k) =>
            typeof k === "string" ||
            (Array.isArray(k) && k.length > 0 && k.every((x) => typeof x === "string")),
        ) &&
        typeof c.cmd === "string" &&
        c.cmd.length > 0 &&
        Array.isArray(c.args) &&
        c.args.every((a) => typeof a === "string"),
    )
    .map((c) => ({ id: c.id, keys: c.keys, cmd: c.cmd, args: c.args }));
}

export function loadConfig(): ResolvedFilters {
  const raw = loadJsonConfig<RawConfig>(
    appConfigPath("changes", "GPUIX_CHANGES_CONFIG"),
  );

  if (!raw || typeof raw !== "object") return defaultFilters();

  let filters: ReadonlyArray<readonly [string, string]>;
  if (Array.isArray(raw.filters)) {
    filters = raw.filters
      .filter(
        (f): f is FilterDef =>
          !!f && typeof f.label === "string" && typeof f.revset === "string",
      )
      .map((f) => [f.label, f.revset] as const);
  } else {
    filters = REVISION_FILTERS.map((f) => [f[0], f[1]] as const);
  }

  if (filters.length === 0) return defaultFilters();

  const label = raw.defaultFilter ?? DEFAULT_FILTER_LABEL;
  const idx = filters.findIndex((f) => f[0] === label);
  return {
    filters,
    defaultIndex: idx >= 0 ? idx : 0,
    commands: resolveCommands(raw),
  };
}

const configListeners = new Set<() => void>();
let configWatcher: RepoWatcher | null = null;

export function onConfigChanged(fn: () => void): () => void {
  configListeners.add(fn);
  return () => {
    configListeners.delete(fn);
  };
}

export function startConfigWatcher(): void {
  if (configWatcher) return;
  configWatcher = createConfigWatcher(() => {
    for (const fn of configListeners) fn();
  });
}
