import { useRef, useState } from "react";
import {
  RadioGroup,
  RadioGroupItem,
  Spinner,
  T,
  useAdwaita,
} from "adwaita-gpuix";
import { type OpLogEntry, type ViewProps } from "../types";
import { keyOf, type WindowKeyEvent } from "../keybus";
import { ListRow } from "../components/panel";
import { ListPanel } from "../components/virtual-list-panel";
import { ScreenLayout } from "../components/screen-layout";
import { DiffPanel } from "../components/diff-panel";
import { MonoBadge } from "../components/panel-headers";
import { failMessage } from "../errors";
import { useToast } from "../components/toast";
import { getOpDiff, loadOpLog, restoreOp, splitOpDiff, undoOp } from "../repo";
import { clampIndex } from "../indexing";
import { useDiffListRefs } from "../hooks/use-diff-list-refs";
import { useKeyHandler } from "../hooks/use-key-handler";
import { useRepoRefresh } from "../hooks/use-repo-watcher";
import { MONO } from "../theme";

export function OpLogView({ navigate }: ViewProps) {
  const { colors } = useAdwaita();
  const toast = useToast();
  const [entries, setEntries] = useState<OpLogEntry[]>([]);
  const [sel, setSel] = useState(0);

  const [patch, setPatch] = useState("");
  const [loading, setLoading] = useState(true);
  const { listRef, ensureVisible } = useDiffListRefs();

  const setPatchPreview = (raw: string) => {
    setPatch(splitOpDiff(raw).patch);
  };

  const refresh = async (opts?: { keepId?: string }) => {
    setLoading(true);
    try {
      const es = await loadOpLog(100);
      setEntries(es);

      let s = sel;
      if (opts?.keepId !== undefined) {
        const idx = es.findIndex((e) => e.op_id === opts.keepId);
        if (idx >= 0) s = idx;
      }
      s = Math.max(0, Math.min(s, es.length - 1));
      setSel(s);
      const op = es[s];

      if (op) {
        const raw = await getOpDiff(op.op_id);
        setPatchPreview(raw);
      } else {
        setPatchPreview("");
      }
    } catch (e) {
      toast(failMessage(e), { type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const loadPreview = (idx: number) => {
    const e = entries[idx];
    if (e) {
      getOpDiff(e.op_id)
        .then(setPatchPreview)
        .catch(() => setPatchPreview(""));
    } else {
      setPatchPreview("");
    }
  };

  const go = (dir: number) => {
    if (entries.length === 0) return;
    const ns = clampIndex(sel, dir, entries.length);
    setSel(ns);
    ensureVisible(ns);
    loadPreview(ns);
  };

  const doRestore = async () => {
    if (sel === 0) {
      toast("Already at current operation", { type: "info" });
      return;
    }
    const e = entries[sel];
    if (!e) return;
    setLoading(true);
    try {
      toast(await restoreOp(e.op_id), { type: "success" });
      await refresh();
    } catch (err) {
      toast(failMessage(err), { type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const doUndo = async () => {
    setLoading(true);
    try {
      toast(await undoOp(), { type: "success" });
      await refresh();
    } catch (e) {
      toast(failMessage(e), { type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useRepoRefresh(refresh, () => entries[sel]?.op_id ?? null);

  const keyRef = useRef<(e: WindowKeyEvent) => void>(() => {});
  keyRef.current = (e) => {
    const key = keyOf(e);
    switch (key) {
      case "up":
        go(-1);
        break;
      case "down":
        go(1);
        break;
      case "home":
        if (entries.length > 0) {
          setSel(0);
          ensureVisible(0);
          loadPreview(0);
        }
        break;
      case "end":
        if (entries.length > 0) {
          setSel(entries.length - 1);
          ensureVisible(entries.length - 1);
          loadPreview(entries.length - 1);
        }
        break;
      case "r":
        void doRestore();
        break;
      case "u":
        void doUndo();
        break;
      case "q":
      case "escape":
        navigate({ kind: "changes" });
        break;
    }
  };

  useKeyHandler(keyRef);

  const selected = entries[sel];

  const diffTitle = "Changes";
  const opIdBadge = (
    <MonoBadge text={selected ? selected.op_id.slice(0, 8) : null} />
  );

  return (
    <ScreenLayout
      leftTitle={`Op Log (${entries.length})${loading ? " …" : ""}`}
      leftFocused={true}
      leftGrow={28}
      rightGrow={72}
      left={
        <ListPanel listRef={listRef}>
          {entries.map((e, i) => {
            return (
              <ListRow
                key={e.op_id + i}
                selected={i === sel}
                height={24}
                onClick={() => {
                  setSel(i);
                  ensureVisible(i);
                  loadPreview(i);
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
                      if (idx >= 0 && idx < entries.length) {
                        setSel(idx);
                        ensureVisible(idx);
                        loadPreview(idx);
                      }
                    }}
                  >
                    <RadioGroupItem value={String(i)} />
                  </RadioGroup>
                  <T
                    size="caption"
                    color={colors.fg}
                    style={{ fontFamily: MONO, whiteSpace: "nowrap" }}
                  >
                    {e.op_id.slice(0, 12)}
                  </T>
                  <T
                    size="body"
                    color={colors.dim_fg}
                    style={{
                      flexGrow: 1,
                      minWidth: 0,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {e.description}
                  </T>
                </div>
              </ListRow>
            );
          })}
        </ListPanel>
      }
      bottomTitle={diffTitle}
      bottomTrailing={opIdBadge}
      bottom={<DiffPanel patch={patch} />}
      trailing={loading ? <Spinner size={16} /> : null}
    />
  );
}
