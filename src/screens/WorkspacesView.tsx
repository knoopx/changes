import { useEffect, useMemo, useState } from "react";
import {
  RadioGroup,
  RadioGroupItem,
  Spinner,
  T,
  useAdwaita,
  type IconName,
  ListRow,
  RowIcon,
  ScreenLayout,
  ListPanel,
  DiffPanel,
  DiffSummary,
  MonoBadge,
  PanelTrailing,
  summarizePatch,
  useToast,
  type ToastFn,
} from "adwaita-gpuix";
import { type ViewProps } from "../types";
import { keyOf } from "../keybus";
import { FileListPanel } from "../components/FileListPanel";
import { failMessage } from "../errors";
import {
  attachWorkspace,
  createWorkspace,
  discardWorkspaceFile,
  forgetWorkspace,
  getRawDiff,
  getWorkspaceDiff,
  listWorkspaces,
  loadWorkspaceFiles,
  openInEditor,
  openTerminal,
  rebaseWorkspace,
  type WorkspaceEntry,
  type WorkspaceFile,
} from "../repo";
import { isTabularPath, parseTabularSides } from "../tabular";
import { MONO } from "../theme";
import { clampIndex } from "../indexing";
import { useDiffListRefs } from "../hooks/useDiffListRefs";
import {
  useFileDiffPanelState,
  type FilePanelFocus,
} from "../hooks/useFileDiffState";
import { useKeyEvents } from "../hooks/useKeyEvents";
import { useRepoRefresh } from "../hooks/useRepoWatcher";
import { WS_LEFT, WS_RIGHT, hints, matchShortcut } from "../shortcuts";

interface LeftKeyCtx {
  sel: number;
  workspaces: WorkspaceEntry[];
  setSel: (n: number) => void;
  ensureVisible: (index: number) => void;
  loadSelection: (index: number, ws: WorkspaceEntry[]) => void;
  jumpTo: (index: number) => void;
  runAction: (fn: () => Promise<void>) => void;
  toast: ToastFn;
  refresh: (opts?: { keepId?: string }) => Promise<void>;
  navigate: ViewProps["navigate"];
  forgetCurrentWorkspace: () => void;
}

interface RightKeyCtx {
  sel: number;
  fileSel: number;
  workspaces: WorkspaceEntry[];
  files: WorkspaceFile[];
  setFileSel: (n: number) => void;
  setPatch: (patch: string) => void;
  setFocus: (focus: FilePanelFocus) => void;
  scrollDiff: (down: boolean) => void;
  runAction: (fn: () => Promise<void>) => void;
  toast: ToastFn;
  loadSelection: (index: number, ws: WorkspaceEntry[]) => void;
  navigate: ViewProps["navigate"];
}

function leftMoveSel(id: string, ctx: LeftKeyCtx): boolean {
  switch (id) {
    case "up":
      if (ctx.sel > 0) {
        const ns = clampIndex(ctx.sel, -1, ctx.workspaces.length);
        ctx.setSel(ns);
        ctx.ensureVisible(ns);
        void ctx.loadSelection(ns, ctx.workspaces);
      }
      return true;
    case "down":
      if (ctx.sel < ctx.workspaces.length - 1) {
        const ns = clampIndex(ctx.sel, 1, ctx.workspaces.length);
        ctx.setSel(ns);
        ctx.ensureVisible(ns);
        void ctx.loadSelection(ns, ctx.workspaces);
      }
      return true;
    case "page-up": {
      const ns = clampIndex(ctx.sel, -10, ctx.workspaces.length);
      if (ns !== ctx.sel) {
        ctx.setSel(ns);
        ctx.ensureVisible(ns);
        void ctx.loadSelection(ns, ctx.workspaces);
      }
      return true;
    }
    case "page-down": {
      const ns = clampIndex(ctx.sel, 10, ctx.workspaces.length);
      if (ns !== ctx.sel) {
        ctx.setSel(ns);
        ctx.ensureVisible(ns);
        void ctx.loadSelection(ns, ctx.workspaces);
      }
      return true;
    }
    default:
      return false;
  }
}

