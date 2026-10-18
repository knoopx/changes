import { useState } from "react";
import { Icon, T, useAdwaita, type IconName, groupHints, ShortcutHints, candidateRowStyle, DialogFrame, OverlayInput, windowCandidates } from "adwaita-gpuix";
import { completeRevset, revsetSignatureHelp, type RevsetCandidate } from "../revsets";
import { REVOLET_OVERLAY, hints, matchShortcut } from "../shortcuts";

const KIND_ICON: Record<RevsetCandidate["kind"], IconName> = {
  filter: "list",
  function: "list", 
  keyword: "list", 
  bookmark: "bookmark",
  change: "gitBranch",
  file: "fileText", 
};

export function RevsetOverlay({
  initial,
  filters,
  bookmarkNames,
  changeIds,
  filePaths,
  onApply,
  onCancel,
}: {
  initial: string;
  filters: ReadonlyArray<readonly [string, string]>;
  bookmarkNames: string[];
  changeIds: string[];
  filePaths: string[];
  onApply: (revset: string, label: string) => void;
  onCancel: () => void;
}) {
  const t = useAdwaita();
  const { colors } = t;
  const [value, setValue] = useState(initial);
  const [activeIndex, setActiveIndex] = useState(0);

  const cands = completeRevset(value, {
    filters,
    bookmarkNames,
    changeIds,
    filePaths,
  });
  const sig = revsetSignatureHelp(value);

  const insertAtCursor = (insert: string) => {
    const m = /([A-Za-z0-9_@.:/-]+)$/.exec(value);
    const trailing = m ? m[1].length : 0;
    setValue(value.slice(0, value.length - trailing) + insert);
    setActiveIndex(0);
  };

  const selectCandidate = (cand: RevsetCandidate) => {
    if (cand.kind === "filter") {
      onApply(cand.insert, cand.label);
      return;
    }
    insertAtCursor(cand.insert);
  };

  const applyEnter = () => {
    const v = value.trim();
    if (v !== "") {
      onApply(v, v);
      return;
    }
    const idx = filters.findIndex((f) => f[1] === initial);
    if (idx >= 0) onApply(initial, filters[idx][0]);
    else onCancel();
  };

  const { activeIdx, start, end } = windowCandidates(cands, activeIndex, 6);

  return (
    <DialogFrame width={560} height={280}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Icon name="list" size={18} color={colors.accent} />
        <T size="title2" weight={700} color={colors.fg}>
          Revset Filter
        </T>
      </div>
      <OverlayInput
        value={value}
        placeholder="type a revset"
        onChange={(v) => {
          setValue(v);
          setActiveIndex(0);
        }}
        onSubmit={() => {}}
        onKeyDown={(e) => {
          const k = (e.key ?? "").toLowerCase();
          const m = matchShortcut(REVOLET_OVERLAY, k);
          if (!m) return;
          switch (m.id) {
            case "nav-up":
              setActiveIndex((i) => Math.max(0, i - 1));
              break;
            case "nav-down":
              setActiveIndex((i) =>
                Math.min(i + 1, Math.max(cands.length - 1, 0)),
              );
              break;
            case "apply":
              applyEnter();
              break;
            case "cancel":
              onCancel();
              break;
            default:
              break;
          }
        }}
      />
      {sig && (
        <T size="caption" color={colors.dim_fg} style={{ whiteSpace: "nowrap" }}>
          {`${sig.signature}  —  ${sig.description}`}
        </T>
      )}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
          flexGrow: 1,
          minHeight: 0,
        }}
      >
        {cands.length === 0 ? (
          <T size="body" color={colors.dim_fg}>
            No candidates.
          </T>
        ) : (
          cands.slice(start, end).map((cand, i) => {
            const idx = start + i;
            const isActive = idx === activeIdx;
            return (
              <div
                key={cand.kind + cand.insert + idx}
                onClick={() => {
                  setActiveIndex(idx);
                  selectCandidate(cand);
                }}
                style={candidateRowStyle(t, isActive)}
              >
                <Icon
                  name={KIND_ICON[cand.kind]}
                  size={14}
                  color={isActive ? colors.accent : colors.dim_fg}
                />
                <T
                  size="body"
                  weight={isActive ? 600 : 400}
                  color={isActive ? colors.accent : colors.fg}
                  style={{ minWidth: 0, whiteSpace: "nowrap" }}
                >
                  {cand.label}
                </T>
                {cand.detail ? (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                      flexGrow: 1,
                      minWidth: 0,
                    }}
                  >
                    <T
                      size="caption"
                      color={colors.dim_fg}
                      style={{ whiteSpace: "nowrap" }}
                    >
                      {cand.detail}
                    </T>
                  </div>
                ) : (
                  <div style={{ flexGrow: 1 }} />
                )}
              </div>
            );
          })
        )}
      </div>
      <ShortcutHints groups={groupHints(hints(REVOLET_OVERLAY))} />
    </DialogFrame>
  );
}
