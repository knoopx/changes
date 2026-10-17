import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { REVISION_FILTERS } from "./types";

export interface FilterDef {
  label: string;
  revset: string;
}

export interface ResolvedFilters {
  filters: ReadonlyArray<readonly [string, string]>;

  defaultIndex: number;
}

export const DEFAULT_FILTER_LABEL = "Stack";

export function configPath(): string {
  return (
    process.env.GPUIX_CHANGES_CONFIG ??
    join(homedir(), ".config", "changes", "config.json")
  );
}

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
  let raw: RawConfig | undefined;
  try {
    const path = configPath();
    if (existsSync(path)) {
      raw = JSON.parse(readFileSync(path, "utf8")) as RawConfig;
    }
  } catch {}

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
