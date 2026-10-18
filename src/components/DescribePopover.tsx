import { useState } from "react";
import { Icon, T, Textarea, useAdwaita, groupHints, ShortcutHints } from "adwaita-gpuix";
import { failMessage } from "../errors";
import { describeChange } from "../repo";
import { DESCRIBE_OVERLAY, hints, matchShortcut } from "../shortcuts";

function arrowSrc(border: string, bg: string, up: boolean): string {
  const back = up ? "M0 7 L12 7 L6 0 Z" : "M0 0 L12 0 L6 7 Z";
  const front = up ? "M1 7 L11 7 L6 1.5 Z" : "M1 0 L11 0 L6 5.5 Z";
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="7" viewBox="0 0 12 7">` +
    `<path d="${back}" fill="${border}"/>` +
    `<path d="${front}" fill="${bg}"/>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function DescribePopover({
  targetIds,
  side = "top",
  onDone,
}: {
  targetIds: string[];

  side?: "top" | "bottom";
  onDone: (msg: string | null) => void;
}) {
  const t = useAdwaita();
  const { colors, radii } = t;
  const [value, setValue] = useState("");

  const submit = async () => {
    const msg = value.trim();
    if (msg.length === 0) {
      onDone(null);
      return;
    }
    try {
      for (const id of targetIds) {
        await describeChange(id, msg);
      }
      onDone(
        `Described ${targetIds.length} change${targetIds.length === 1 ? "" : "s"}`,
      );
    } catch (e) {
      onDone(failMessage(e));
    }
  };

  const arrow = (
    <img
      src={arrowSrc(colors.border, colors.view_bg, side === "bottom")}
      style={{
        position: "absolute",
        width: 12,
        height: 7,
        left: 214,
        marginLeft: -6,
        ...(side === "bottom" ? { top: -6 } : { bottom: -6 }),
      }}
    />
  );

  return (
    <anchored
      side={side}
      align="start"
      offset={{ x: 0, y: 8 }}
      fit="snap"
      snapMargin={8}
      deferred
      priority={1}
      occlude
    >
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          width: 440,
          padding: 12,
          borderRadius: radii.card,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.view_bg,
          boxShadow: {
            offsetX: 0,
            offsetY: 4,
            blurRadius: 16,
            spreadRadius: 0,
            color: "rgba(0,0,0,0.35)",
          },
        }}
      >
        {arrow}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="fileText" size={18} color={colors.accent} />
          {}
          <T size="title4" weight={700} color={colors.fg}>
            {`Describe (${targetIds.length} change${targetIds.length === 1 ? "" : "s"})`}
          </T>
        </div>
        <Textarea
          autoFocus
          value={value}
          placeholder="change description"
          rows={3}
          onChange={(v) => setValue(v)}
          style={{ flexGrow: 1 }}
          onKeyDown={(e) => {
            const k = (e.key ?? "").toLowerCase();
            const m = matchShortcut(DESCRIBE_OVERLAY, k, {
              ctrl: e.modifiers?.ctrl ?? false,
              cmd: e.modifiers?.cmd ?? false,
            });
            if (!m) return;
            switch (m.id) {
              case "describe":
                void submit();
                break;
              case "cancel":
                onDone(null);
                break;
              default:
                break;
            }
          }}
        />
        <ShortcutHints groups={groupHints(hints(DESCRIBE_OVERLAY))} />
      </div>
    </anchored>
  );
}
