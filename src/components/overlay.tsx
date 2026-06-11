import type { ReactNode } from "react";
import { Frame, useAdwaita } from "adwaita-gpuix";
import { useWindowSize } from "@gpuix/react";
import { rowHoverBg, scrimBg, selectionBg } from "../theme";

export function DialogFrame({
  width,
  height,
  children,
}: {
  width: number;
  height: number;
  children: ReactNode;
}) {
  const t = useAdwaita();
  const { colors, radii } = t;

  const { width: winW, height: winH } = useWindowSize();
  return (
    <anchored position={{ x: 0, y: 0 }}>
      <div
        style={{
          width: winW,
          height: winH,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",

          backgroundColor: scrimBg(t),
          pointerEvents: "auto",
        }}
      >
        <Frame
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            width,
            height,
            padding: 16,
            borderRadius: radii.card,
            borderWidth: 1,
            borderColor: colors.border,
            boxShadow: {
              offsetX: 0,
              offsetY: 4,
              blurRadius: 16,
              spreadRadius: 0,
              color: "rgba(0,0,0,0.35)",
            },
          }}
        >
          {children}
        </Frame>
      </div>
    </anchored>
  );
}

export function OverlayInput({
  value,
  placeholder,
  onChange,
  onSubmit,
  onKeyDown,
}: {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onKeyDown: (e: { key?: string }) => void;
}) {
  const t = useAdwaita();
  const { colors, radii, typography } = t;
  return (
    <input
      autoFocus
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.value ?? "")}
      onSubmit={onSubmit}
      onKeyDown={onKeyDown}
      style={{
        display: "flex",
        alignItems: "center",
        minHeight: 34,
        paddingLeft: 12,
        paddingRight: 12,
        borderRadius: radii.button,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.window_bg,
        fontSize: typography.body,
        fontFamily: typography.fontFamily,
        color: colors.fg,
      }}
    />
  );
}

export function candidateRowStyle(
  t: ReturnType<typeof useAdwaita>,
  active: boolean,
): Record<string, unknown> {
  const { colors, radii } = t;
  return {
    display: "flex",
    alignItems: "center",
    gap: 8,
    height: 24,
    paddingLeft: 8,
    paddingRight: 8,
    borderRadius: radii.row,
    backgroundColor: active ? selectionBg(t) : "transparent",
    cursor: "pointer",
    hover: { backgroundColor: active ? selectionBg(t) : rowHoverBg(t) },
  };
}

export function windowCandidates(
  candidates: unknown[],
  activeIndex: number,
  maxVisible: number,
): { activeIdx: number; start: number; end: number } {
  const activeIdx = Math.min(activeIndex, Math.max(candidates.length - 1, 0));
  let start = Math.max(activeIdx - (maxVisible - 1), 0);
  const end = Math.min(start + maxVisible, candidates.length);
  start = end - maxVisible;
  return { activeIdx, start, end };
}
