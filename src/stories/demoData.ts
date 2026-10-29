

export interface DemoChange {
  changeId: string;
  commitId: string;
  author: string;
  timestamp: string;
  description: string;
  parents: string[];
  empty?: boolean;
  conflict?: boolean;
  immutable?: boolean;
  
  patch: string;
}

export interface DemoBookmark {
  name: string;
  changeId: string;
  remote: string;
  author: string;
}

export interface DemoOp {
  opId: string;
  description: string;
  diff?: string;
}

export interface DemoWorkspace {
  name: string;
  changeId: string;
  commitId: string;
  description: string;
  patch: string;
}

export interface DemoEvologEntry {
  commitId: string;
  description: string;
  author: string;
  timestamp: string;
  patch: string;
}



const CSV_HUNK = `diff --git a/data/latency-benchmark.csv b/data/latency-benchmark.csv
index 3c1d2e4f..9f0a5b18 100644
--- a/data/latency-benchmark.csv
+++ b/data/latency-benchmark.csv
@@ -1,8 +1,9 @@
 chunk_size,codec,rows_per_sec,p99_ms
 1024,gzip,41230,18.4
 1024,zstd,53870,14.2
 4096,gzip,47610,16.9
 4096,zstd,61240,12.8
-8192,gzip,49020,17.5
-8192,zstd,62880,12.4
+8192,gzip,49020,17.3
+8192,zstd,62880,12.1
+8192,parquet,78450,9.6
`;

const PARQUET_NEW = `diff --git a/src/export/parquet.ts b/src/export/parquet.ts
new file mode 100644
index 00000000..b71e6d29
--- /dev/null
+++ b/src/export/parquet.ts
@@ -0,0 +1,34 @@
+import { RowGroupWriter } from "./rowGroup";
+import { type ColumnStats, statsFor } from "../stats";
+
+const DEFAULT_ROW_GROUP = 65_536;
+
+export interface ParquetSinkOptions {
+  rowGroupRows?: number;
+  compression?: "snappy" | "zstd";
+}
+
+/** Streams decoded chunks into parquet row groups without buffering. */
+export class ParquetSink {
+  private writer: RowGroupWriter;
+  private pending: number[][] = [];
+  private readonly limit: number;
+
+  constructor(
+    private readonly columns: string[],
+    opts: ParquetSinkOptions = {},
+  ) {
+    this.limit = opts.rowGroupRows ?? DEFAULT_ROW_GROUP;
+    this.writer = new RowGroupWriter(opts.compression ?? "zstd");
+  }
+
+  async push(chunk: number[][]): Promise<void> {
+    for (const row of chunk) {
+      this.pending.push(row);
+      if (this.pending.length >= this.limit) await this.flush();
+    }
+  }
+
+  async flush(): Promise<ColumnStats[]> {
+    if (this.pending.length === 0) return [];
+    const stats = statsFor(this.pending, this.columns);
+    await this.writer.write(this.pending, stats);
`;

const PARQUET_TEST = `diff --git a/tests/export/parquet.test.ts b/tests/export/parquet.test.ts
new file mode 100644
index 00000000..4a2c9f70
--- /dev/null
+++ b/tests/export/parquet.test.ts
@@ -0,0 +1,14 @@
+import { expect, test } from "bun:test";
+import { ParquetSink } from "../../src/export/parquet";
+
+test("flushes on the row-group boundary", async () => {
+  const sink = new ParquetSink(["a", "b"], { rowGroupRows: 4 });
+  await sink.push([[1, 2], [3, 4]]);
+  expect(await sink.flush()).toHaveLength(0);
+  await sink.push([[5, 6], [7, 8]]);
+  expect(await sink.flush()).toMatchObject([{ column: "a", max: 7 }]);
+});
+
+test("keeps chunk order across row groups", async () => {
+  const sink = new ParquetSink(["a"], { rowGroupRows: 2 });
+  await sink.push([[1], [2], [3]]);
`;

const SNIFF_PATCH = `diff --git a/src/parse/sniff.ts b/src/parse/sniff.ts
index 8b21c4d7..c05f7a19 100644
--- a/src/parse/sniff.ts
+++ b/src/parse/sniff.ts
@@ -12,9 +12,11 @@ const CANDIDATES = [",", ";", "\\t", "|"] as const;
 /** Guess the delimiter from the first non-comment row. */
 export function sniffDelimiter(head: string): Delimiter {
+  const body = head.charCodeAt(0) === 0xfeff ? head.slice(1) : head;
   const rows = head
-    .split(/\\r?\\n/)
+    .split(/\\r?\\n/)
     .filter((r) => r.length > 0 && !r.startsWith("#"));
   let best: Delimiter = ",";
   let hits = -1;
@@ -30,6 +32,7 @@ export function sniffDelimiter(head: string): Delimiter {
       if (score > hits) {
         best = d;
         hits = score;
+        break;
       }
     }
   }
`;

