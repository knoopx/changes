const TABULAR_EXTENSIONS = new Set(["csv", "tsv", "tab"]);

export function isTabularPath(path: string): boolean {
  const dot = path.lastIndexOf(".");
  if (dot < 0) return false;
  return TABULAR_EXTENSIONS.has(path.slice(dot + 1).toLowerCase());
}

export type TabularDelim = "\t" | "," | ";" | "|";

const DELIM_CANDIDATES: TabularDelim[] = ["\t", ",", ";", "|"];

function countDelim(line: string, d: string): number {
  let n = 0;
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQ = !inQ;
    else if (!inQ && ch === d) n++;
  }
  return n;
}

export function detectDelim(text: string): TabularDelim | null {
  const lines = text
    .split("\n")
    .slice(0, 200)
    .filter((l) => l.trim().length > 0);
  if (lines.length < 2) return null;
  let best: TabularDelim | null = null;
  let bestScore = 0;
  for (const d of DELIM_CANDIDATES) {
    const counts = lines.map((l) => countDelim(l, d));
    if (counts.every((c) => c === 0)) continue;
    const mode = counts.reduce((m, c) => (c > (m as number) ? c : m), 0);

    if (mode < 1) continue;
    const score = counts.filter((c) => c === mode).length;
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  if (best === null) return null;
  if (bestScore < Math.max(2, Math.ceil(lines.length * 0.6))) return null;
  return best;
}

export function parseTable(text: string, delim: string): string[][] | null {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQ = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"' && field === "") {
      inQ = true;
    } else if (ch === delim) {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else if (ch !== "\r") {
      field += ch;
    }
  }
  row.push(field);
  rows.push(row);
  return validateParsedRows(rows);
}

function validateParsedRows(rows: string[][]): string[][] | null {
  if (
    rows.length > 0 &&
    rows[rows.length - 1].length === 1 &&
    rows[rows.length - 1][0] === ""
  )
    rows.pop();
  if (rows.length === 0) return null;

  const counts = rows.map((r) => r.length);
  const mode = counts.reduce((m, c) => (c > (m as number) ? c : m), 0);
  if (mode < 2) return null;
  const ok = rows.filter((r) => Math.abs(r.length - mode) <= 1).length;
  if (ok < Math.ceil(rows.length * 0.6)) return null;
  return rows;
}

export interface PatchSides {
  old: string[];

  next: string[];
}

const PATCH_HEADER_PREFIXES = [
  "diff --git",
  "--- ",
  "+++ ",
  "index ",
  "new file mode",
  "deleted file mode",
  "old mode",
  "new mode",
  "similarity index",
  "rename from",
  "rename to",
  "Binary files",
  "GIT binary patch",
  "@@",
];

function findPatchStart(lines: string[], path?: string): number {
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith("diff --git")) continue;
    const b = lines[i].split(" ")[3] ?? "";
    const p = b.startsWith("b/") ? b.slice(2) : b;
    if (!path || p === path) return i;
  }
  return -1;
}

function findPatchEnd(lines: string[], start: number): number {
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith("diff --git")) return i;
  }
  return lines.length;
}

function isPatchHeaderLine(line: string): boolean {
  return PATCH_HEADER_PREFIXES.some((p) => line.startsWith(p));
}

function collectPatchSides(
  lines: string[],
  start: number,
  end: number,
): PatchSides | null {
  const old: string[] = [];
  const next: string[] = [];
  for (let i = start + 1; i < end; i++) {
    const l = lines[i];
    if (isPatchHeaderLine(l)) {
      if (l.startsWith("Binary files") || l.startsWith("GIT binary patch"))
        return null;
      continue;
    }
    if (l.startsWith("+")) next.push(l.slice(1));
    else if (l.startsWith("-")) old.push(l.slice(1));
    else {
      const c = l.startsWith(" ") ? l.slice(1) : l;
      old.push(c);
      next.push(c);
    }
  }
  return { old, next };
}

export function patchSides(patch: string, path?: string): PatchSides | null {
  const lines = patch.split("\n");
  const start = findPatchStart(lines, path);
  if (start < 0) return null;
  const end = findPatchEnd(lines, start);
  return collectPatchSides(lines, start, end);
}

export interface AlignedCell {
  old: string;
  next: string;
  changed: boolean;
}

export type AlignedRow =
  | { kind: "pair"; oldNo: number; nextNo: number; cells: AlignedCell[] }
  | { kind: "added"; oldNo: number | null; nextNo: number; cells: string[] }
  | { kind: "removed"; oldNo: number; nextNo: number | null; cells: string[] };

export interface AlignedTable {
  header: string[];
  hasHeader: boolean;
  rows: AlignedRow[];

  cols: number;
}

function rowKey(row: string[]): string {
  const k = (row[0] ?? "").trim();
  if (k !== "") return k;
  return row.join("\u0000");
}

function padRow(row: string[], cols: number): string[] {
  const out = row.slice(0, cols);
  while (out.length < cols) out.push("");
  return out;
}

function pickHeaderSrc(oldRows: string[][], nextRows: string[][]): string[] {
  if (nextRows.length > 0) return nextRows[0] as string[];
  if (oldRows.length > 0) return oldRows[0] as string[];
  return [];
}

