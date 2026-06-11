import { useEffect, useRef, useState } from "react";
import { Checkbox, Spinner, StatusPage, T, useAdwaita } from "adwaita-gpuix";
import { type FlatHunk, type ViewProps } from "../types";
import { keyOf, type WindowKeyEvent } from "../keybus";
import { useKeyHandler } from "../hooks/use-key-handler";
import { useDiffListRefs } from "../hooks/use-diff-list-refs";
import { wrapIndex } from "../indexing";
import { ListRow, Panel } from "../components/panel";
import { ListPanel } from "../components/virtual-list-panel";
import { failMessage } from "../errors";
import { useToast } from "../components/toast";
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

type Focus = "left" | "right";

const hunkKey = (h: FlatHunk): string => `${h.file_path}:${h.hunk.id}`;

interface PreviewLine {
  text: string;
  color: string;
  bold: boolean;
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

  const scrollPreviewBy = (lines: number, down: boolean) => {
    const id = previewRef.current?.id;
    if (id === undefined) return;

    const off = renderer.getScrollOffset?.(id);
    const y = off ? (off[1] ?? 0) : 0;
    renderer.scrollTo?.(id, 0, down ? y - lines * 24 : y + lines * 24);
  };

  const keyRef = useRef<(e: WindowKeyEvent) => void>(() => {});

  const handleLeftPaneKeys = (key: string): boolean => {
    switch (key) {
      case "up":
        go(-1);
        return true;
      case "down":
        go(1);
        return true;
      case "home":
        if (hunks.length > 0) {
          setSel(0);
          ensureVisible(0);
        }
        return true;
      case "end":
        if (hunks.length > 0) {
          setSel(hunks.length - 1);
          ensureVisible(hunks.length - 1);
        }
        return true;
      case "space":
        toggle();
        return true;
      case "s":
        void doSplit();
        return true;
      case "d":
        void doDiscard();
        return true;
      case "tab":
        setFocus("right");
        return true;
    }
    return false;
  };

  const handleRightPaneKeys = (key: string, shift: boolean): boolean => {
    if (key === "j") {
      scrollPreviewBy(shift ? 10 : 1, true);
      return true;
    }
    if (key === "k") {
      scrollPreviewBy(shift ? 10 : 1, false);
      return true;
    }
    if (key === "pagedown") {
      scrollPreviewBy(10, true);
      return true;
    }
    if (key === "pageup") {
      scrollPreviewBy(10, false);
      return true;
    }
    if (key === "tab") {
      setFocus("left");
      return true;
    }
    return false;
  };

  keyRef.current = (e) => {
    const key = keyOf(e);
    if (key === "q" || key === "escape") {
      navigate({ kind: "changes" });
      return;
    }
    if (focus === "left") {
      handleLeftPaneKeys(key);
      return;
    }

    const shift = e.modifiers?.shift ?? false;
    handleRightPaneKeys(key, shift);
  };

  useKeyHandler(keyRef);

  if (!available) {
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

  const hunk = hunks[sel];
  const preview: PreviewLine[] = [];
  if (hunk) {
    const raw: string[] = [];
    if (hunk.hunk.context) raw.push(...hunk.hunk.context.pre.split("\n"));
    raw.push(...hunk.hunk.removed.split("\n"), ...hunk.hunk.added.split("\n"));
    if (hunk.hunk.context) raw.push(...hunk.hunk.context.post.split("\n"));
    const nonEmpty = raw.filter((l) => l !== "");
    const dedent = nonEmpty.length
      ? Math.min(...nonEmpty.map((l) => l.length - l.trimStart().length))
      : 0;
    const strip = (l: string) => l.slice(dedent);

    if (hunk.hunk.context)
      for (const l of hunk.hunk.context.pre.split("\n"))
        if (l !== "")
          preview.push({
            text: ` ${strip(l)}`,
            color: colors.dim_fg,
            bold: false,
          });
    preview.push({ text: "", color: colors.dim_fg, bold: false });
    for (const l of hunk.hunk.removed.split("\n"))
      if (l !== "")
        preview.push({
          text: `- ${strip(l)}`,
          color: colors.destructive,
          bold: false,
        });
    for (const l of hunk.hunk.added.split("\n"))
      if (l !== "")
        preview.push({
          text: `+ ${strip(l)}`,
          color: colors.success,
          bold: false,
        });
    if (hunk.hunk.context)
      for (const l of hunk.hunk.context.post.split("\n"))
        if (l !== "")
          preview.push({
            text: ` ${strip(l)}`,
            color: colors.dim_fg,
            bold: false,
          });
  }

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
          <ListPanel listRef={listRef}>
            {hunks.map((h, i) => {
              const k = hunkKey(h);
              const isSel = selected.has(k);
              return (
                <ListRow
                  key={k + i}
                  selected={i === sel}
                  height={24}
                  onClick={() => {
                    setSel(i);
                    ensureVisible(i);
                    toggle();
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
                    <div style={{ width: 18, flexShrink: 0 }}>
                      <Checkbox
                        checked={isSel}
                        onCheckedChange={() => toggle()}
                      />
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
            })}
          </ListPanel>
        )}
      </Panel>

      <Panel
        title={hunk.file_path}
        focused={focus === "right"}
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
          {hunk
            ? preview.map((p, i) => (
                <T
                  key={i}
                  color={p.color}
                  weight={p.bold ? 600 : 400}

                  style={{ fontFamily: MONO, whiteSpace: "nowrap" }}
                >
                  {p.text || " "}
                </T>
              ))
            : null}
        </div>
      </Panel>
    </div>
  );
}
