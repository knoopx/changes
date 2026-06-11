import { useEffect, useMemo, useRef, useState } from "react";
import { Spinner, T, useAdwaita, type IconName } from "adwaita-gpuix";
import { type ViewProps } from "../types";
import { keyOf, type WindowKeyEvent } from "../keybus";
import { ListRow, RowIcon } from "../components/panel";
import { ScreenLayout } from "../components/screen-layout";
import { ListPanel } from "../components/virtual-list-panel";
import { DiffPanel } from "../components/diff-panel";
import { FileListPanel } from "../components/file-list-panel";
import { MonoBadge, PanelTrailing } from "../components/panel-headers";
import { failMessage } from "../errors";
import { useToast } from "../components/toast";
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
import { useDiffListRefs } from "../hooks/use-diff-list-refs";
import { useFileDiffPanelState } from "../hooks/use-file-diff-state";
import { useKeyHandler } from "../hooks/use-key-handler";
import { useRepoRefresh } from "../hooks/use-repo-watcher";

const WS_LEFT_HINTS = [
  "↑↓ nav",
  "tab",
  "n new",
  "a attach",
  "r rebase",
  "e edit",
  "t term",
  "ctrl+d del",
  "q back",
];
const WS_RIGHT_HINTS = ["↑↓ nav", "tab", "d discard", "j/k scr", "q back"];

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

  const keyRef = useRef<(e: WindowKeyEvent) => void>(() => {});

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

  const handleLeftPaneKeys = (key: string, ctrl: boolean): boolean => {
    if (ctrl && key === "d") {
      forgetCurrentWorkspace();
      return true;
    }
    const goBack = () => navigate({ kind: "changes" });
    const actions: Record<string, () => void> = {
      q: goBack,
      escape: goBack,
      tab: () => setFocus("right"),
      up: () => {
        if (sel > 0) {
          const ns = clampIndex(sel, -1, workspaces.length);
          setSel(ns);
          ensureVisible(ns);
          void loadSelection(ns, workspaces);
        }
      },
      down: () => {
        if (sel < workspaces.length - 1) {
          const ns = clampIndex(sel, 1, workspaces.length);
          setSel(ns);
          ensureVisible(ns);
          void loadSelection(ns, workspaces);
        }
      },
      pageup: () => {
        const ns = clampIndex(sel, -10, workspaces.length);
        if (ns !== sel) {
          setSel(ns);
          ensureVisible(ns);
          void loadSelection(ns, workspaces);
        }
      },
      pagedown: () => {
        const ns = clampIndex(sel, 10, workspaces.length);
        if (ns !== sel) {
          setSel(ns);
          ensureVisible(ns);
          void loadSelection(ns, workspaces);
        }
      },
      home: () => {
        if (workspaces.length > 0) jumpTo(0);
      },
      end: () => {
        if (workspaces.length > 0) jumpTo(workspaces.length - 1);
      },
      n: () => {
        void runAction(async () => {
          const name = await createWorkspace("New workspace");
          toast(`Created workspace ${name}`, { type: "success" });
          await refresh();
        });
      },
      a: () => {
        const w = workspaces[sel];
        if (w)
          void runAction(async () => {
            await attachWorkspace(w.name);
            toast(`Attaching to ${w.name}`, { type: "info" });
          });
      },
      r: () => {
        const w = workspaces[sel];
        if (w)
          void runAction(async () => {
            toast(await rebaseWorkspace(w.name), { type: "success" });
            await refresh();
          });
      },
      e: () => {
        const w = workspaces[sel];
        if (w)
          void runAction(async () => {
            openInEditor(w.path);
            toast(`Opening ${w.name} in editor`, { type: "info" });
          });
      },
      t: () => {
        const w = workspaces[sel];
        if (w)
          void runAction(async () => {
            openTerminal(w.name, w.path);
            toast(`Opened terminal for ${w.name}`, { type: "info" });
          });
      },
      d: forgetCurrentWorkspace,
    };
    const act = actions[key];
    if (act) {
      act();
      return true;
    }
    return false;
  };

  const handleRightPaneKeys = (key: string): boolean => {
    const w = workspaces[sel];
    const goBack = () => navigate({ kind: "changes" });
    const actions: Record<string, () => void> = {
      q: goBack,
      escape: goBack,
      tab: () => setFocus("left"),
      up: () => {
        if (fileSel > 0 && w && !w.isDefault) {
          const nf = fileSel - 1;
          setFileSel(nf);
          void getWorkspaceDiff(w.name, files[nf]?.path).then(setPatch);
        }
      },
      down: () => {
        if (fileSel < files.length - 1 && w && !w.isDefault) {
          const nf = fileSel + 1;
          setFileSel(nf);
          void getWorkspaceDiff(w.name, files[nf]?.path).then(setPatch);
        }
      },
      home: () => {
        if (files.length > 0 && w && !w.isDefault) {
          setFileSel(0);
          void getWorkspaceDiff(w.name, files[0]?.path).then(setPatch);
        }
      },
      end: () => {
        if (files.length > 0 && w && !w.isDefault) {
          const nf = files.length - 1;
          setFileSel(nf);
          void getWorkspaceDiff(w.name, files[nf]?.path).then(setPatch);
        }
      },
      d: () => {
        if (w && !w.isDefault && files[fileSel])
          void runAction(async () => {
            toast(await discardWorkspaceFile(w.name, files[fileSel].path), {
              type: "success",
            });
            await loadSelection(sel, workspaces);
          });
      },
      j: () => scrollDiff(true),
      pagedown: () => scrollDiff(true),
      k: () => scrollDiff(false),
      pageup: () => scrollDiff(false),
    };
    const act = actions[key];
    if (act) {
      act();
      return true;
    }
    return false;
  };

  keyRef.current = (e) => {
    const key = keyOf(e);
    const ctrl = e.modifiers?.ctrl ?? false;

    if (focus === "left") {
      handleLeftPaneKeys(key, ctrl);
      return;
    }

    handleRightPaneKeys(key);
  };

  useKeyHandler(keyRef);

  useEffect(() => {
    onHints?.(focus === "left" ? WS_LEFT_HINTS : WS_RIGHT_HINTS);
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
            const hasDesc =
              ws.description !== "" && ws.description !== "(no description)";
            return (
              <ListRow
                key={ws.name}
                selected={isSel}
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
                  {}
                  <RowIcon name={icon} color={iconColor} />
                  <T
                    color={isSel ? colors.accent : colors.fg}
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
          estimatedItemHeight={28}
          onSelect={(i) => {
            setFileSel(i);
            if (w && !w.isDefault)
              void getWorkspaceDiff(w.name, files[i]?.path).then(setPatch);
          }}
        />
      }
      bottomTitle={diffTitle}
      bottomTrailing={nameBadge}
      bottom={<DiffPanel patch={patch} tabular={tabular} diffRef={diffRef} />}
      trailing={loading ? <Spinner size={16} /> : null}
    />
  );
}
