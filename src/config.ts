import { appConfigPath, loadJsonConfig } from "adwaita-gpuix";
import { REVISION_FILTERS } from "./types";
import { createConfigWatcher, type RepoWatcher } from "./watch";

export interface FilterDef {
  label: string;
  revset: string;
}

export interface ResolvedFilters {
  filters: ReadonlyArray<readonly [string, string]>;

  defaultIndex: number;
}

export const DEFAULT_FILTER_LABEL = "Stack";

interface RawConfig {
  filters?: FilterDef[];
  defaultFilter?: string;
}

function defaultFilters(): ResolvedFilters {
  const filters = REVISION_FILTERS.map((f) => [f[0], f[1]] as const);
  const idx = filters.findIndex((f) => f[0] === DEFAULT_FILTER_LABEL);
  return { filters, defaultIndex: idx >= 0 ? idx : 0 };
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
  return { filters, defaultIndex: idx >= 0 ? idx : 0 };
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
