import { useEffect, useState } from "react";
import {
  Icon,
  RadioGroup,
  RadioGroupItem,
  Spinner,
  T,
  useAdwaita,
} from "adwaita-gpuix";
import { type ViewProps } from "../types";
import { keyOf } from "../keybus";
import { ListRow } from "../components/panel";
import { ListPanel } from "../components/virtual-list-panel";
import { ScreenLayout } from "../components/screen-layout";
import { DiffPanel } from "../components/diff-panel";
import { MonoBadge } from "../components/panel-headers";
import { failMessage } from "../errors";
import { useToast } from "../components/toast";
import { type EvologEntry, getEvologDiff, loadEvolog } from "../repo";
import { clampIndex } from "../indexing";
import { useDiffListRefs } from "../hooks/use-diff-list-refs";
import { useKeyEvents } from "../hooks/use-key-events";
import { useRepoRefresh } from "../hooks/use-repo-watcher";
import { MONO } from "../theme";
import { EVOLONG, hints, matchShortcut } from "../shortcuts";

export function EvologView({
  changeId,
  navigate,
  onHints,
}: { changeId: string } & ViewProps) {
  const { colors } = useAdwaita();
  const toast = useToast();
  const [entries, setEntries] = useState<EvologEntry[]>([]);
  const [sel, setSel] = useState(0);

  const [patch, setPatch] = useState("");
  const [loading, setLoading] = useState(true);
  const { listRef, ensureVisible } = useDiffListRefs();

  const refresh = async (opts?: { keepId?: string }) => {
    setLoading(true);
    try {
      const es = await loadEvolog(changeId);
      setEntries(es);

      let s = sel;
      if (opts?.keepId !== undefined) {
        const idx = es.findIndex((e) => e.commit_id === opts.keepId);
        if (idx >= 0) s = idx;
      }
      s = Math.max(0, Math.min(s, es.length - 1));
      setSel(s);
      const e = es[s];

      if (e) {
        setPatch(await getEvologDiff(e.commit_id));
      } else {
        setPatch("");
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
      getEvologDiff(e.commit_id)
        .then(setPatch)
        .catch(() => setPatch(""));
    } else {
      setPatch("");
    }
  };

  const go = (dir: number) => {
    if (entries.length === 0) return;
    const ns = clampIndex(sel, dir, entries.length);
    setSel(ns);
    ensureVisible(ns);
    loadPreview(ns);
  };

  useRepoRefresh(refresh, () => entries[sel]?.commit_id ?? null);

  useEffect(() => {
    onHints?.(hints(EVOLONG));
  }, []);

  useKeyEvents((e) => {
    const key = keyOf(e);
    const m = matchShortcut(EVOLONG, key);
    if (!m) return;
    switch (m.id) {
      case "up":
        go(-1);
        return;
      case "down":
        go(1);
        return;
      case "home":
        if (entries.length > 0) {
          setSel(0);
          ensureVisible(0);
          loadPreview(0);
        }
        return;
      case "end":
        if (entries.length > 0) {
          setSel(entries.length - 1);
          ensureVisible(entries.length - 1);
          loadPreview(entries.length - 1);
        }
        return;
      case "back":
        navigate({ kind: "changes" });
        return;
      default:
        return;
    }
  });

  const selected = entries[sel];

  const commitIdBadge = (
    <MonoBadge text={selected ? selected.commit_id.slice(0, 8) : null} />
  );

  return (
    <ScreenLayout
      leftTitle={`Evolog (${entries.length})${loading ? " …" : ""}`}
      leftFocused={true}
      leftGrow={28}
      rightGrow={72}
      left={
        <ListPanel listRef={listRef}>
          {entries.length === 0 ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexGrow: 1,
              }}
            >
              <T size="caption" color={colors.dim_fg}>
                No evolution for this change
              </T>
            </div>
          ) : (
            entries.map((e, i) => {
              return (
                <ListRow
                  key={e.commit_id + i}
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
                    {i === 0 && (
                      <Icon name="gitBranch" size={12} color={colors.accent} />
                    )}
                    <T
                      size="caption"
                      color={colors.fg}
                      style={{ fontFamily: MONO, whiteSpace: "nowrap" }}
                    >
                      {e.commit_id.slice(0, 8)}
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
                    <T
                      size="caption"
                      color={colors.dim_fg}
                      style={{ whiteSpace: "nowrap" }}
                    >
                      {e.author}
                    </T>
                    <T
                      size="caption"
                      color={colors.dim_fg}
                      style={{ whiteSpace: "nowrap" }}
                    >
                      {e.timestamp}
                    </T>
                  </div>
                </ListRow>
              );
            })
          )}
        </ListPanel>
      }
      bottomTitle="Diff"
      bottomTrailing={commitIdBadge}
      bottom={<DiffPanel patch={patch} />}
      trailing={loading ? <Spinner size={16} /> : null}
    />
  );
}
