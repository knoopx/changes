import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { Checkbox, Spinner, StatusPage, T, useAdwaita, ListRow, Panel, ListPanel, useToast } from "adwaita-gpuix";
import { type FlatHunk, type ViewProps } from "../types";
import { keyOf } from "../keybus";
import { useKeyEvents } from "../hooks/use-key-events";
import { useDiffListRefs } from "../hooks/use-diff-list-refs";
import { wrapIndex } from "../indexing";
import { failMessage } from "../errors";
import { type PublicInstance } from "@gpuix/react";
import {
  discardSelectedHunks,
  filterByFile,
  flattenHunks,
  findWorkspaceRoot,
  jjHunkAvailable,
  loadHunks,
  splitSelectedHunks,
} from "../repo";
import { createRepoWatcher } from "../watch";
import { MONO } from "../theme";
import { HUNKS, HUNKS_RIGHT, matchShortcut } from "../shortcuts";

type Focus = "left" | "right";

type Colors = ReturnType<typeof useAdwaita>["colors"];

const LINE_PX = 24;

const hunkKey = (h: FlatHunk): string => `${h.file_path}:${h.hunk.id}`;

interface PreviewLine {
  text: string;
  color: string;
  bold: boolean;
}

function computeDedent(raw: string[]): number {
  const nonEmpty = raw.filter((l) => l !== "");
  return nonEmpty.length
    ? Math.min(...nonEmpty.map((l) => l.length - l.trimStart().length))
    : 0;
}

function pushPreviewLines(
  preview: PreviewLine[],
  lines: string[],
  prefix: string,
  dedent: number,
  color: string,
): void {
  for (const l of lines)
    if (l !== "")
      preview.push({
        text: `${prefix}${l.slice(dedent)}`,
        color,
        bold: false,
      });
}

function buildPreviewLines(hunk: FlatHunk, colors: Colors): PreviewLine[] {
  const raw: string[] = [];
  if (hunk.hunk.context) raw.push(...hunk.hunk.context.pre.split("\n"));
  raw.push(...hunk.hunk.removed.split("\n"), ...hunk.hunk.added.split("\n"));
  if (hunk.hunk.context) raw.push(...hunk.hunk.context.post.split("\n"));
  const dedent = computeDedent(raw);

  const preview: PreviewLine[] = [];
  if (hunk.hunk.context)
    pushPreviewLines(
      preview,
      hunk.hunk.context.pre.split("\n"),
      " ",
      dedent,
      colors.dim_fg,
    );
  preview.push({ text: "", color: colors.dim_fg, bold: false });
  pushPreviewLines(
    preview,
    hunk.hunk.removed.split("\n"),
    "- ",
    dedent,
    colors.destructive,
  );
  pushPreviewLines(
    preview,
    hunk.hunk.added.split("\n"),
    "+ ",
    dedent,
    colors.success,
  );
  if (hunk.hunk.context)
    pushPreviewLines(
      preview,
      hunk.hunk.context.post.split("\n"),
      " ",
      dedent,
      colors.dim_fg,
    );
  return preview;
}

interface HunksFocusKeyCtx {
  setFocus: (focus: Focus) => void;
  navigate: ViewProps["navigate"];
}

interface HunksLeftKeyCtx extends HunksFocusKeyCtx {
  hunks: FlatHunk[];
  go: (dir: number) => void;
  jumpTo: (index: number) => void;
  toggle: () => void;
  doSplit: () => void;
  doDiscard: () => void;
}

interface HunksRightKeyCtx extends HunksFocusKeyCtx {
  scrollPreviewBy: (lines: number, down: boolean) => void;
}

function hunkMoveSel(id: string, ctx: HunksLeftKeyCtx): boolean {
  switch (id) {
    case "up":
      ctx.go(-1);
      return true;
    case "down":
      ctx.go(1);
      return true;
    default:
      return false;
  }
}

function hunkJumpSel(id: string, ctx: HunksLeftKeyCtx): boolean {
  switch (id) {
    case "home":
      if (ctx.hunks.length > 0) ctx.jumpTo(0);
      return true;
    case "end":
      if (ctx.hunks.length > 0) ctx.jumpTo(ctx.hunks.length - 1);
      return true;
    default:
      return false;
  }
}