const BOM_TEST = `diff --git a/tests/parse/bom.test.ts b/tests/parse/bom.test.ts
new file mode 100644
index 00000000..e2b70c41
--- /dev/null
+++ b/tests/parse/bom.test.ts
@@ -0,0 +1,9 @@
+import { expect, test } from "bun:test";
+import { sniffDelimiter } from "../../src/parse/sniff";
+
+test("ignores a leading byte-order mark", () => {
+  expect(sniffDelimiter("\\ufeffname;age\\nada;31")).toBe(";");
+});
+
+test("still prefers the busiest candidate", () => {
+  expect(sniffDelimiter("a,b,c\\n1,2,3")).toBe(",");
`;

const PREFIX_INDEX = `diff --git a/src/index/prefix.ts b/src/index/prefix.ts
new file mode 100644
index 00000000..6d40a1b3
--- /dev/null
+++ b/src/index/prefix.ts
@@ -0,0 +1,18 @@
+/** Radix trie over column names, used for tab completion and LIKE pushes. */
+export class PrefixIndex {
+  private readonly kids = new Map<string, PrefixIndex>();
+  private leaf: string[] = [];
+
+  add(name: string): void {
+    let node = this;
+    for (const ch of name) {
+      let next = node.kids.get(ch);
+      if (!next) node.kids.set(ch, (next = new PrefixIndex()));
+      node = next;
+    }
+    node.leaf.push(name);
+  }
+
+  match(prefix: string, limit = 32): string[] {
+    let node: PrefixIndex | undefined = this;
+    for (const ch of prefix) {
+      node = node?.kids.get(ch);
diff --git a/docs/search.md b/docs/search.md
new file mode 100644
index 00000000..1c7d9ae2
--- /dev/null
+++ b/docs/search.md
@@ -0,0 +1,11 @@
+# Column lookup
+
+Column names are resolved through a radix trie (\`src/index/prefix.ts\`) built
+during the schema pass, so \`lumen inspect 'revenue_*'\` costs one trie walk
+instead of a linear scan over the header.
+
+Completion is capped at 32 candidates; \`--explain\` prints the walked path.
diff --git a/src/index/mod.ts b/src/index/mod.ts
index 44e0b71a..91cc52f6 100644
--- a/src/index/mod.ts
+++ b/src/index/mod.ts
@@ -1,3 +1,4 @@
 export { SchemaCache } from "./schema";
+export { PrefixIndex } from "./prefix";
 export { type ColumnRef, resolveColumn } from "./resolve";
`;

const CONFIG_BUILDER = `diff --git a/src/config.ts b/src/config.ts
index 5c1f0a9d..2e8ba774 100644
--- a/src/config.ts
+++ b/src/config.ts
@@ -4,12 +4,18 @@ export interface TableOptions {
   header: boolean;
   skipRows: number;
+}
+
+/** Fluent builder replacing the positional constructor. */
+export class TableOptionsBuilder {
+  private opts: TableOptions = { delimiter: ",", header: true, skipRows: 0 };
+  delimiter(d: string): this {
+    this.opts.delimiter = d;
+    return this;
+  }
 }
 
-export function tableOptions(
-  delimiter: string,
-  header: boolean,
-): TableOptions {
-  return { delimiter, header, skipRows: 0 };
-}
+export const tableOptions = (d: string): TableOptionsBuilder =>
+  new TableOptionsBuilder().delimiter(d);
diff --git a/docs/config.md b/docs/config.md
index 7a0c22d1..0b41f9e3 100644
--- a/docs/config.md
+++ b/docs/config.md
@@ -3,7 +3,7 @@
 Every subcommand reads \`lumen.toml\` first, then the environment.
 
-    table = { delimiter = ";", header = true }
+    [table]
+    delimiter = ";"
+    header = true
`;

