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
import { findWorkspaceRoot } from "./repo";
import { globalKeyHandler, keyOf } from "./keybus";
import { StatusBar } from "./components/status-bar";
import { ChangesView } from "./screens/changes";
import { BookmarksView } from "./screens/bookmarks";
import { OpLogView } from "./screens/oplog";
import { HunksView } from "./screens/hunks";
import { WorkspacesView } from "./screens/workspaces";

const VIEW_HINTS: Record<View["kind"], string[]> = {
  changes: [
    "↑↓ nav",
    "tab pane",
    "n new",
    "e edit",
    "s split",
    "f squash",
    "r revert",
    "b bookmark",
    "del abandon",
    "/ filter",
    "B bookmarks",
    "O oplog",
    "W workspaces",
    "m move",
    "q quit",
    "space select",
    "d describe",
    "i copy",
    "ctrl+p push",
    "ctrl+←/→ view",
  ],
  bookmarks: [
    "↑↓ nav",
    "tab pane",
    "n new",
    "del forget",
    "g fetch",
    "p push",
    "e editor",
    "j/k scr",
    "esc back",
    "ctrl+←/→ view",
  ],
  oplog: ["↑↓ nav", "r restore", "u undo", "esc back", "ctrl+←/→ view"],
  hunks: [
    "↑↓ nav",
    "space select",
    "s split",
    "d discard",
    "esc back",
    "ctrl+←/→ view",
  ],
  workspaces: [
    "↑↓ nav",
    "tab pane",
    "n new",
    "a attach",
    "r rebase",
    "e editor",
    "t terminal",
    "d discard",
    "ctrl+d delete",
    "esc back",
    "ctrl+←/→ view",
  ],
};

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
  const [hints, setHints] = useState<string[] | null>(null);

  useEffect(() => {
    setHints(null);
  }, [view.kind]);

  const navigate = (v: View) => setView(v);

  const viewRef = useRef(view);
  viewRef.current = view;

  useEffect(() => {
    globalKeyHandler.current = (e) => {
      if (!e.modifiers?.ctrl) return false;
      const key = keyOf(e);
      if (key !== "left" && key !== "right") return false;
      const kind = viewRef.current.kind;
      const idx = kind === "hunks" ? 0 : MAIN_VIEWS.indexOf(kind);
      const n = MAIN_VIEWS.length;
      const next = key === "right" ? (idx + 1) % n : (idx + n - 1) % n;
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
          vcsLabel ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Icon name="gitBranch" size={16} color={t.colors.accent} />
              <T size="caption" color={t.colors.accent}>
                {vcsLabel}
              </T>
            </div>
          ) : null
        }
        right={
          <T size="caption" color={t.colors.dim_fg}>
            {shortCwd()}
          </T>
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
          <ChangesView
            navigate={navigate}
            onVcsLabel={setVcsLabel}
            onHints={setHints}
          />
        )}
        {view.kind === "bookmarks" && (
          <BookmarksView navigate={navigate} onHints={setHints} />
        )}
        {view.kind === "oplog" && (
          <OpLogView navigate={navigate} onHints={setHints} />
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
      <StatusBar hints={hints ?? VIEW_HINTS[view.kind]} />
    </div>
  );
}