function hunkSelectAction(id: string, ctx: HunksLeftKeyCtx): boolean {
  switch (id) {
    case "select":
      ctx.toggle();
      return true;
    default:
      return false;
  }
}

function hunkAction(id: string, ctx: HunksLeftKeyCtx): boolean {
  switch (id) {
    case "split":
      ctx.doSplit();
      return true;
    case "discard":
      ctx.doDiscard();
      return true;
    default:
      return false;
  }
}

function hunkScrollAction(id: string, ctx: HunksRightKeyCtx): boolean {
  switch (id) {
    case "scroll-up":
      ctx.scrollPreviewBy(1, false);
      return true;
    case "scroll-down":
      ctx.scrollPreviewBy(1, true);
      return true;
    case "scroll-up-big":
      ctx.scrollPreviewBy(10, false);
      return true;
    case "scroll-down-big":
      ctx.scrollPreviewBy(10, true);
      return true;
    default:
      return false;
  }
}

function hunkFocusAction(id: string, ctx: HunksFocusKeyCtx): boolean {
  switch (id) {
    case "focus-right":
      ctx.setFocus("right");
      return true;
    case "focus-left":
      ctx.setFocus("left");
      return true;
    case "back":
      ctx.navigate({ kind: "changes" });
      return true;
    default:
      return false;
  }
}

const HUNK_MOVE_IDS = new Set(["up", "down"]);
const HUNK_JUMP_IDS = new Set(["home", "end"]);
const HUNK_SELECT_IDS = new Set(["select"]);
const HUNK_ACTION_IDS = new Set(["split", "discard"]);
const HUNK_SCROLL_IDS = new Set([
  "scroll-up",
  "scroll-down",
  "scroll-up-big",
  "scroll-down-big",
]);
const HUNK_FOCUS_IDS = new Set(["focus-right", "focus-left", "back"]);

function HunksUnavailable() {
  return (
    <div style={{ display: "flex", flexGrow: 1, minHeight: 0, minWidth: 0 }}>
      <Panel
        title="Hunks"
        focused
        style={{ flexGrow: 1, flexBasis: 0, minHeight: 0 }}
      >
        <StatusPage
          icon="alert"
          title="jj-hunk not available"
          description="Install the jj-hunk CLI to split and discard hunks."
          style={{ flexGrow: 1, minHeight: 0 }}
        />
      </Panel>
    </div>
  );
}

function HunkRow({
  h,
  isSelected,
  isChecked,
  colors,
  onRowClick,
  onToggle,
}: {
  h: FlatHunk;
  isSelected: boolean;
  isChecked: boolean;
  colors: Colors;
  onRowClick: () => void;
  onToggle: () => void;
}) {
  return (
    <ListRow selected={isSelected} height={24} onClick={onRowClick}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          minWidth: 0,
          flexGrow: 1,
        }}
      >
        {}
        <div style={{ width: 18, flexShrink: 0 }}>
          <Checkbox checked={isChecked} onCheckedChange={onToggle} />
        </div>
        <T
          color={colors.fg}
          style={{
            flexGrow: 1,
            minWidth: 0,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {`${h.file_path} [${h.file_status}]`}
        </T>
        <T
          size="caption"
          color={colors.dim_fg}
          style={{ fontFamily: MONO, whiteSpace: "nowrap" }}
        >
          {`#${h.hunk.index} ${h.hunk.before.start}:${h.hunk.before.lines}-${h.hunk.after.start}:${h.hunk.after.lines}`}
        </T>
        <T
          size="caption"
          color={colors.dim_fg}
          style={{ fontFamily: MONO, whiteSpace: "nowrap" }}
        >
          {h.hunk.id.slice(0, 12)}
        </T>
        {}
        <T
          size="caption"
          color={colors.dim_fg}
          style={{ fontFamily: MONO, whiteSpace: "nowrap" }}
        >
          {h.hunk.type}
        </T>
      </div>
    </ListRow>
  );
}