const READER_BUFFERS = `diff --git a/src/io/reader.ts b/src/io/reader.ts
index 9d3c5e07..b61a2f48 100644
--- a/src/io/reader.ts
+++ b/src/io/reader.ts
@@ -18,7 +18,7 @@ export class ChunkReader {
   private readonly view: Uint8Array;
 
   constructor(private readonly source: ReadableStream<Uint8Array>) {
-    this.view = new Uint8Array(new ArrayBuffer(CHUNK_BYTES));
+    this.view = new Uint8Array(pool.acquire(CHUNK_BYTES));
   }
 
   async next(): Promise<Decoded | null> {
@@ -41,14 +41,17 @@ export class ChunkReader {
       const decoded = decode(this.view.subarray(0, n));
+      pool.release(this.view);
       return decoded;
     }
     return null;
   }
+
+  close(): void {
+    pool.release(this.view);
+  }
 }
`;

const DEPS_BUMP = `diff --git a/package.json b/package.json
index 2b7c9f41..f0a8d315 100644
--- a/package.json
+++ b/package.json
@@ -11,8 +11,7 @@
   "dependencies": {
-    "arrow2": "0.17.2",
-    "lumen-shim": "workspace:*"
+    "arrow2": "0.18.0"
   },
   "scripts": {
     "test": "bun test",
diff --git a/src/vendor/shim.ts b/src/vendor/shim.ts
deleted file mode 100644
index 6b1f4a09..00000000
--- a/src/vendor/shim.ts
+++ /dev/null
@@ -1,7 +0,0 @@
-// Vendored while arrow2 had no stable decimal casts.
-export function castDecimal(v: number): string {
-  return v.toFixed(4);
-}
-
-export const SHIM_REV = "6f2a81c";
`;

const README_BENCH = `diff --git a/README.md b/README.md
index 1c4e7b93..8a0d2f61 100644
--- a/README.md
+++ b/README.md
@@ -42,6 +42,14 @@ lumen inspect revenue_ --limit 5
 Numbers from \`data/latency-benchmark.csv\` (8 KiB chunks, zstd, single core):
 
+| codec   | rows/sec | p99   |
+| ------- | -------- | ----- |
+| gzip    | 49.0 k   | 17.3  |
+| zstd    | 62.9 k   | 12.1  |
+
+Run the harness with \`bun run bench\`; it writes the CSV above.
+
 ## Configuration
`;

const CLI_LIMIT = `diff --git a/src/cli/inspect.ts b/src/cli/inspect.ts
index 3f9a71c0..7b52d8e4 100644
--- a/src/cli/inspect.ts
+++ b/src/cli/inspect.ts
@@ -6,6 +6,7 @@ export const inspect = command("inspect")
   .option("--json", "emit machine-readable output")
   .option("--explain", "print the resolved plan")
+  .option("--limit <n>", "cap the printed rows", (n) => Number(n), 20)
   .action(async (pattern, opts) => {
     const plan = await resolvePlan(pattern);
@@ -18,7 +19,7 @@ export const inspect = command("inspect")
-      for (const row of plan.rows) print(row);
+      for (const row of plan.rows.slice(0, opts.limit)) print(row);
     }
   });
diff --git a/src/cli/mod.ts b/src/cli/mod.ts
index 5e0b7d2c..91a4f6b0 100644
--- a/src/cli/mod.ts
+++ b/src/cli/mod.ts
@@ -2,4 +2,5 @@ export { inspect } from "./inspect";
 export { load } from "./load";
+export { LIMIT_FLAG } from "./flags";
 export { type GlobalOpts } from "./opts";
`;

const INITIAL_IMPORT = `diff --git a/src/parse/csv.ts b/src/parse/csv.ts
new file mode 100644
index 00000000..71c3a0d8
--- /dev/null
+++ b/src/parse/csv.ts
@@ -0,0 +1,9 @@
+import { sniffDelimiter } from "./sniff";
+
+/** The original single-pass parser: no quoting, no escapes. */
+export function parseCsv(text: string): string[][] {
+  const delim = sniffDelimiter(text);
+  return text.split(/\\r?\\n/).map((row) => row.split(delim));
+}
diff --git a/README.md b/README.md
new file mode 100644
index 00000000..1c4e7b93
--- /dev/null
+++ b/README.md
@@ -0,0 +1,6 @@
+# lumen
+
+Streaming CSV ingestion for the analytics warehouse.
+
+## Usage
+
+    lumen load orders.csv --into warehouse.orders
`;

