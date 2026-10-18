import { useEffect, useRef, useState } from "react";
import {
  HeaderBar,
  Icon,
  T,
  ViewSwitcher,
  useAdwaita,
  type ViewSwitcherItem,
} from "adwaita-gpuix";
import { type View } from "./types";
import { findWorkspaceRoot, getVcsLabel } from "./repo";
import { createRepoWatcher } from "./watch";
import { globalKeyHandler, keyOf } from "./keybus";
import { StatusBar } from "./components/status-bar";
import {
  GLOBAL,
  VIEW_SHORTCUTS,
  hints as viewHints,
  matchShortcut,
  type Shortcut,
} from "./shortcuts";
import { ChangesView } from "./screens/changes";
import { BookmarksView } from "./screens/bookmarks";
import { OpLogView } from "./screens/oplog";
import { EvologView } from "./screens/evolog";
import { HunksView } from "./screens/hunks";
import { WorkspacesView } from "./screens/workspaces";

const VIEW_ITEMS: ViewSwitcherItem[] = [
  { id: "changes", label: "Changes", icon: "list" },
  { id: "bookmarks", label: "Bookmarks", icon: "bookmark" },
  { id: "workspaces", label: "Workspaces", icon: "layers" },
  { id: "oplog", label: "Op Log", icon: "clock" },
];

const MAIN_VIEWS = ["changes", "bookmarks", "workspaces", "oplog"] as const;

function shortCwd(): string {
  const c = findWorkspaceRoot();
  return c.startsWith("/home/") ? c.replace("/home/", "~/") : c;
}

export function App() {
  const t = useAdwaita();
  const [view, setView] = useState<View>({ kind: "changes" });

  const [vcsLabel, setVcsLabel] = useState("");
  const [hints, setHints] = useState<Shortcut[] | null>(null);

  useEffect(() => {
    const fetchLabel = () =>
      getVcsLabel()
        .then((v) => setVcsLabel(v ?? ""))
        .catch(() => {});
    void fetchLabel();
    const watcher = createRepoWatcher(findWorkspaceRoot(), () => {
      void fetchLabel();
    });
    return () => watcher.stop();
  }, []);

  useEffect(() => {
    setHints(null);
  }, [view.kind]);

  const navigate = (v: View) => setView(v);

  const viewRef = useRef(view);
  viewRef.current = view;

  useEffect(() => {
    globalKeyHandler.current = (e) => {
      const key = keyOf(e);
      const m = matchShortcut(GLOBAL, key, {
        ctrl: e.modifiers?.ctrl ?? false,
      });
      if (!m) return false;
      const kind = viewRef.current.kind;
      const idx =
        kind === "hunks" || kind === "evolog" ? 0 : MAIN_VIEWS.indexOf(kind);
      const n = MAIN_VIEWS.length;
      const next = m.id === "view-right" ? (idx + 1) % n : (idx + n - 1) % n;
      setView({ kind: MAIN_VIEWS[next] });
      return true;
    };
    return () => {
      globalKeyHandler.current = null;
    };
  }, []);

  const switchView = (id: string) => {
    if (id === "changes") setView({ kind: "changes" });
    else if (id === "bookmarks") setView({ kind: "bookmarks" });
    else if (id === "oplog") setView({ kind: "oplog" });
    else if (id === "workspaces") setView({ kind: "workspaces" });
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        backgroundColor: t.colors.window_bg,
      }}
    >
      <HeaderBar
        title={
          <ViewSwitcher
            items={VIEW_ITEMS}
            value={view.kind}
            onChange={switchView}
            showLabels={false}
          />
        }
        left={
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Icon name="gitBranch" size={16} color={t.colors.accent} />
            <T size="caption" color={t.colors.accent}>
              {shortCwd()}
            </T>
          </div>
        }
        right={
          vcsLabel ? (
            <T size="caption" color={t.colors.dim_fg}>
              {vcsLabel}
            </T>
          ) : null
        }
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flexGrow: 1,
          minHeight: 0,
          padding: 8,
          gap: 8,
        }}
      >
        {view.kind === "changes" && (
          <ChangesView navigate={navigate} onHints={setHints} />
        )}
        {view.kind === "bookmarks" && (
          <BookmarksView navigate={navigate} onHints={setHints} />
        )}
        {view.kind === "oplog" && (
          <OpLogView navigate={navigate} onHints={setHints} />
        )}
        {view.kind === "evolog" && (
          <EvologView
            changeId={view.changeId}
            navigate={navigate}
            onHints={setHints}
          />
        )}
        {view.kind === "hunks" && (
          <HunksView
            changeId={view.changeId}
            filePath={view.filePath}
            navigate={navigate}
            onHints={setHints}
          />
        )}
        {view.kind === "workspaces" && (
          <WorkspacesView navigate={navigate} onHints={setHints} />
        )}
      </div>
      <StatusBar hints={hints ?? viewHints(VIEW_SHORTCUTS[view.kind])} />
    </div>
  );
}
