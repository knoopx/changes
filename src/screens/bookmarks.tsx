import { useEffect, useRef, useState } from "react";
import { Spinner, T, useAdwaita } from "adwaita-gpuix";
import { type ViewProps } from "../types";
import { keyOf, type WindowKeyEvent } from "../keybus";
import { failMessage } from "../errors";
import { useToast } from "../components/toast";
import { ListPanel } from "../components/virtual-list-panel";
import { ListRow, PillGroup, RowShell } from "../components/panel";
import { ScreenLayout } from "../components/screen-layout";
import { DiffPanel } from "../components/diff-panel";
import { FileListPanel } from "../components/file-list-panel";
import { MonoBadge, PanelTrailing } from "../components/panel-headers";
import { wrapIndex } from "../indexing";
import { useDiffListRefs } from "../hooks/use-diff-list-refs";
import { useFileDiffPanelState } from "../hooks/use-file-diff-state";
import { useFileNavigation } from "../hooks/use-file-navigation";
import { useFilePanelKeys } from "../hooks/use-file-panel-keys";
import { useKeyHandler } from "../hooks/use-key-handler";
import { useRepoRefresh } from "../hooks/use-repo-watcher";
import {
  forgetBookmark,
  gitFetch,
  getRawDiff,
  listBookmarks,
  loadChangedFiles,
  newChange,
  pushBookmarks,
} from "../repo";

const BOOKMARKS_LEFT_HINTS = [
  "↑↓ nav",
  "tab",
  "n new",
  "del forget",
  "g fetch",
  "p push",
  "esc back",
];
const BOOKMARKS_RIGHT_HINTS = [
  "↑↓ nav",
  "tab",
  "e editor",
  "j/k scr",
  "esc back",
];

interface BmGroup {
  key: string;
  displayNames: string[];
  names: string[];
  changeId: string;
  description: string;
  author: string;
}

