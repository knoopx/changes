import { useEffect, useMemo, useRef, useState } from "react";
import { Checkbox, Icon, T, useAdwaita } from "adwaita-gpuix";
import {
  REVISION_FILTERS,
  type Bookmark,
  type Change,
  type ViewProps,
} from "../types";
import { keyOf } from "../keybus";
import { failMessage } from "../errors";
import { useToast } from "../components/toast";
import { ListPanel } from "../components/virtual-list-panel";
import { ListRow, PillGroup, RowShell } from "../components/panel";
import { ScreenLayout } from "../components/screen-layout";
import { BookmarkOverlay } from "../components/bookmark-overlay";
import { DiffPanel } from "../components/diff-panel";
import { ImageDiffPanel } from "../components/image-diff-panel";
import { FileListPanel } from "../components/file-list-panel";
import {
  FileListTitle,
  MonoBadge,
  PanelTrailing,
} from "../components/panel-headers";
import {
  abandonChange,
  editChange,
  getRawDiff,
  getVcsLabel,
  getCurrentChangeId,
  listBookmarks,
  loadChangedFiles,
  loadChanges,
  newChange,
  pushBookmarks,
  rebaseChange,
  restoreFile,
  revertChange,
  splitChange,
  splitFileChange,
  squashChange,
} from "../repo";
import { copyToClipboard } from "../clipboard";
import { DescribePopover } from "../components/describe-overlay";
import { isTabularPath, parseTabularSides } from "../tabular";
import { isImagePath } from "../images";
import {
  generateGraphData,
  graphGutterWidth,
  graphLaneCount,
  graphXStep,
  renderRowSvg,
  type GraphNode,
} from "../graph";
import { wrapIndex } from "../indexing";
import { useDiffListRefs } from "../hooks/use-diff-list-refs";
import {
  useFileDiffPanelState,
  type FilePanelFocus,
} from "../hooks/use-file-diff-state";
import { useFileNavigation } from "../hooks/use-file-navigation";
import { useFilePanelKeys } from "../hooks/use-file-panel-keys";
import { useKeyEvents } from "../hooks/use-key-events";
import { useRepoMutation } from "../hooks/use-repo-mutation";
import { useRepoRefresh } from "../hooks/use-repo-watcher";
import {
  CHANGES_LEFT,
  CHANGES_MOVE,
  CHANGES_RIGHT,
  hints,
  matchShortcut,
} from "../shortcuts";

type Mode = "normal" | "move";

export function formatFileStats(insertions: number, deletions: number): string {
  const parts: string[] = [];
  if (insertions > 0) parts.push(`+${insertions}`);
  if (deletions > 0) parts.push(`-${deletions}`);
  return parts.join(" ");
}

function GraphGutter({
  node,
  prev,
  laneCount,
  selected,
  dotStroke,
  selectedStroke,
}: {
  node: GraphNode;
  prev: GraphNode | null;
  laneCount: number;
  selected: boolean;
  dotStroke?: string;
  selectedStroke?: string;
}) {
  const xs = graphXStep(laneCount);
  const src = useMemo(() => {
    const svg = renderRowSvg(node, prev, laneCount, xs, {
      selected,
      dotStroke,
      selectedStroke,
    });
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
  }, [node, prev, laneCount, xs, selected, dotStroke, selectedStroke]);
  return (
    <img
      src={src}
      style={{ width: graphGutterWidth(laneCount), height: 24, flexShrink: 0 }}
    />
  );
}

interface LeftKeyCtx {
  sel: number;
  changes: Change[];
  displayed: Change[];
  setFocus: (focus: FilePanelFocus) => void;
  goChange: (dir: number) => void;
  jumpToChange: (index: number) => void;
  mutateSelected: (fn: (id: string) => Promise<string>) => void;
  openOverlay: () => void;
  enterMoveMode: () => void;
  toggleSelect: (changeId: string) => void;
  selectedIds: Set<string>;
  setDescribeTargets: (targets: string[]) => void;
  setDescribeOpen: (open: boolean) => void;
  copyChangeId: () => Promise<void>;
  pushSelectedBookmarks: () => Promise<void>;
  cycleFilter: () => void;
}

function leftMoveSel(id: string, ctx: LeftKeyCtx): boolean {
  switch (id) {
    case "up":
      ctx.goChange(-1);
      return true;
    case "down":
      ctx.goChange(1);
      return true;
    case "page-up":
      ctx.goChange(-10);
      return true;
    case "page-down":
      ctx.goChange(10);
      return true;
    default:
      return false;
  }
}