const DOCS_WORKSPACE_PATCH = `diff --git a/docs/parquet.md b/docs/parquet.md
index 4b7d1e29..c6f20a83 100644
--- a/docs/parquet.md
+++ b/docs/parquet.md
@@ -8,6 +8,12 @@ Row groups default to 65 536 rows.
 Tuning knobs:
 
+| option           | default | notes                     |
+| ---------------- | ------- | ------------------------- |
+| row_group_rows   | 65536   | lower it for narrow tables |
+| compression      | zstd-3  | snappy for hot paths       |
+
+Set them in \`lumen.toml\` under \`[export.parquet]\`.
`;

const SPIKE_BLOOM_PATCH = `diff --git a/src/spike/bloom.ts b/src/spike/bloom.ts
new file mode 100644
index 00000000..2f9c8b17
--- /dev/null
+++ b/src/spike/bloom.ts
@@ -0,0 +1,12 @@
+const BITS = 1 << 14;
+
+export function buildFilter(values: Uint32Array): Uint8Array {
+  const bits = new Uint8Array(BITS / 8);
+  for (const v of values) {
+    const h = (v * 2654435761) % BITS;
+    bits[h >> 3] |= 1 << (h & 7);
+  }
+  return bits;
+}
+
+// spike only: do not ship, hashing is not seeded
`;

const OP_HEAD_DIFF = `Working copy  (@) now at: ulpzqwrkuxsx 1e4f8c2a feat(export): stream parquet writer into the export pipeline
Parent commit (@-)      at: vmwyxnvu7wqz 7b3f9c44 fix(csv): strip UTF-8 BOM before sniffing the delimiter
Added 2 files, deleted 0, modified 1.
Warning: The working copy has untracked files that will not be snapshotted.
  diff --git a/data/latency-benchmark.csv b/data/latency-benchmark.csv
  index 3c1d2e4f..9f0a5b18 100644
  --- a/data/latency-benchmark.csv
  +++ b/data/latency-benchmark.csv
  @@ -1,8 +1,9 @@
   chunk_size,codec,rows_per_sec,p99_ms
   1024,gzip,41230,18.4
  -8192,gzip,49020,17.5
  -8192,zstd,62880,12.4
  +8192,gzip,49020,17.3
  +8192,zstd,62880,12.1
  +8192,parquet,78450,9.6
  diff --git a/src/export/parquet.ts b/src/export/parquet.ts
  new file mode 100644
  --- /dev/null
  +++ b/src/export/parquet.ts
  @@ -0,0 +1,6 @@
  +const DEFAULT_ROW_GROUP = 65_536;
  +
  +/** Streams decoded chunks into parquet row groups without buffering. */
  +export class ParquetSink {
  +  private writer: RowGroupWriter;
  +  private pending: number[][] = [];
Repo version: 16
Log version (head only): 12
`;

export const DEMO_CHANGES: DemoChange[] = [
  {
    changeId: "ulpzqwrkuxsx",
    commitId: "1e4f8c2a9b7d4f0a",
    author: "Robin Adeyemi",
    timestamp: "2025-10-29 16:42",
    description: "feat(export): stream parquet writer into the export pipeline",
    parents: ["7b3f9c44d1e2a8b6"],
    patch: CSV_HUNK + PARQUET_NEW + PARQUET_TEST,
  },
  {
    changeId: "vmwyxnvu7wqz",
    commitId: "7b3f9c44d1e2a8b6",
    author: "Priya Raghavan",
    timestamp: "2025-10-29 15:10",
    description: "fix(csv): strip UTF-8 BOM before sniffing the delimiter",
    parents: ["c4a7f19b0e5d3321"],
    patch: SNIFF_PATCH + BOM_TEST,
  },
  {
    changeId: "qzrvlkwtvpqm",
    commitId: "c4a7f19b0e5d3321",
    author: "Priya Raghavan",
    timestamp: "2025-10-29 14:37",
    description: "feat(index): add a radix prefix index for column names",
    parents: ["5aa1c9d7e3f0b2cc"],
    patch: PREFIX_INDEX,
  },
  {
    changeId: "txkqzvwprnlu",
    commitId: "88d0e5a7c2b91f44",
    author: "Tomas Berglund",
    timestamp: "2025-10-29 14:02",
    description: "refactor(config): move table options into a builder",
    parents: ["5aa1c9d7e3f0b2cc"],
    conflict: true,
    patch: CONFIG_BUILDER,
  },
  {
    changeId: "rkmyvnqzutsw",
    commitId: "5aa1c9d7e3f0b2cc",
    author: "Nadia Sorensen",
    timestamp: "2025-10-29 11:26",
    description: "perf(reader): reuse decode buffers across chunks",
    parents: ["2f6b8d4a0c19e773"],
    patch: READER_BUFFERS,
  },
  {
    changeId: "spwzutqkvyxr",
    commitId: "2f6b8d4a0c19e773",
    author: "Nadia Sorensen",
    timestamp: "2025-10-28 18:05",
    description: "chore(deps): bump arrow2 to 0.18 and drop the vendored shim",
    parents: ["d90c3b6e17fa55a2"],
    patch: DEPS_BUMP,
  },
  {
    changeId: "nwvyxkqrulpz",
    commitId: "d90c3b6e17fa55a2",
    author: "Tomas Berglund",
    timestamp: "2025-10-28 16:44",
    description: "docs(readme): add a benchmarking section",
    parents: ["61b7e2c8a4d09f5e"],
    patch: README_BENCH,
  },
  {
    changeId: "ulpvkqzsvmwy",
    commitId: "61b7e2c8a4d09f5e",
    author: "Nadia Sorensen",
    timestamp: "2025-10-27 10:12",
    description: "feat(cli): add a --limit flag to the inspect subcommand",
    parents: ["0a1b2c3d4e5f6071"],
    patch: CLI_LIMIT,
  },
  {
    changeId: "kmzvwxtqkulp",
    commitId: "0a1b2c3d4e5f6071",
    author: "Tomas Berglund",
    timestamp: "2025-10-24 09:30",
    description: "feat: initial import of the lumen ingestion toolkit",
    parents: [],
    immutable: true,
    patch: INITIAL_IMPORT,
  },
];