export function BookmarksView({ navigate, onHints }: ViewProps) {
  const t = useAdwaita();
  const { colors } = t;
  const toast = useToast();
  const [groups, setGroups] = useState<BmGroup[]>([]);
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

  const { diffRef, listRef, ensureVisible, scrollDiff } = useDiffListRefs(true);

  const loadFilesFor = async (g: BmGroup) => {
    const fs = await loadChangedFiles(g.changeId);
    setFiles(fs);
    const fsi = Math.max(0, Math.min(fileSel, fs.length - 1));
    setFileSel(fsi);
    setPatch(await getRawDiff(g.changeId, fs[fsi]?.path));
  };

  const refresh = async (opts?: { keepId?: string }) => {
    setLoading(true);
    try {
      const bms = await listBookmarks();
      const map = new Map<string, BmGroup>();
      for (const b of bms) {
        if (!b.change_id) continue;
        const key = b.change_id.slice(0, 8);
        let g = map.get(key);
        if (!g) {
          g = {
            key,
            displayNames: [],
            names: [],
            changeId: b.change_id,
            description: b.description,
            author: b.author,
          };
          map.set(key, g);
        }
        g.displayNames.push(b.remote ? b.reference : b.name);
        g.names.push(b.name);
      }
      const gs = Array.from(map.values());
      gs.sort((a, b) =>
        (a.displayNames[0] ?? "").localeCompare(b.displayNames[0] ?? ""),
      );
      setGroups(gs);

      let s = sel;
      if (opts?.keepId !== undefined) {
        const idx = gs.findIndex((g) => g.key === opts.keepId);
        if (idx >= 0) s = idx;
      }
      s = Math.max(0, Math.min(s, gs.length - 1));
      setSel(s);
      const g = gs[s];
      if (g) {
        await loadFilesFor(g);
      } else {
        clearFiles();
      }
    } catch (e) {
      toast(failMessage(e), { type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const go = (dir: number) => {
    if (groups.length === 0) return;
    const ns = wrapIndex(sel, dir, groups.length);
    setSel(ns);
    ensureVisible(ns);
    const g = groups[ns];
    if (g) void loadFilesFor(g).catch(() => setPatch(""));
  };

  const { goFile, pageFile } = useFileNavigation({
    files,
    fileSel,
    setFileSel,
    setPatch,
    getChangeId: () => groups[sel]?.changeId ?? null,
  });

  const handleFilePanelKey = useFilePanelKeys({
    goFile,
    pageFile,
    files,
    fileSel,
    setFileSel,
    setPatch,
    getChangeId: () => groups[sel]?.changeId ?? null,
    scrollDiff,
    setFocus,
    onBack: () => navigate({ kind: "changes" }),
    onEscape: () => navigate({ kind: "changes" }),
  });

  const doNew = async () => {
    const g = groups[sel];
    if (!g) return;
    setLoading(true);
    try {
      toast(await newChange(g.changeId), { type: "success" });
      await refresh();
    } catch (e) {
      toast(failMessage(e), { type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const doForget = async () => {
    const g = groups[sel];
    if (!g) return;
    setLoading(true);
    try {
      for (const n of g.names) await forgetBookmark(n);
      toast(`Forgot bookmarks: ${g.names.join(", ")}`, { type: "success" });
      await refresh();
    } catch (e) {
      toast(failMessage(e), { type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const doFetch = async () => {
    setLoading(true);
    try {
      await gitFetch();
      toast("Git fetch complete", { type: "success" });
      await refresh();
    } catch (e) {
      toast(failMessage(e), { type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const doPush = async () => {
    setLoading(true);
    try {
      const all = groups.flatMap((g) => g.names);
      await pushBookmarks(all);
      toast("Pushed bookmarks", { type: "success" });
      await refresh();
    } catch (e) {
      toast(failMessage(e), { type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useRepoRefresh(refresh, () => groups[sel]?.key ?? null);

  useEffect(() => {
    onHints?.(focus === "left" ? BOOKMARKS_LEFT_HINTS : BOOKMARKS_RIGHT_HINTS);
  }, [focus]);

  const keyRef = useRef<(e: WindowKeyEvent) => void>(() => {});

  const jumpTo = (index: number) => {
    setSel(index);
    ensureVisible(index);
    const g = groups[index];
    if (g) void loadFilesFor(g).catch(() => setPatch(""));
  };

  const handleLeftPaneKeys = (key: string): boolean => {
    switch (key) {
      case "up":
        go(-1);
        return true;
      case "down":
        go(1);
        return true;
      case "pageup":
        go(-10);
        return true;
      case "pagedown":
        go(10);
        return true;
      case "home":
        if (groups.length > 0) jumpTo(0);
        return true;
      case "end":
        if (groups.length > 0) jumpTo(groups.length - 1);
        return true;
      case "tab":
        setFocus("right");
        return true;
      case "n":
        void doNew();
        return true;
      case "delete":
        void doForget();
        return true;
      case "g":
        void doFetch();
        return true;
      case "p":
        void doPush();
        return true;
      case "q":
      case "escape":
        navigate({ kind: "changes" });
        return true;
    }
    return false;
  };

  const handleRightPaneKeys = (key: string): boolean => {
    return handleFilePanelKey(key);
  };

  keyRef.current = (e) => {
    const key = keyOf(e);

    if (focus === "left") {
      handleLeftPaneKeys(key);
      return;
    }

    if (handleRightPaneKeys(key)) return;
  };

  useKeyHandler(keyRef);

  const group = groups[sel];
  const file = files[fileSel];

  const noDesc =
    !group ||
    group.description === "" ||
    group.description === "(no description)";
  const noDescStyle = {
    color: colors.dim_fg,
    fontStyle: "italic" as const,
    whiteSpace: "nowrap" as const,
  };
  const fileTitle = group ? (
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
        {group.description}
      </T>
    )
  ) : (
    "Files"
  );
  const diffTitle = group ? (file ? file.path : "all") : "Diff";

  const keyBadge = <MonoBadge text={group ? group.key : null} />;

  return (
    <ScreenLayout
      leftTitle={`Bookmarks (${groups.length})${loading ? " …" : ""}`}
      leftFocused={focus === "left"}
      leftGrow={28}
      rightGrow={72}
      left={
        <ListPanel listRef={listRef}>
          {groups.map((g, i) => {
            const isSel = i === sel;
            return (
              <ListRow
                key={g.key + i}
                selected={isSel}
                height={24}
                onClick={() => {
                  setSel(i);
                  ensureVisible(i);
                  if (g) void loadFilesFor(g).catch(() => setPatch(""));
                }}
              >
                <RowShell>
                  {}
                  <PillGroup names={g.displayNames} dimmed={!isSel} />
                  {}
                  {g.description !== "" &&
                    g.description !== "(no description)" && (
                      <T
                        size="caption"
                        color={isSel ? colors.accent : colors.dim_fg}
                        weight={isSel ? 600 : 400}
                        style={{
                          flexGrow: 1,
                          flexShrink: 100,
                          minWidth: 0,
                          whiteSpace: "nowrap",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {g.description}
                      </T>
                    )}
                  {}
                  {g.author !== "" && (
                    <T
                      size="caption"
                      color={isSel ? colors.accent : colors.dim_fg}
                      weight={isSel ? 600 : 400}
                      style={{
                        flexShrink: 100,
                        minWidth: 0,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {" · " + g.author}
                    </T>
                  )}
                </RowShell>
              </ListRow>
            );
          })}
        </ListPanel>
      }
      midTitle={fileTitle}
      midTrailing={<PanelTrailing loading={loading} badge={keyBadge} />}
      midFocused={focus === "right"}
      mid={
        <FileListPanel
          files={files}
          selected={fileSel}
          estimatedItemHeight={22}
          onSelect={(i) => {
            setFileSel(i);
            if (group)
              void getRawDiff(group.changeId, files[i]?.path).then(setPatch);
          }}
        />
      }
      bottomTitle={diffTitle}
      bottomTrailing={keyBadge}
      bottom={<DiffPanel patch={patch} diffRef={diffRef} />}
      trailing={loading ? <Spinner size={16} /> : null}
    />
  );
}
