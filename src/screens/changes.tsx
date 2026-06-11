import { useEffect, useMemo, useRef, useState } from "react";
import { Checkbox, Icon, T, useAdwaita } from "adwaita-gpuix";
import {
  REVISION_FILTERS,
  type Bookmark,
  type Change,
  type ViewProps,
} from "../types";
import { keyOf, type WindowKeyEvent } from "../keybus";
import { failMessage } from "../errors";
import { useToast } from "../components/toast";
import { ListPanel } from "../components/virtual-list-panel";
import { ListRow, PillGroup, RowShell } from "../components/panel";
import { ScreenLayout } from "../components/screen-layout";
import { BookmarkOverlay } from "../components/bookmark-overlay";
import { DiffPanel } from "../components/diff-panel";
import { ImageDiffPanel } from "../components/image-diff-panel";
import { FileListPanel } from "../components/file-list-panel";
import { MonoBadge, PanelTrailing } from "../components/panel-headers";
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
import { useFileDiffPanelState } from "../hooks/use-file-diff-state";
import { useFileNavigation } from "../hooks/use-file-navigation";
import { useFilePanelKeys } from "../hooks/use-file-panel-keys";
import { useKeyHandler } from "../hooks/use-key-handler";
import { useRepoRefresh } from "../hooks/use-repo-watcher";

type Mode = "normal" | "move";

