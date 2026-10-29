import { useEffect, useState } from "react";
import { Checkbox, Icon, T, useAdwaita, groupHints, DialogHintBar, candidateListHeight, DialogFrame, ListRow, useToast } from "adwaita-gpuix";
import { useKeyEvents } from "../hooks/useKeyEvents";
import { failMessage } from "../errors";
import {
  applyRestoreHunks,
  getFileRestoreHunks,
  type RestoreHunk,
} from "../repo";
import { RESTORE_OVERLAY, hints, matchShortcut } from "../shortcuts";
import { MONO } from "../theme";

const ROW_H = 24;
const MAX_VISIBLE = 10;

export function RestoreOverlay({
  changeId,
  filePath,
  fileStatus,
  isWorkingCopy,
  onDone,
}: {
  changeId: string;
  filePath: string;
  fileStatus: string;
  isWorkingCopy: boolean;
  onDone: (msg: string | null) => void;
}) {
  const t = useAdwaita();
  const { colors } = t;
  const toast = useToast();
  const [hunks, setHunks] = useState<RestoreHunk[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  useEffect(() => {
    let cancelled = false;
    getFileRestoreHunks(changeId, filePath)
      .then((hs) => {
        if (!cancelled) setHunks(hs);
      })
      .catch((e) => {
        if (!cancelled) toast(failMessage(e), { type: "error" });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [changeId, filePath]);

  const toggleHunk = (h: RestoreHunk | undefined) => {
    if (!h) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(h.index)) next.delete(h.index);
      else next.add(h.index);
      return next;
    });
  };

  const apply = async () => {
    if (!isWorkingCopy) return;
    if (selected.size === 0) {
      toast("No hunks selected. Use Space to mark hunks.", {
        type: "warning",
      });
      return;
    }
    try {
      const chosen = hunks.filter((h) => selected.has(h.index));
      const msg = await applyRestoreHunks(changeId, filePath, chosen);
      onDone(msg);
    } catch (e) {
      onDone(failMessage(e));
    }
  };

  useKeyEvents((e) => {
    const key = (e.key ?? "").toLowerCase() === " " ? "space" : (e.key ?? "").toLowerCase();
    const ctrl = e.modifiers?.ctrl ?? false;
    const cmd = e.modifiers?.cmd ?? false;
    const m = matchShortcut(RESTORE_OVERLAY, key, { ctrl, cmd });
    if (!m) return;
    switch (m.id) {
      case "nav-up":
        setCursor((c) => Math.max(0, c - 1));
        break;
      case "nav-down":
        setCursor((c) => Math.min(c + 1, Math.max(hunks.length - 1, 0)));
        break;
      case "select":
        toggleHunk(hunks[cursor]);
        break;
      case "apply":
        void apply();
        break;
      case "cancel":
        onDone(null);
        break;
      default:
        break;
    }
  });

  const shownHints = groupHints(
    hints(RESTORE_OVERLAY).filter((s) => isWorkingCopy || s.id !== "apply"),
  );

  return (
    <DialogFrame width={640}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <Icon name="fileText" size={18} color={colors.accent} />
        <T
          size="title2"
          weight={700}
          color={colors.fg}
          style={{ minWidth: 0, whiteSpace: "nowrap" }}
        >
          {`Restore hunks — ${filePath}`}
        </T>
      </div>
      {!isWorkingCopy && (
        <T size="body" color={colors.dim_fg}>
          Interactive restore works on the working-copy change only. Discard
          the whole file instead (d).
        </T>
      )}
      {fileStatus && (
        <T size="caption" color={colors.dim_fg}>
          {`status: ${fileStatus} · ${hunks.length} hunk(s) · ${selected.size} selected`}
        </T>
      )}
      {loading ? (
        <T size="body" color={colors.dim_fg}>
          Loading hunks…
        </T>
      ) : hunks.length === 0 ? (
        <T size="body" color={colors.dim_fg}>
          No hunks to restore for this file.
        </T>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            overflowY: "scroll",
            height: candidateListHeight(
              Math.min(hunks.length, MAX_VISIBLE),
              ROW_H,
            ),
          }}
        >
          {hunks.map((h) => {
            const idx = h.index;
            const isActive = idx === cursor;
            const isChecked = selected.has(idx);
            const preview = h.preLines.slice(0, 2).join(" … ");
            return (
              <ListRow
                key={idx}
                selected={isActive}
                height={24}
                onClick={() => {
                  setCursor(idx);
                  toggleHunk(h);
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexGrow: 1,
                    minWidth: 0,
                  }}
                >
                  <div style={{ width: 18, flexShrink: 0 }}>
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={() => toggleHunk(h)}
                    />
                  </div>
                  <T
                    size="caption"
                    weight={isActive ? 600 : 400}
                    color={isActive ? colors.accent : colors.fg}
                    style={{ fontFamily: MONO, whiteSpace: "nowrap" }}
                  >
                    {`#${idx + 1} ${h.label}`}
                  </T>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                      flexGrow: 1,
                      minWidth: 0,
                    }}
                  >
                    {preview && (
                      <T
                        size="caption"
                        color={colors.dim_fg}
                        style={{
                          fontFamily: MONO,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {preview}
                      </T>
                    )}
                  </div>
                </div>
              </ListRow>
            );
          })}
        </div>
      )}
      <DialogHintBar groups={shownHints} />
    </DialogFrame>
  );
}