export const DEMO_BOOKMARKS: DemoBookmark[] = [
  {
    name: "feature/column-index",
    changeId: "qzrvlkwtvpqm",
    remote: "",
    author: "Priya Raghavan",
  },
  {
    name: "fix/csv-bom",
    changeId: "txkqzvwprnlu",
    remote: "",
    author: "Tomas Berglund",
  },
  {
    name: "main",
    changeId: "ulpvkqzsvmwy",
    remote: "",
    author: "Nadia Sorensen",
  },
  {
    name: "main",
    changeId: "ulpvkqzsvmwy",
    remote: "origin",
    author: "Nadia Sorensen",
  },
  {
    name: "release/1.4",
    changeId: "nwvyxkqrulpz",
    remote: "",
    author: "Tomas Berglund",
  },
  {
    name: "release/1.4",
    changeId: "nwvyxkqrulpz",
    remote: "origin",
    author: "Tomas Berglund",
  },
];



export const DEMO_OPS: DemoOp[] = [
  { opId: "9f3c1a7d4b2e8510", description: "snapshot working copy 4d1f9c2b8a76", diff: OP_HEAD_DIFF },
  { opId: "1c4b2e9f3a7d0682", description: "describe change ulpzqwrkuxsx" },
  { opId: "7a2d5c8e1b34fa90", description: "new change ulpzqwrkuxsx" },
  { opId: "5e8d1a9c6b220371", description: "absorb change vmwyxnvu7wqz" },
  { opId: "3b7f2c8e9a10dc44", description: "squash change qzrvlkwtvpqm" },
  { opId: "2c9a7e5b1d834f0a", description: "rebase 2 commits onto rkmyvnqzutsw" },
  { opId: "11d4c7a9e6b820ce", description: "bookmark set main at 61b7e2c8a4d0" },
  { opId: "0f6b3d2a8c519e77", description: "git push --bookmark main" },
  { opId: "0a5c8e2f7b6413bd", description: "git fetch from origin" },
  { opId: "fe4b92c1d0a75e83", description: "abandon change qvupzmlktuvw" },
  { opId: "f2a7d5c8b1e9064a", description: "describe change txkqzvwprnlu" },
  { opId: "e8c1b46a9d230f75", description: "new change txkqzvwprnlu" },
  { opId: "e1d9a7c3b04f8216", description: "commit ulpvkqzsvmwy" },
  { opId: "d7b0c2e5a91348bc", description: "config reload" },
  { opId: "c4e8f1a6b2d0973e", description: "initialize repo at file:///home/dev/work/lumen" },
  { opId: "b9a2f7c0e3d51086", description: "git clone file:///srv/git/lumen.git" },
];



