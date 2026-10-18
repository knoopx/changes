import { useEffect, useState } from "react";
import { Icon, KbdGroup, T, useAdwaita, groupHints, ShortcutHint, candidateRowStyle, DialogFrame, OverlayInput, windowCandidates } from "adwaita-gpuix";
import { failMessage } from "../errors";
import { forgetBookmark, listBookmarks, setBookmarkToChange } from "../repo";
import { BOOKMARK_OVERLAY, hints, matchShortcut } from "../shortcuts";

export function BookmarkOverlay({
  targetChangeId,
  onDone,
}: {
  targetChangeId: string;
  onDone: (msg: string | null) => void;
}) {
  const t = useAdwaita();
  const { colors } = t;
  const [value, setValue] = useState("");
  const [names, setNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    listBookmarks()
      .then((bms) => {
        if (cancelled) return;
        const sorted = bms.map((b) => b.name).sort();
        setNames(Array.from(new Set(sorted)));
      })
      .catch(() => {
        if (!cancelled) setNames([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const q = value.trim().toLowerCase();
  let candidates: string[];
  if (q === "") {
    candidates = names;
  } else {
    const filtered = names.filter((n) => n.toLowerCase().includes(q));
    const exact = names.some((n) => n.toLowerCase() === q);
    if (!exact) filtered.push(value.trim());
    candidates = filtered;
  }
  const active = candidates[activeIndex] ?? null;

  const submit = async () => {
    if (!active) {
      onDone(null);
      return;
    }
    try {
      const msg = await setBookmarkToChange(active, targetChangeId);
      onDone(msg);
    } catch (e) {
      onDone(failMessage(e));
    }
  };

  const doForget = async () => {
    const name = candidates[activeIndex];
    if (!name || !names.includes(name)) return;
    try {
      await forgetBookmark(name);
      onDone(`Forgot bookmarks: ${name}`);
    } catch (e) {
      onDone(failMessage(e));
    }
  };

  const {
    activeIdx,
    start,
    end,
  } = windowCandidates(
    candidates,
    activeIndex,
    5,
  );

  const byId = (id: string) =>
    BOOKMARK_OVERLAY.find((s) => s.id === id)!;
  const empty = candidates.length === 0 && !loading;
  const shownHints = groupHints(
    (empty
      ? ["type", "set", "cancel"]
      : hints(BOOKMARK_OVERLAY).map((s) => s.id)
    ).map(byId),
  );

  return (
    <DialogFrame width={520} height={260}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Icon name="bookmark" size={18} color={colors.accent} />
        <T size="title2" weight={700} color={colors.fg}>
          Set Bookmark
        </T>
      </div>
      <OverlayInput
        value={value}
        placeholder="type bookmark"
        onChange={(v) => {
          setValue(v);
          setActiveIndex(0);
        }}
        onSubmit={submit}
        onKeyDown={(e) => {
          const k = (e.key ?? "").toLowerCase();
          const m = matchShortcut(BOOKMARK_OVERLAY, k);
          if (!m) return;
          switch (m.id) {
            case "nav-up":
              setActiveIndex((i) => Math.max(0, i - 1));
              break;
            case "nav-down":
              setActiveIndex((i) =>
                Math.min(i + 1, Math.max(candidates.length - 1, 0)),
              );
              break;
            case "cancel":
              onDone(null);
              break;
            case "forget":
              void doForget();
              break;
            default:
              break; 
          }
        }}
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
          flexGrow: 1,
          minHeight: 0,
        }}
      >
        {loading ? (
          <T size="body" color={colors.dim_fg}>
            Loading bookmarks…
          </T>
        ) : candidates.length === 0 ? (
          <T size="body" color={colors.dim_fg}>
            No bookmarks yet. Type to create one.
          </T>
        ) : (
          candidates.slice(start, end).map((c, i) => {
            const idx = start + i;
            const isCreate = !names.includes(c);
            const isActive = idx === activeIdx;
            const color =
              isActive || isCreate
                ? isActive
                  ? colors.accent
                  : colors.warning
                : null;
            return (
              <div
                key={c + idx}
                onClick={() => {
                  setActiveIndex(idx);
                  void submit();
                }}
                style={candidateRowStyle(t, isActive)}
              >
                <Icon
                  name={isCreate ? "plus" : "bookmark"}
                  size={14}
                  color={color ?? colors.dim_fg}
                />
                <T
                  size="body"
                  weight={isActive ? 600 : 400}
                  color={color ?? colors.fg}
                >
                  {c}
                </T>
              </div>
            );
          })
        )}
      </div>
      <KbdGroup>
        {shownHints.map((g) => (
          <ShortcutHint key={g.desc} group={g} />
        ))}
      </KbdGroup>
    </DialogFrame>
  );
}