function HunkListBody({
  hunks,
  sel,
  selected,
  colors,
  listRef,
  onRowClick,
  onToggle,
}: {
  hunks: FlatHunk[];
  sel: number;
  selected: Set<string>;
  colors: Colors;
  listRef: { current: PublicInstance | null };
  onRowClick: (index: number) => void;
  onToggle: () => void;
}) {
  return (
    <ListPanel listRef={listRef}>
      {hunks.map((h, i) => {
        const k = hunkKey(h);
        return (
          <HunkRow
            key={k + i}
            h={h}
            isSelected={i === sel}
            isChecked={selected.has(k)}
            colors={colors}
            onRowClick={() => onRowClick(i)}
            onToggle={onToggle}
          />
        );
      })}
    </ListPanel>
  );
}

function PreviewPane({
  title,
  focused,
  preview,
  previewRef,
}: {
  title: string;
  focused: boolean;
  preview: PreviewLine[];
  previewRef: MutableRefObject<PublicInstance | null>;
}) {
  return (
    <Panel
      title={title}
      focused={focused}
      style={{ flexGrow: 60, flexBasis: 0, minHeight: 0 }}
    >
      {}
      <div
        ref={previewRef}
        style={{
          display: "flex",
          flexDirection: "column",
          flexGrow: 1,
          minHeight: 0,
          overflow: "scroll",
          padding: 8,
        }}
      >
        {preview.map((p, i) => (
          <T
            key={i}
            color={p.color}
            weight={p.bold ? 600 : 400}

            style={{ fontFamily: MONO, whiteSpace: "nowrap" }}
          >
            {p.text || " "}
          </T>
        ))}
      </div>
    </Panel>
  );
}