export const DEMO_WORKSPACES: DemoWorkspace[] = [
  {
    name: "default",
    changeId: "ulpzqwrkuxsx",
    commitId: "1e4f8c2a9b7d",
    description: "feat(export): stream parquet writer into the export pipeline",
    patch: CSV_HUNK + PARQUET_NEW + PARQUET_TEST,
  },
  {
    name: "docs",
    changeId: "qktrvwytulpz",
    commitId: "91ab77cd4e20",
    description: "docs(parquet): document the row-group layout options",
    patch: DOCS_WORKSPACE_PATCH,
  },
  {
    name: "spike-bloom",
    changeId: "xkmzvwkqvmwy",
    commitId: "55d0c1e7a9f3",
    description: "spike: prototype row-group bloom filters",
    patch: SPIKE_BLOOM_PATCH,
  },
];



export const DEMO_EVOLOG: Record<string, DemoEvologEntry[]> = {
  ulpzqwrkuxsx: [
    {
      commitId: "1e4f8c2a9b7d4f0a",
      description: "feat(export): stream parquet writer into the export pipeline",
      author: "Robin Adeyemi",
      timestamp: "2025-10-29 16:42:11",
      patch: CSV_HUNK + PARQUET_NEW + PARQUET_TEST,
    },
    {
      commitId: "7c2f9a44b8e1d3a6",
      description: "feat(export): wip parquet chunk writer",
      author: "Robin Adeyemi",
      timestamp: "2025-10-29 16:20:03",
      patch: PARQUET_NEW,
    },
    {
      commitId: "b5e0d7a2c9f4e18d",
      description: "(no description set)",
      author: "Robin Adeyemi",
      timestamp: "2025-10-29 15:58:47",
      patch: CSV_HUNK,
    },
  ],
};



export const DEMO_HUNKS: Record<string, unknown> = {
  ulpzqwrkuxsx: {
    files: [
      {
        path: "data/latency-benchmark.csv",
        status: "modified",
        hunks: [
          {
            index: 0,
            id: "3f9c1a7d2b48e0c5",
            type: "mixed",
            removed: "8192,gzip,49020,17.5\n8192,zstd,62880,12.4",
            added:
              "8192,gzip,49020,17.3\n8192,zstd,62880,12.1\n8192,parquet,78450,9.6",
            before: { start: 6, lines: 2 },
            after: { start: 6, lines: 3 },
            context: {
              pre: "4096,gzip,47610,16.9\n4096,zstd,61240,12.8",
              post: "",
            },
          },
        ],
      },
      {
        path: "src/export/parquet.ts",
        status: "added",
        hunks: [
          {
            index: 0,
            id: "a41d8c30b7f29e64",
            type: "added",
            removed: "",
            added:
              'import { RowGroupWriter } from "./rowGroup";\n' +
              'import { type ColumnStats, statsFor } from "../stats";\n' +
              "\n" +
              "const DEFAULT_ROW_GROUP = 65_536;\n" +
              "\n" +
              "export interface ParquetSinkOptions {\n" +
              "  rowGroupRows?: number;\n" +
              '  compression?: "snappy" | "zstd";\n' +
              "}\n" +
              "\n" +
              "/** Streams decoded chunks into parquet row groups without buffering. */\n" +
              "export class ParquetSink {\n" +
              "  private writer: RowGroupWriter;",
            before: { start: 0, lines: 0 },
            after: { start: 1, lines: 12 },
            context: { pre: "", post: "" },
          },
          {
            index: 1,
            id: "c8e05f27a1b36d94",
            type: "added",
            removed: "",
            added:
              "    this.limit = opts.rowGroupRows ?? DEFAULT_ROW_GROUP;\n" +
              '    this.writer = new RowGroupWriter(opts.compression ?? "zstd");\n' +
              "  }\n" +
              "\n" +
              "  async push(chunk: number[][]): Promise<void> {\n" +
              "    for (const row of chunk) {\n" +
              "      this.pending.push(row);\n" +
              "      if (this.pending.length >= this.limit) await this.flush();\n" +
              "    }\n" +
              "  }",
            before: { start: 0, lines: 0 },
            after: { start: 20, lines: 10 },
            context: {
              pre: "  constructor(\n    private readonly columns: string[],\n  ) {",
              post: "  async flush(): Promise<ColumnStats[]> {",
            },
          },
        ],
      },
    ],
  },
};



export const DEMO = {
  
  workingCopy: DEMO_CHANGES[0].changeId,
  
  hunkTarget: DEMO_CHANGES[0].changeId,
  
  evologTarget: DEMO_CHANGES[0].changeId,
  
  headerBookmarks: "[main]",
};