function leftJumpSel(id: string, ctx: LeftKeyCtx): boolean {
  switch (id) {
    case "home":
      if (ctx.displayed.length > 0) ctx.jumpToChange(0);
      return true;
    case "end":
      if (ctx.displayed.length > 0)
        ctx.jumpToChange(ctx.displayed.length - 1);
      return true;
    default:
      return false;
  }
}

function leftAction(id: string, ctx: LeftKeyCtx): boolean {
  switch (id) {
    case "new":
      ctx.mutateSelected(newChange);
      return true;
    case "edit":
      ctx.mutateSelected(editChange);
      return true;
    case "split":
      ctx.mutateSelected(splitChange);
      return true;
    case "squash":
      ctx.mutateSelected(squashChange);
      return true;
    case "revert":
      ctx.mutateSelected(revertChange);
      return true;
    case "drop":
      ctx.mutateSelected(abandonChange);
      return true;
    default:
      return false;
  }
}

function leftSelectAction(id: string, ctx: LeftKeyCtx): boolean {
  switch (id) {
    case "select": {
      const ch = ctx.changes[ctx.sel];
      if (ch) ctx.toggleSelect(ch.change_id);
      return true;
    }
    case "describe": {
      const ch = ctx.changes[ctx.sel];
      const targets =
        ctx.selectedIds.size > 0
          ? Array.from(ctx.selectedIds)
          : ch
            ? [ch.change_id]
            : [];
      if (targets.length > 0) {
        ctx.setDescribeTargets(targets);
        ctx.setDescribeOpen(true);
      }
      return true;
    }
    default:
      return false;
  }
}

function leftBookAction(id: string, ctx: LeftKeyCtx): boolean {
  switch (id) {
    case "bookmark":
      ctx.openOverlay();
      return true;
    case "move":
      ctx.enterMoveMode();
      return true;
    case "copy-id":
      void ctx.copyChangeId();
      return true;
    case "push":
      void ctx.pushSelectedBookmarks();
      return true;
    case "filter":
      ctx.cycleFilter();
      return true;
    default:
      return false;
  }
}

function leftFocusAction(id: string, ctx: LeftKeyCtx): boolean {
  switch (id) {
    case "focus-right":
      ctx.setFocus("right");
      return true;
    default:
      return false;
  }
}

const LEFT_MOVE_IDS = new Set(["up", "down", "page-up", "page-down"]);
const LEFT_JUMP_IDS = new Set(["home", "end"]);
const LEFT_ACTION_IDS = new Set([
  "new",
  "edit",
  "split",
  "squash",
  "revert",
  "drop",
]);
const LEFT_SELECT_IDS = new Set(["select", "describe"]);
const LEFT_BOOK_IDS = new Set([
  "bookmark",
  "move",
  "copy-id",
  "push",
  "filter",
]);
const LEFT_FOCUS_IDS = new Set(["focus-right"]);

function ChangeRow({
  c,
  node,
  prev,
  laneCount,
  isSelected,
  isCurrent,
  bm,
  desc,
  descStyle,
  isChecked,
  describeOpen,
  describeTargets,
  side,
  colors,
  onRowClick,
  onToggle,
  onDescribeDone,
}: {
  c: Change;
  node: GraphNode;
  prev: GraphNode | null;
  laneCount: number;
  isSelected: boolean;
  isCurrent: boolean;
  bm: string[];
  desc: string;
  descStyle: { color: string; fontWeight?: number };
  isChecked: boolean;
  describeOpen: boolean;
  describeTargets: string[];
  side: "top" | "bottom";
  colors: ReturnType<typeof useAdwaita>["colors"];
  onRowClick: () => void;
  onToggle: () => void;
  onDescribeDone: (msg: string | null) => void;
}) {
  return (
    <ListRow
      selected={isSelected}
      height={24}
      style={isSelected ? { position: "relative" } : undefined}
      onClick={onRowClick}
    >
      <RowShell>
        {}
        <GraphGutter
          node={node}
          prev={prev}
          laneCount={laneCount}
          selected={isSelected}
          dotStroke={isCurrent ? colors.accent : undefined}
          selectedStroke={colors.fg}
        />
        {}
        {bm.length > 0 && <PillGroup names={bm} dimmed={c.immutable} />}
        {}
        <T
          size="caption"
          style={{
            ...descStyle,
            flexGrow: 1,
            flexShrink: 100,
            minWidth: 0,
            whiteSpace: "nowrap",
            textOverflow: "ellipsis",
            overflow: "hidden",
          }}
        >
          {desc}
        </T>
        {}
        {c.has_conflicts && (
          <Icon name="warning" size={12} color={colors.destructive} />
        )}
        {}
        <div style={{ width: 18, flexShrink: 0 }}>
          <Checkbox checked={isChecked} onCheckedChange={onToggle} />
        </div>
        {}
        {isSelected && describeOpen && (
          <DescribePopover
            targetIds={describeTargets}
            side={side}
            onDone={onDescribeDone}
          />
        )}
      </RowShell>
    </ListRow>
  );
}