const CHANGES_LEFT_HINTS = [
  "↑↓ nav",
  "tab",
  "n new",
  "e edit",
  "s split",
  "f squash",
  "r revert",
  "b bm",
  "m move",
  "space sel",
  "d desc",
  "i id",
  "ctrl+p push",
  "p pal",
  "del drop",
  "q quit",
  "ctrl+←/→ view",
];
const CHANGES_RIGHT_HINTS = [
  "↑↓ nav",
  "pg file",
  "⇧pg scr",
  "j/k scr",
  "tab",
  "e open",
  "s split",
  "d discard",
  "h hunks",
  "q quit",
  "ctrl+←/→ view",
];
const CHANGES_MOVE_HINTS = ["↑↓ move", "enter apply", "esc cancel"];

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
    goFile,
    pageFile,
    files,
    fileSel,
    setFileSel,
    setPatch,
    getChangeId: () => changes[sel]?.change_id ?? null,
    scrollDiff,
    setFocus,
    onBack: () => process.exit(0),
    onSplit: () => void splitFileAction(),
    onDiscard: () => void discardFileAction(),
    onHunks: () => navigateHunks(),
  });

  const runMutation = async (fn: () => Promise<string>) => {
    setLoading(true);
    try {
      toast(await fn(), { type: "success" });
      await refresh();
    } catch (e) {
      toast(failMessage(e), { type: "error" });
    } finally {
      setLoading(false);
    }
  };

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
        ? CHANGES_MOVE_HINTS
        : focus === "left"
          ? CHANGES_LEFT_HINTS
          : CHANGES_RIGHT_HINTS,
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

  const handleLeftPaneKeys = (
    key: string,
    shift: boolean,
    ctrl: boolean,
  ): boolean => {
    if (shift && key === "b") {
      void navigate({ kind: "bookmarks" });
      return true;
    }
    if (shift && key === "o") {
      void navigate({ kind: "oplog" });
      return true;
    }
    if (shift && key === "w") {
      void navigate({ kind: "workspaces" });
      return true;
    }
    if (ctrl && key === "p") {
      void pushSelectedBookmarks();
      return true;
    }

    const mutateSelected = (fn: (id: string) => Promise<string>) => {
      const ch = changes[sel];
      if (ch) void runMutation(() => fn(ch.change_id));
    };
    const actions: Record<string, () => void> = {
      up: () => goChange(-1),
      down: () => goChange(1),
      pageup: () => goChange(-10),
      pagedown: () => goChange(10),
      home: () => {
        if (displayed.length > 0) jumpToChange(0);
      },
      end: () => {
        if (displayed.length > 0) jumpToChange(displayed.length - 1);
      },
      tab: () => setFocus("right"),
      n: () => mutateSelected(newChange),
      e: () => mutateSelected(editChange),
      r: () => mutateSelected(revertChange),
      s: () => mutateSelected(splitChange),
      f: () => mutateSelected(squashChange),
      b: openOverlay,
      m: enterMoveMode,
      space: () => {
        const ch = changes[sel];
        if (ch) toggleSelect(ch.change_id);
      },
      d: () => {
        const ch = changes[sel];
        const targets =
          selectedIds.size > 0
            ? Array.from(selectedIds)
            : ch
              ? [ch.change_id]
              : [];
        if (targets.length > 0) {
          setDescribeTargets(targets);
          setDescribeOpen(true);
        }
      },
      i: () => void copyChangeId(),
      delete: () => mutateSelected(abandonChange),
      "/": cycleFilter,
      q: () => process.exit(0),
    };
    const act = actions[key];
    if (act) {
      act();
      return true;
    }
    return false;
  };

  const handleMoveModeKeys = (key: string): boolean => {
    switch (key) {
      case "up":
        moveChange(-1);
        return true;
      case "down":
        moveChange(1);
        return true;
      case "enter":
        void applyMove();
        return true;
      case "escape":
        cancelMove();
        return true;
    }
    return false;
  };

  const handleOverlayKeys = (key: string): boolean => {
    if (!overlayOpen) return false;
    if (key === "escape") finishOverlay(null);
    return true;
  };

  const keyRef = useRef<(e: WindowKeyEvent) => void>(() => {});
  keyRef.current = (e) => {
    const key = keyOf(e);
    const shift = e.modifiers?.shift ?? false;
    const ctrl = e.modifiers?.ctrl ?? false;

    if (handleOverlayKeys(key)) return;

    if (mode === "move") {
      handleMoveModeKeys(key);
      return;
    }

    if (shift && key === "pageup") {
      scrollDiff(false);
      return;
    }
    if (shift && key === "pagedown") {
      scrollDiff(true);
      return;
    }

    if (focus === "left") {
      handleLeftPaneKeys(key, shift, ctrl);
      return;
    }

    if (handleFilePanelKey(key)) return;
  };

  useKeyHandler(keyRef);

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

  const noDesc = !change || change.description === "(no description)";

  const noDescStyle = {
    color: colors.dim_fg,
    fontStyle: "italic" as const,
    whiteSpace: "nowrap" as const,
  };
  const fileTitle = change ? (
    noDesc ? (
      <T size="title4" style={noDescStyle}>
        (no description)
      </T>
    ) : (
      <T
        size="title4"
        weight={600}
        color={focus === "right" ? colors.accent : colors.fg}
        style={{ whiteSpace: "nowrap" }}
      >
        {change.description}
      </T>
    )
  ) : (
    "Files"
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
                <ListRow
                  key={c.commit_id}
                  selected={isSelected}
                  height={24}

                  style={isSelected ? { position: "relative" } : undefined}
                  onClick={() => {
                    setSel(ci);
                    ensureVisible(ci);
                    void loadSelectedFor(ci, changes);
                  }}
                >
                  <RowShell>
                    {}
                    <GraphGutter
                      node={node}
                      prev={i > 0 ? graphData[i - 1] : null}
                      laneCount={laneCount}
                      selected={isSelected}
                      dotStroke={isCurrent ? colors.accent : undefined}
                      selectedStroke={colors.fg}
                    />
                    {}
                    {bm.length > 0 && (
                      <PillGroup names={bm} dimmed={c.immutable} />
                    )}
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
                      <Icon
                        name="warning"
                        size={12}
                        color={colors.destructive}
                      />
                    )}
                    {}
                    <div style={{ width: 18, flexShrink: 0 }}>
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => toggleSelect(c.change_id)}
                      />
                    </div>
                    {}
                    {isSelected && describeOpen && (
                      <DescribePopover
                        targetIds={describeTargets}
                        side={sel >= 3 ? "top" : "bottom"}
                        onDone={(msg) => {
                          setDescribeOpen(false);
                          setDescribeTargets([]);
                          setSelectedIds(new Set());
                          if (msg) {
                            toast(msg, { type: "success" });
                            void refresh();
                          }
                        }}
                      />
                    )}
                  </RowShell>
                </ListRow>
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