function leftJumpSel(id: string, ctx: LeftKeyCtx): boolean {
  switch (id) {
    case "home":
      if (ctx.workspaces.length > 0) ctx.jumpTo(0);
      return true;
    case "end":
      if (ctx.workspaces.length > 0) ctx.jumpTo(ctx.workspaces.length - 1);
      return true;
    case "back":
      ctx.navigate({ kind: "changes" });
      return true;
    default:
      return false;
  }
}

function leftAction(id: string, ctx: LeftKeyCtx): boolean {
  const w = ctx.workspaces[ctx.sel];
  switch (id) {
    case "new":
      void ctx.runAction(async () => {
        const name = await createWorkspace("New workspace");
        ctx.toast(`Created workspace ${name}`, { type: "success" });
        await ctx.refresh();
      });
      return true;
    case "attach":
      if (w)
        void ctx.runAction(async () => {
          await attachWorkspace(w.name);
          ctx.toast(`Attaching to ${w.name}`, { type: "info" });
        });
      return true;
    case "rebase":
      if (w)
        void ctx.runAction(async () => {
          ctx.toast(await rebaseWorkspace(w.name), { type: "success" });
          await ctx.refresh();
        });
      return true;
    case "edit":
      if (w)
        void ctx.runAction(async () => {
          openInEditor(w.path);
          ctx.toast(`Opening ${w.name} in editor`, { type: "info" });
        });
      return true;
    case "term":
      if (w)
        void ctx.runAction(async () => {
          openTerminal(w.name, w.path);
          ctx.toast(`Opened terminal for ${w.name}`, { type: "info" });
        });
      return true;
    case "forget":
      ctx.forgetCurrentWorkspace();
      return true;
    default:
      return false;
  }
}

function rightMoveFile(id: string, ctx: RightKeyCtx): boolean {
  const w = ctx.workspaces[ctx.sel];
  switch (id) {
    case "up":
      if (ctx.fileSel > 0 && w && !w.isDefault) {
        const nf = ctx.fileSel - 1;
        ctx.setFileSel(nf);
        void getWorkspaceDiff(w.name, ctx.files[nf]?.path).then(
          ctx.setPatch,
        );
      }
      return true;
    case "down":
      if (ctx.fileSel < ctx.files.length - 1 && w && !w.isDefault) {
        const nf = ctx.fileSel + 1;
        ctx.setFileSel(nf);
        void getWorkspaceDiff(w.name, ctx.files[nf]?.path).then(
          ctx.setPatch,
        );
      }
      return true;
    default:
      return false;
  }
}

function rightJumpFile(id: string, ctx: RightKeyCtx): boolean {
  const w = ctx.workspaces[ctx.sel];
  switch (id) {
    case "home":
      if (ctx.files.length > 0 && w && !w.isDefault) {
        ctx.setFileSel(0);
        void getWorkspaceDiff(w.name, ctx.files[0]?.path).then(
          ctx.setPatch,
        );
      }
      return true;
    case "end":
      if (ctx.files.length > 0 && w && !w.isDefault) {
        const nf = ctx.files.length - 1;
        ctx.setFileSel(nf);
        void getWorkspaceDiff(w.name, ctx.files[nf]?.path).then(
          ctx.setPatch,
        );
      }
      return true;
    default:
      return false;
  }
}

function rightScrollDiff(id: string, ctx: RightKeyCtx): boolean {
  switch (id) {
    case "scroll-up":
      ctx.scrollDiff(false);
      return true;
    case "scroll-down":
      ctx.scrollDiff(true);
      return true;
    default:
      return false;
  }
}

function rightPaneAction(id: string, ctx: RightKeyCtx): boolean {
  const w = ctx.workspaces[ctx.sel];
  switch (id) {
    case "focus-left":
      ctx.setFocus("left");
      return true;
    case "discard":
      if (w && !w.isDefault && ctx.files[ctx.fileSel])
        void ctx.runAction(async () => {
          ctx.toast(
            await discardWorkspaceFile(w.name, ctx.files[ctx.fileSel].path),
            { type: "success" },
          );
          await ctx.loadSelection(ctx.sel, ctx.workspaces);
        });
      return true;
    case "back":
      ctx.navigate({ kind: "changes" });
      return true;
    default:
      return false;
  }
}

const LEFT_STEP_IDS = new Set(["up", "down", "page-up", "page-down"]);
const LEFT_JUMP_IDS = new Set(["home", "end", "back"]);
const LEFT_ACTION_IDS = new Set([
  "new",
  "attach",
  "rebase",
  "edit",
  "term",
  "forget",
]);