export function ChangesView({
  navigate,
  onVcsLabel,
  onHints,
}: ViewProps & {
  onVcsLabel?: (label: string) => void;
}) {
  const { colors } = useAdwaita();
  const toast = useToast();
  const [changes, setChanges] = useState<Change[]>([]);
  const [sel, setSel] = useState(0);
  const {
    files,
    setFiles,
    fileSel,
    setFileSel,
    patch,
    setPatch,
    focus,
    setFocus,
    loading,
    setLoading,
    clearFiles,
  } = useFileDiffPanelState();
  const [filterIndex, setFilterIndex] = useState(0);
  const [mode, setMode] = useState<Mode>("normal");
  const [moveChanges, setMoveChanges] = useState<Change[]>([]);
  const [moveOriginalIndex, setMoveOriginalIndex] = useState(0);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [overlayTarget, setOverlayTarget] = useState("");
  const [bookmarksMap, setBookmarksMap] = useState<Map<string, string[]>>(
    new Map(),
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [describeOpen, setDescribeOpen] = useState(false);
  const [describeTargets, setDescribeTargets] = useState<string[]>([]);

  const { diffRef, listRef, ensureVisible, scrollDiff } = useDiffListRefs(true);

  const displayed = mode === "move" ? moveChanges : changes;

  const graphData = useMemo(
    () =>
      generateGraphData(
        displayed.map((c) => ({ id: c.commit_id, parents: c.parents })),
      ),
    [displayed],
  );
  const laneCount = useMemo(() => graphLaneCount(graphData), [graphData]);

  const commitIndex = useMemo(() => {
    const m = new Map<string, number>();
    changes.forEach((c, i) => {
      if (!m.has(c.commit_id)) m.set(c.commit_id, i);
    });
    return m;
  }, [changes]);

  const buildBookmarksMap = (bms: Bookmark[]): Map<string, string[]> => {
    const map = new Map<string, string[]>();
    for (const b of bms) {
      if (!b.change_id) continue;
      const arr = map.get(b.change_id) ?? [];
      arr.push(b.remote ? b.reference : b.name);
      map.set(b.change_id, arr);
    }
    return map;
  };

  const resolveSelectionIndex = (
    chs: Change[],
    opts?: { sel?: number; keepId?: string },
  ): number => {
    let s = opts?.sel ?? sel;
    if (opts?.keepId !== undefined) {
      const idx = chs.findIndex((c) => c.change_id === opts.keepId);
      if (idx >= 0) s = idx;
    }
    return Math.max(0, Math.min(s, chs.length - 1));
  };

  const refresh = async (opts?: {
    fi?: number;
    sel?: number;
    fileSel?: number;
    keepId?: string;
  }) => {
    const f = opts?.fi ?? filterIndex;
    const revset = REVISION_FILTERS[f][1];
    setLoading(true);
    try {
      const chs = await loadChanges(revset);
      const [bms, vcs, cur] = await Promise.all([
        listBookmarks(),
        getVcsLabel(),
        getCurrentChangeId(),
      ]);
      setChanges(chs);
      setBookmarksMap(buildBookmarksMap(bms));

      onVcsLabel?.(vcs ?? "");
      setCurrentId(cur);
      const s = resolveSelectionIndex(chs, {
        sel: opts?.sel,
        keepId: opts?.keepId,
      });
      setSel(s);
      const ch = chs[s];
      if (ch) {
        const fs = await loadChangedFiles(ch.change_id);
        setFiles(fs);
        const fsi = Math.max(
          0,
          Math.min(opts?.fileSel ?? fileSel, fs.length - 1),
        );
        setFileSel(fsi);
        setPatch(await getRawDiff(ch.change_id, fs[fsi]?.path));
      } else {
        clearFiles();
      }
    } catch (e) {
      toast(failMessage(e), { type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const loadSelectedFor = async (index: number, chs: Change[]) => {
    const ch = chs[index];
    if (!ch) {
      clearFiles();
      return;
    }
    const fs = await loadChangedFiles(ch.change_id);
    setFiles(fs);
    const fsi = Math.max(0, Math.min(fileSel, fs.length - 1));
    setFileSel(fsi);
    setPatch(await getRawDiff(ch.change_id, fs[fsi]?.path));
  };

  const goChange = (dir: number) => {
    if (displayed.length === 0) return;
    const ns = wrapIndex(sel, dir, displayed.length);
    setSel(ns);
    ensureVisible(ns);
    void loadSelectedFor(ns, displayed);
  };

  const { goFile, pageFile } = useFileNavigation({
    files,
    fileSel,
    setFileSel,
    setPatch,
    getChangeId: () => changes[sel]?.change_id ?? null,
  });

  const handleFilePanelKey = useFilePanelKeys({
    set: CHANGES_RIGHT,
    goFile,
    pageFile,
    files,
    fileSel,
    setFileSel,
    setPatch,
    getChangeId: () => changes[sel]?.change_id ?? null,
    scrollDiff,
    setFocus,
    onBack: () => {}, 
    onSplit: () => void splitFileAction(),
    onDiscard: () => void discardFileAction(),
    onHunks: () => navigateHunks(),
  });

  const runMutation = useRepoMutation({ setLoading, refresh });

  const splitFileAction = async () => {
    const ch = changes[sel];
    const file = files[fileSel];
    if (!ch || !file) return;
    setLoading(true);
    try {
      const msg = await splitFileChange(ch.change_id, file.path);
      toast(msg, { type: "success" });
      await refresh();
    } catch (e) {
      toast(failMessage(e), { type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const discardFileAction = async () => {
    const ch = changes[sel];
    const file = files[fileSel];
    if (!ch || !file) return;
    setLoading(true);
    try {
      toast(await restoreFile(ch.change_id, file.path), { type: "success" });
      await loadSelectedFor(sel, changes);
    } catch (e) {
      toast(failMessage(e), { type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const navigateHunks = () => {
    const ch = changes[sel];
    if (!ch) return;
    navigate({
      kind: "hunks",
      changeId: ch.change_id,
      filePath: files[fileSel]?.path,
    });
  };

  const cycleFilter = () => {
    const nf = (filterIndex + 1) % REVISION_FILTERS.length;
    setFilterIndex(nf);
    void refresh({ fi: nf, sel: 0, fileSel: 0 });
  };

  const enterMoveMode = () => {
    setMode("move");
    setMoveChanges(changes);
    setMoveOriginalIndex(sel);
  };

  const cancelMove = () => {
    setMode("normal");
    setSel(moveOriginalIndex);
    setMoveChanges([]);
  };

  const moveChange = (dir: number) => {
    const target = sel + dir;
    if (target < 0 || target >= moveChanges.length) return;
    setMoveChanges((prev) => {
      const arr = [...prev];
      [arr[sel], arr[target]] = [arr[target], arr[sel]];
      return arr;
    });
    setSel(target);
  };

  const applyMove = async () => {
    if (sel === moveOriginalIndex) {
      cancelMove();
      return;
    }
    const after = sel > moveOriginalIndex;
    let targetIdx: number;
    if (after) {
      if (sel === 0) {
        toast("Cannot move to top", { type: "warning" });
        return;
      }
      targetIdx = sel - 1;
    } else {
      if (sel + 1 >= moveChanges.length) {
        toast("Cannot move to bottom", { type: "warning" });
        return;
      }
      targetIdx = sel + 1;
    }
    const moved = moveChanges[sel];
    const target = moveChanges[targetIdx];
    if (!moved || !target) return;
    try {
      toast(await rebaseChange(moved.change_id, target.change_id, after), {
        type: "success",
      });
      cancelMove();
      await refresh();
    } catch (e) {
      toast(`Move failed: ${e instanceof Error ? e.message : String(e)}`, {
        type: "error",
      });
    }
  };

  const openOverlay = () => {
    const ch = changes[sel];
    if (!ch) return;
    setOverlayTarget(ch.change_id);
    setOverlayOpen(true);
  };

  const finishOverlay = (msg: string | null) => {
    setOverlayOpen(false);
    setOverlayTarget("");
    if (msg) {
      toast(msg, { type: "success" });
      void refresh();
    }
  };

  const toggleSelect = (changeId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(changeId)) next.delete(changeId);
      else next.add(changeId);
      return next;
    });
  };

  useRepoRefresh(
    refresh,
    () => (mode === "move" ? moveChanges : changes)[sel]?.change_id ?? null,
  );

  const onVcsLabelRef = useRef(onVcsLabel);
  onVcsLabelRef.current = onVcsLabel;
  useEffect(() => () => onVcsLabelRef.current?.(""), []);

  useEffect(() => {
    onHints?.(
      mode === "move"
        ? hints(CHANGES_MOVE)
        : focus === "left"
          ? hints(CHANGES_LEFT)
          : hints(CHANGES_RIGHT),
    );
  }, [focus, mode]);

  const pushSelectedBookmarks = async () => {
    const chp = changes[sel];
    if (!chp) return;
    try {
      const all = await listBookmarks();
      const names = Array.from(
        new Set(
          all.filter((b) => b.change_id === chp.change_id).map((b) => b.name),
        ),
      );
      if (names.length === 0) {
        toast(`No bookmarks on ${chp.change_id.slice(0, 8)}`, {
          type: "warning",
        });
        return;
      }
      await pushBookmarks(names);
      toast(
        `Pushed ${names.length} bookmark(s) for ${chp.change_id.slice(0, 8)}`,
        { type: "success" },
      );
      await refresh();
    } catch (e2) {
      toast(failMessage(e2), { type: "error" });
    }
  };

  const copyChangeId = async () => {
    const ch = changes[sel];
    if (!ch) return;
    const ok = await copyToClipboard(ch.change_id);
    toast(
      ok
        ? `Copied change id ${ch.change_id.slice(0, 8)}`
        : "Clipboard unavailable",
      { type: ok ? "success" : "warning" },
    );
  };

  const jumpToChange = (index: number) => {
    setSel(index);
    ensureVisible(index);
    void loadSelectedFor(index, displayed);
  };

  const mutateSelected = (fn: (id: string) => Promise<string>) => {
    const ch = changes[sel];
    if (ch) void runMutation(() => fn(ch.change_id));
  };

  const leftCtx: LeftKeyCtx = {
    sel,
    changes,
    displayed,
    setFocus,
    goChange,
    jumpToChange,
    mutateSelected,
    openOverlay,
    enterMoveMode,
    toggleSelect,
    selectedIds,
    setDescribeTargets,
    setDescribeOpen,
    copyChangeId,
    pushSelectedBookmarks,
    cycleFilter,
  };

  const handleLeftPaneKeys = (key: string, ctrl: boolean): boolean => {
    const m = matchShortcut(CHANGES_LEFT, key, { ctrl });
    if (!m) return false;
    if (LEFT_MOVE_IDS.has(m.id)) return leftMoveSel(m.id, leftCtx);
    if (LEFT_JUMP_IDS.has(m.id)) return leftJumpSel(m.id, leftCtx);
    if (LEFT_ACTION_IDS.has(m.id)) return leftAction(m.id, leftCtx);
    if (LEFT_SELECT_IDS.has(m.id)) return leftSelectAction(m.id, leftCtx);
    if (LEFT_BOOK_IDS.has(m.id)) return leftBookAction(m.id, leftCtx);
    if (LEFT_FOCUS_IDS.has(m.id)) return leftFocusAction(m.id, leftCtx);
    return false;
  };

  const handleMoveModeKeys = (key: string): boolean => {
    const m = matchShortcut(CHANGES_MOVE, key);
    if (!m) return false;
    switch (m.id) {
      case "up":
        moveChange(-1);
        return true;
      case "down":
        moveChange(1);
        return true;
      case "apply":
        void applyMove();
        return true;
      case "cancel":
        cancelMove();
        return true;
      default:
        return false;
    }
  };

  const handleOverlayKeys = (key: string): boolean => {
    if (!overlayOpen) return false;
    const m = matchShortcut(CHANGES_MOVE, key);
    if (m && m.id === "cancel") finishOverlay(null);
    return true;
  };

  const handleRightPaneKeys = (
    key: string,
    shift: boolean,
    ctrl: boolean,
  ) => {
    const m = matchShortcut(CHANGES_RIGHT, key, { shift, ctrl });
    if (m?.id === "scroll-up-page") {
      scrollDiff(false);
      return;
    }
    if (m?.id === "scroll-down-page") {
      scrollDiff(true);
      return;
    }
    if (handleFilePanelKey(key, { shift, ctrl })) return;
  };

  useKeyEvents((e) => {
    const key = keyOf(e);
    const shift = e.modifiers?.shift ?? false;
    const ctrl = e.modifiers?.ctrl ?? false;

    if (handleOverlayKeys(key)) return;

    if (mode === "move") {
      handleMoveModeKeys(key);
      return;
    }

    if (focus === "left") {
      handleLeftPaneKeys(key, ctrl);
      return;
    }

    handleRightPaneKeys(key, shift, ctrl);
  });

  const change = changes[sel];
  const file = files[fileSel];

  const tabular = useMemo(
    () =>
      file && isTabularPath(file.path)
        ? parseTabularSides(patch, file.path)
        : null,
    [file, patch],
  );
  const filterLabel = REVISION_FILTERS[filterIndex][0];

  const selChangeId =
    (mode === "move" ? moveChanges : changes)[sel]?.change_id ?? null;

  const fileTitle = (
    <FileListTitle description={change?.description} focused={focus === "right"} />
  );
  const diffTitle = change ? (file ? file.path : "all") : "Diff";

  const idBadge = (
    <MonoBadge text={change ? change.change_id.slice(0, 8) : null} />
  );

  return (
    <>
      <ScreenLayout
        leftTitle={`${filterLabel} (${displayed.length})${loading ? " …" : ""}`}
        leftFocused={focus === "left"}
        leftGrow={28}
        rightGrow={72}
        left={
          <ListPanel listRef={listRef}>
            {displayed.map((c, i) => {
              const ci = commitIndex.get(c.commit_id) ?? i;
              const node = graphData[i];
              const prev = i > 0 ? graphData[i - 1] : null;

              const isSelected = c.change_id === selChangeId;
              const isCurrent =
                currentId !== null &&
                c.change_id.slice(0, 8) === currentId.slice(0, 8);
              const bm = bookmarksMap.get(c.change_id) ?? [];
              const desc = c.description;
              const isFocused = isSelected && focus === "left";
              const descStyle = isFocused
                ? { color: colors.accent, fontWeight: 600 as const }
                : c.empty
                  ? { color: colors.dim_fg }
                  : { color: colors.fg };
              const isChecked = selectedIds.has(c.change_id);
              return (
                <ChangeRow
                  key={c.commit_id}
                  c={c}
                  node={node}
                  prev={prev}
                  laneCount={laneCount}
                  isSelected={isSelected}
                  isCurrent={isCurrent}
                  bm={bm}
                  desc={desc}
                  descStyle={descStyle}
                  isChecked={isChecked}
                  describeOpen={describeOpen}
                  describeTargets={describeTargets}
                  side={sel >= 3 ? "top" : "bottom"}
                  colors={colors}
                  onRowClick={() => {
                    setSel(ci);
                    ensureVisible(ci);
                    void loadSelectedFor(ci, changes);
                  }}
                  onToggle={() => toggleSelect(c.change_id)}
                  onDescribeDone={(msg) => {
                    setDescribeOpen(false);
                    setDescribeTargets([]);
                    setSelectedIds(new Set());
                    if (msg) {
                      toast(msg, { type: "success" });
                      void refresh();
                    }
                  }}
                />
              );
            })}
          </ListPanel>
        }
        midTitle={fileTitle}
        midFocused={focus === "right"}
        mid={
          <FileListPanel
            files={files}
            selected={fileSel}
            estimatedItemHeight={28}
            onSelect={(i) => {
              setFileSel(i);
              if (change)
                void getRawDiff(change.change_id, files[i]?.path).then(
                  setPatch,
                );
            }}
          />
        }
        bottomTitle={diffTitle}
        midTrailing={<PanelTrailing loading={loading} badge={idBadge} />}
        bottomTrailing={idBadge}
        bottom={
          change && file && isImagePath(file.path) ? (
            <ImageDiffPanel changeId={change.change_id} path={file.path} />
          ) : (
            <DiffPanel patch={patch} tabular={tabular} diffRef={diffRef} />
          )
        }
      />

      {overlayOpen && (
        <BookmarkOverlay
          targetChangeId={overlayTarget}
          onDone={finishOverlay}
        />
      )}
    </>
  );
}