export function HunksView({
  changeId,
  filePath,
  navigate,
}: ViewProps & { changeId: string; filePath?: string }) {
  const t = useAdwaita();
  const { colors } = t;
  const toast = useToast();
  const [hunks, setHunks] = useState<FlatHunk[]>([]);
  const [sel, setSel] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [focus, setFocus] = useState<Focus>("left");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [available] = useState<boolean>(() => jjHunkAvailable());

  const previewRef = useRef<PublicInstance | null>(null);
  const { listRef, renderer, ensureVisible } = useDiffListRefs();

  const refresh = async (opts?: { keepKey?: string }) => {
    setLoading(true);
    try {
      const result = await loadHunks(changeId);
      let flat = flattenHunks(result);
      if (filePath) flat = filterByFile(flat, filePath);
      setHunks(flat);

      let s = 0;
      if (opts?.keepKey !== undefined) {
        const idx = flat.findIndex((h) => hunkKey(h) === opts.keepKey);
        s = idx >= 0 ? idx : Math.max(0, Math.min(sel, flat.length - 1));
      }
      setSel(s);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const selKeyRef = useRef<string | null>(null);
  selKeyRef.current = hunks[sel] ? hunkKey(hunks[sel]) : null;

  useEffect(() => {
    if (available) void refresh();

    const watcher = createRepoWatcher(findWorkspaceRoot(), () => {
      void refreshRef.current({ keepKey: selKeyRef.current ?? undefined });
    });
    return () => watcher.stop();
  }, []);

  const go = (dir: number) => {
    if (hunks.length === 0) return;
    const ns = wrapIndex(sel, dir, hunks.length);
    setSel(ns);
    ensureVisible(ns);
  };

  const jumpTo = (index: number) => {
    setSel(index);
    ensureVisible(index);
  };

  const toggle = () => {
    const h = hunks[sel];
    if (!h) return;
    const k = hunkKey(h);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const currentSelections = () =>
    hunks
      .filter((h) => selected.has(hunkKey(h)))
      .map((h) => ({ file_path: h.file_path, hunk_id: h.hunk.id }));

  const runHunkAction = async (
    message: (n: number) => string,
    action: (
      changeId: string,
      sels: Array<{ file_path: string; hunk_id: string }>,
    ) => Promise<void>,
  ) => {
    const sels = currentSelections();
    if (sels.length === 0) {
      toast("No hunks selected. Use Space to mark hunks.", { type: "warning" });
      return;
    }
    setLoading(true);
    try {
      await action(changeId, sels);
      toast(message(sels.length), { type: "success" });
      setSelected(new Set());
      await refresh();
    } catch (e) {
      toast(failMessage(e), { type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const doSplit = () =>
    void runHunkAction(
      (n) => `Split ${n} hunk(s) into a new change`,
      splitSelectedHunks,
    );

  const doDiscard = () =>
    void runHunkAction((n) => `Discarded ${n} hunk(s)`, discardSelectedHunks);

  const previewOffsetY = (id: number): number => {
    const off = renderer.getScrollOffset?.(id);
    return off ? (off[1] ?? 0) : 0;
  };

  const scrollPreviewBy = (lines: number, down: boolean) => {
    const id = previewRef.current?.id;
    if (id === undefined) return;
    const delta = (down ? 1 : -1) * lines * LINE_PX;
    renderer.scrollTo?.(id, 0, previewOffsetY(id) + delta);
  };

  const leftCtx: HunksLeftKeyCtx = {
    hunks,
    go,
    jumpTo,
    toggle,
    doSplit,
    doDiscard,
    setFocus,
    navigate,
  };

  const handleLeftPaneKeys = (key: string): boolean => {
    const m = matchShortcut(HUNKS, key);
    if (!m) return false;
    if (HUNK_MOVE_IDS.has(m.id)) return hunkMoveSel(m.id, leftCtx);
    if (HUNK_JUMP_IDS.has(m.id)) return hunkJumpSel(m.id, leftCtx);
    if (HUNK_SELECT_IDS.has(m.id)) return hunkSelectAction(m.id, leftCtx);
    if (HUNK_ACTION_IDS.has(m.id)) return hunkAction(m.id, leftCtx);
    if (HUNK_FOCUS_IDS.has(m.id)) return hunkFocusAction(m.id, leftCtx);
    return false;
  };

  const rightCtx: HunksRightKeyCtx = {
    scrollPreviewBy,
    setFocus,
    navigate,
  };

  const handleRightPaneKeys = (key: string, shift: boolean): boolean => {
    const m = matchShortcut(HUNKS_RIGHT, key, { shift });
    if (!m) return false;
    if (HUNK_SCROLL_IDS.has(m.id)) return hunkScrollAction(m.id, rightCtx);
    if (HUNK_FOCUS_IDS.has(m.id)) return hunkFocusAction(m.id, rightCtx);
    return false;
  };

  useKeyEvents((e) => {
    const key = keyOf(e);
    const shift = e.modifiers?.shift ?? false;

    if (focus === "left") {
      handleLeftPaneKeys(key);
      return;
    }
    handleRightPaneKeys(key, shift);
  });

  if (!available) return <HunksUnavailable />;

  const hunk = hunks[sel];
  if (!hunk) return <HunksUnavailable />;
  const preview = buildPreviewLines(hunk, colors);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        gap: 8,
        flexGrow: 1,
        minHeight: 0,
        minWidth: 0,
      }}
    >
      <Panel
        title={`Hunks (${hunks.length})${loading ? " …" : ""}${error ? " · error" : ""}`}
        focused={focus === "left"}
        trailing={loading ? <Spinner size={16} /> : null}
        style={{ flexGrow: 40, flexBasis: 0, minWidth: 0 }}
      >
        {error ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexGrow: 1,
              minHeight: 0,
            }}
          >
            <T size="body" color={colors.destructive}>
              {error}
            </T>
          </div>
        ) : (
          <HunkListBody
            hunks={hunks}
            sel={sel}
            selected={selected}
            colors={colors}
            listRef={listRef}
            onRowClick={(i) => {
              setSel(i);
              ensureVisible(i);
              toggle();
            }}
            onToggle={toggle}
          />
        )}
      </Panel>

      <PreviewPane
        title={hunk.file_path}
        focused={focus === "right"}
        preview={preview}
        previewRef={previewRef}
      />
    </div>
  );
}