export function WorkspacesView({ navigate, onHints }: ViewProps) {
  const { colors } = useAdwaita();
  const toast = useToast();
  const [workspaces, setWorkspaces] = useState<WorkspaceEntry[]>([]);
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
  } = useFileDiffPanelState<WorkspaceFile>();

  const { diffRef, listRef, ensureVisible, scrollDiff } = useDiffListRefs(true);

  const refresh = async (opts?: { keepId?: string }) => {
    setLoading(true);
    try {
      const ws = await listWorkspaces();
      setWorkspaces(ws);
      let s = sel;
      if (opts?.keepId !== undefined) {
        const idx = ws.findIndex((w) => w.name === opts.keepId);
        if (idx >= 0) s = idx;
      }
      s = Math.max(0, Math.min(s, ws.length - 1));
      setSel(s);
      setFileSel(0);
      const w = ws[s];
      if (w) {
        if (w.isDefault) {
          setFiles([]);
          setPatch(await getRawDiff(w.changeId));
        } else {
          const fs = await loadWorkspaceFiles(w.name);
          setFiles(fs);
          setPatch(await getWorkspaceDiff(w.name, fs[0]?.path));
        }
      } else {
        setFiles([]);
        setPatch("");
      }
    } catch (e) {
      toast(failMessage(e), { type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const loadSelection = (index: number, ws: WorkspaceEntry[]) => {
    const w = ws[index];
    setFileSel(0);
    if (!w) {
      setFiles([]);
      setPatch("");
      return;
    }
    if (w.isDefault) {
      setFiles([]);
      void getRawDiff(w.changeId)
        .catch(() => "")
        .then(setPatch);
    } else {
      void loadWorkspaceFiles(w.name)
        .catch(() => [] as WorkspaceFile[])
        .then((fs) => {
          setFiles(fs);
          return getWorkspaceDiff(w.name, fs[0]?.path).catch(() => "");
        })
        .then(setPatch);
    }
  };

  const runAction = async (fn: () => Promise<void>) => {
    setLoading(true);
    try {
      await fn();
    } catch (e) {
      toast(failMessage(e), { type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useRepoRefresh(refresh, () => workspaces[sel]?.name ?? null);

  const forgetCurrentWorkspace = () => {
    const w = workspaces[sel];
    if (w && !w.isDefault)
      void runAction(async () => {
        toast(await forgetWorkspace(w.name), { type: "success" });
        await refresh();
      });
  };

  const jumpTo = (index: number) => {
    setSel(index);
    ensureVisible(index);
    void loadSelection(index, workspaces);
  };

  const leftCtx: LeftKeyCtx = {
    sel,
    workspaces,
    setSel,
    ensureVisible,
    loadSelection,
    jumpTo,
    runAction,
    toast,
    refresh,
    navigate,
    forgetCurrentWorkspace,
  };

  const handleLeftPaneKeys = (key: string, ctrl: boolean): boolean => {
    const m = matchShortcut(WS_LEFT, key, { ctrl });
    if (!m) return false;
    if (LEFT_STEP_IDS.has(m.id)) return leftMoveSel(m.id, leftCtx);
    if (LEFT_JUMP_IDS.has(m.id)) return leftJumpSel(m.id, leftCtx);
    if (LEFT_ACTION_IDS.has(m.id)) return leftAction(m.id, leftCtx);
    if (m.id === "focus-right") {
      setFocus("right");
      return true;
    }
    return false;
  };

  const rightCtx: RightKeyCtx = {
    sel,
    fileSel,
    workspaces,
    files,
    setFileSel,
    setPatch,
    setFocus,
    scrollDiff,
    runAction,
    toast,
    loadSelection,
    navigate,
  };

  const handleRightPaneKeys = (key: string): boolean => {
    const m = matchShortcut(WS_RIGHT, key);
    if (!m) return false;
    switch (m.id) {
      case "up":
      case "down":
        return rightMoveFile(m.id, rightCtx);
      case "home":
      case "end":
        return rightJumpFile(m.id, rightCtx);
      case "scroll-up":
      case "scroll-down":
        return rightScrollDiff(m.id, rightCtx);
      case "focus-left":
      case "discard":
      case "back":
        return rightPaneAction(m.id, rightCtx);
      default:
        return false;
    }
  };

  useKeyEvents((e) => {
    const key = keyOf(e);
    const ctrl = e.modifiers?.ctrl ?? false;

    if (focus === "left") {
      handleLeftPaneKeys(key, ctrl);
      return;
    }

    handleRightPaneKeys(key);
  });

  useEffect(() => {
    onHints?.(focus === "left" ? hints(WS_LEFT) : hints(WS_RIGHT));
  }, [focus]);

  const w = workspaces[sel];
  const file = files[fileSel];

  const tabular = useMemo(
    () =>
      file && isTabularPath(file.path)
        ? parseTabularSides(patch, file.path)
        : null,
    [file, patch],
  );
  const filesTitle = "Files";
  const diffTitle = w ? (file ? file.path : "all") : "Diff";

  const nameBadge = <MonoBadge text={w ? w.name : null} />;
  const diffStats = useMemo(() => summarizePatch(patch), [patch]);

  return (
    <ScreenLayout
      leftTitle={`Workspaces (${workspaces.length})${loading ? " …" : ""}`}
      leftFocused={focus === "left"}
      leftGrow={28}
      rightGrow={72}
      left={
        <ListPanel listRef={listRef}>
          {workspaces.map((ws, i) => {
            const isIde = ws.name.startsWith("ide-");
            let icon: IconName = "circle";
            let iconColor = colors.dim_fg;
            if (isIde) {
              if (ws.status === "running") {
                icon = "circleDot";
                iconColor = colors.accent;
              } else if (ws.status === "idle") {
                icon = "circle";
                iconColor = colors.fg;
              } else {
                icon = "check";
                iconColor = colors.success;
              }
            }
            const isSel = i === sel;
            
            const isActive = isSel && focus === "left";
            const hasDesc =
              ws.description !== "" && ws.description !== "(no description)";
            return (
              <ListRow
                key={ws.name}
                selected={isSel}
                focused={focus === "left"}
                height={24}
                onClick={() => {
                  setSel(i);
                  ensureVisible(i);
                  void loadSelection(i, workspaces);
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    minWidth: 0,
                    flexGrow: 1,
                  }}
                >
                  <RadioGroup
                    value="0"
                    onValueChange={(v) => {
                      const idx = Number(v);
                      if (idx >= 0 && idx < workspaces.length) {
                        setSel(idx);
                        ensureVisible(idx);
                        void loadSelection(idx, workspaces);
                      }
                    }}
                  >
                    <RadioGroupItem value={String(i)} />
                  </RadioGroup>
                  {isIde && <RowIcon name={icon} color={iconColor} />}
                  <T
                    color={isActive ? colors.accent : colors.fg}
                    weight={isSel ? 600 : 400}
                    style={{ whiteSpace: "nowrap" }}
                  >
                    {ws.name}
                  </T>
                  <T
                    size="caption"
                    color={colors.dim_fg}
                    style={{ fontFamily: MONO, whiteSpace: "nowrap" }}
                  >
                    {ws.changeId.slice(0, 8)}
                  </T>
                  {hasDesc && (
                    <T
                      color={colors.dim_fg}
                      style={{
                        flexGrow: 1,
                        minWidth: 0,
                        whiteSpace: "nowrap",
                        textOverflow: "ellipsis",
                        overflow: "hidden",
                      }}
                    >
                      {ws.description}
                    </T>
                  )}
                </div>
              </ListRow>
            );
          })}
        </ListPanel>
      }
      midTitle={filesTitle}
      midTrailing={<PanelTrailing loading={loading} badge={nameBadge} />}
      midFocused={focus === "right"}
      mid={
        <FileListPanel
          files={files}
          selected={fileSel}
          focused={focus === "right"}
          estimatedItemHeight={28}
          onSelect={(i) => {
            setFileSel(i);
            if (w && !w.isDefault)
              void getWorkspaceDiff(w.name, files[i]?.path).then(setPatch);
          }}
        />
      }
      bottomTitle={diffTitle}
      bottomTrailing={
        <DiffSummary added={diffStats.added} removed={diffStats.removed} />
      }
      bottom={<DiffPanel patch={patch} tabular={tabular} diffRef={diffRef} />}
      trailing={loading ? <Spinner size={16} /> : null}
    />
  );
}