function computeCols(
  headerSrc: string[],
  oldData: string[][],
  nextData: string[][],
): number {
  return Math.max(
    headerSrc.length,
    ...oldData.map((r) => r.length),
    ...nextData.map((r) => r.length),
    0,
  );
}

function buildHeader(headerSrc: string[], cols: number): string[] {
  const header: string[] = [];
  for (let c = 0; c < cols; c++) {
    header.push(
      (headerSrc[c] ?? "").trim() !== ""
        ? (headerSrc[c] as string)
        : `col ${c + 1}`,
    );
  }
  return header;
}

function buildRowKeyQueues(oldData: string[][]): Map<string, number[]> {
  const queues = new Map<string, number[]>();
  oldData.forEach((r, i) => {
    const k = rowKey(r);
    const q = queues.get(k);
    if (q) q.push(i);
    else queues.set(k, [i]);
  });
  return queues;
}

interface RowLinks {
  links: Map<number, number>;
  linkedOld: Set<number>;
}

function buildRowLinks(
  queues: Map<string, number[]>,
  nextData: string[][],
): RowLinks {
  const links = new Map<number, number>();
  const linkedOld = new Set<number>();
  let lastOld = -1;
  nextData.forEach((r, i) => {
    const q = queues.get(rowKey(r));
    if (!q) return;
    while (q.length > 0 && (q[0] as number) <= lastOld) q.shift();
    const o = q.shift();
    if (o !== undefined) {
      links.set(i, o);
      linkedOld.add(o);
      lastOld = o;
    }
  });
  return { links, linkedOld };
}

function pairCells(
  oldRow: string[],
  nextRow: string[],
  cols: number,
): AlignedCell[] {
  const cells: AlignedCell[] = [];
  for (let c = 0; c < cols; c++) {
    const ov = oldRow[c] ?? "";
    const nv = nextRow[c] ?? "";
    cells.push({ old: ov, next: nv, changed: ov !== nv });
  }
  return cells;
}

function buildAlignedRows(
  links: Map<number, number>,
  linkedOld: Set<number>,
  oldData: string[][],
  nextData: string[][],
  cols: number,
  hasHeader: boolean,
): AlignedRow[] {
  const no = (idx: number): number => idx + (hasHeader ? 2 : 1);
  const rows: AlignedRow[] = [];
  const emitRemoved = (k: number): void => {
    rows.push({
      kind: "removed",
      oldNo: no(k),
      nextNo: null,
      cells: padRow(oldData[k] as string[], cols),
    });
  };
  let prevOld = -1;
  for (let i = 0; i < nextData.length; i++) {
    const L = links.get(i);
    if (L !== undefined) {
      const flushGap = (): void => {
        for (let k = prevOld + 1; k < L; k++)
          if (!linkedOld.has(k)) emitRemoved(k);
      };
      if (prevOld >= 0) flushGap();
      rows.push({
        kind: "pair",
        oldNo: no(L),
        nextNo: no(i),
        cells: pairCells(oldData[L] as string[], nextData[i] as string[], cols),
      });
      if (prevOld < 0) flushGap();
      prevOld = L;
    } else {
      rows.push({
        kind: "added",
        oldNo: null,
        nextNo: no(i),
        cells: padRow(nextData[i] as string[], cols),
      });
    }
  }
  for (let k = prevOld + 1; k < oldData.length; k++)
    if (!linkedOld.has(k)) emitRemoved(k);
  return rows;
}

export function alignTables(
  oldRows: string[][],
  nextRows: string[][],
  hasHeader: boolean,
): AlignedTable {
  const oldData = hasHeader ? oldRows.slice(1) : oldRows;
  const nextData = hasHeader ? nextRows.slice(1) : nextRows;
  const headerSrc = pickHeaderSrc(oldRows, nextRows);
  const cols = computeCols(headerSrc, oldData, nextData);
  const header = buildHeader(headerSrc, cols);
  const queues = buildRowKeyQueues(oldData);
  const { links, linkedOld } = buildRowLinks(queues, nextData);
  const rows = buildAlignedRows(
    links,
    linkedOld,
    oldData,
    nextData,
    cols,
    hasHeader,
  );
  return { header, hasHeader, rows, cols };
}

export interface TabularSides {
  delim: TabularDelim;
  old: string[][];
  next: string[][];
  hasHeader: boolean;
}

function hasHeaderRow(rows: string[][]): boolean {
  return (
    rows.length > 1 &&
    rows.every((r) => {
      const k = (r[0] ?? "").trim();
      return k !== "" && !Number.isFinite(Number(k));
    })
  );
}

export function parseTabularSides(
  patch: string,
  path?: string,
): TabularSides | null {
  const sides = patchSides(patch, path);
  if (!sides || (sides.old.length === 0 && sides.next.length === 0))
    return null;

  const nextText = sides.next.join("\n");
  const oldText = sides.old.join("\n");
  const probe = nextText.length >= oldText.length ? nextText : oldText;
  const delim = detectDelim(probe);
  if (!delim) return null;

  const next = nextText === "" ? [] : parseTable(nextText, delim);
  const old = oldText === "" ? [] : parseTable(oldText, delim);
  if (!next || !old) return null;

  const probeRows = nextText.length >= oldText.length ? next : old;
  return { delim, old, next, hasHeader: hasHeaderRow(probeRows) };
}
