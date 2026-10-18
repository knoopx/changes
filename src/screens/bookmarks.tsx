import { useEffect, useState } from "react";
import {
  Spinner,
  T,
  useAdwaita,
  useToast,
  ListPanel,
  ListRow,
  PillGroup,
  RowShell,
  BookmarkPill,
  ScreenLayout,
  DiffPanel,
  FileListTitle,
  MonoBadge,
  PanelTrailing,
} from "adwaita-gpuix";
import { type ViewProps } from "../types";
import { keyOf } from "../keybus";
import { failMessage } from "../errors";
import { FileListPanel } from "../components/file-list-panel";
import { wrapIndex } from "../indexing";
import { useDiffListRefs } from "../hooks/use-diff-list-refs";
import { useFileDiffPanelState } from "../hooks/use-file-diff-state";
import { useFileNavigation } from "../hooks/use-file-navigation";
import { useFilePanelKeys } from "../hooks/use-file-panel-keys";
import { useKeyEvents } from "../hooks/use-key-events";
import { useRepoMutation } from "../hooks/use-repo-mutation";
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
import {
  BOOKMARKS_LEFT,
  BOOKMARKS_RIGHT,
  hints,
  matchShortcut,
} from "../shortcuts";

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
    set: BOOKMARKS_RIGHT,
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

  const runMutation = useRepoMutation({ setLoading, refresh });

  const doNew = () => {
    const g = groups[sel];
    if (!g) return;
    void runMutation(() => newChange(g.changeId));
  };

  const doForget = () => {
    const g = groups[sel];
    if (!g) return;
    void runMutation(async () => {
      for (const n of g.names) await forgetBookmark(n);
      return `Forgot bookmarks: ${g.names.join(", ")}`;
    });
  };

  const doFetch = () =>
    void runMutation(async () => {
      await gitFetch();
      return "Git fetch complete";
    });

  const doPush = () =>
    void runMutation(async () => {
      const all = groups.flatMap((g) => g.names);
      await pushBookmarks(all);
      return "Pushed bookmarks";
    });

  useRepoRefresh(refresh, () => groups[sel]?.key ?? null);

  useEffect(() => {
    onHints?.(focus === "left" ? hints(BOOKMARKS_LEFT) : hints(BOOKMARKS_RIGHT));
  }, [focus]);

  const jumpTo = (index: number) => {
    setSel(index);
    ensureVisible(index);
    const g = groups[index];
    if (g) void loadFilesFor(g).catch(() => setPatch(""));
  };

  useKeyEvents((e) => {
    const key = keyOf(e);

    if (focus === "left") {
      handleLeftPaneKeys(key);
      return;
    }

    if (handleRightPaneKeys(key)) return;
  });

  const handleLeftPaneKeys = (key: string): boolean => {
    const m = matchShortcut(BOOKMARKS_LEFT, key);
    if (!m) return false;
    switch (m.id) {
      case "up":
        go(-1);
        return true;
      case "down":
        go(1);
        return true;
      case "page-up":
        go(-10);
        return true;
      case "page-down":
        go(10);
        return true;
      case "home":
        if (groups.length > 0) jumpTo(0);
        return true;
      case "end":
        if (groups.length > 0) jumpTo(groups.length - 1);
        return true;
      case "focus-right":
        setFocus("right");
        return true;
      case "new":
        void doNew();
        return true;
      case "forget":
        void doForget();
        return true;
      case "fetch":
        void doFetch();
        return true;
      case "push":
        void doPush();
        return true;
      case "back":
        navigate({ kind: "changes" });
        return true;
      default:
        return false;
    }
  };

  const handleRightPaneKeys = (key: string): boolean => {
    return handleFilePanelKey(key, {});
  };

  const group = groups[sel];
  const file = files[fileSel];

  const fileTitle = (
    <FileListTitle description={group?.description} focused={focus === "right"} />
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
                  <PillGroup
                    names={g.displayNames}
                    dimmed={!isSel}
                    renderPill={(name, dimmed) => (
                      <BookmarkPill name={name} dimmed={dimmed} />
                    )}
                  />
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
