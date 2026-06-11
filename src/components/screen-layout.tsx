import type { ReactNode } from "react";
import { Panel } from "./panel";

export function ScreenLayout({
  leftTitle,
  leftFocused,
  leftGrow = 28,
  left,
  rightGrow = 72,
  mid,
  bottomTitle,
  bottom,
  trailing,
  midTitle,
  midFocused,
  midTrailing,
  bottomTrailing,
  midHeaderless,
}: {
  leftTitle: ReactNode;
  leftFocused: boolean;
  leftGrow?: number;
  left: ReactNode;
  rightGrow?: number;

  mid?: ReactNode;
  bottomTitle: ReactNode;
  bottom: ReactNode;

  trailing?: ReactNode;

  midTitle?: ReactNode;

  midFocused?: boolean;

  midTrailing?: ReactNode;

  bottomTrailing?: ReactNode;

  midHeaderless?: boolean;
}) {
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
        title={leftTitle}
        focused={leftFocused}
        trailing={trailing}
        style={{ flexGrow: leftGrow, flexBasis: 0, minWidth: 0 }}
      >
        {left}
      </Panel>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          flexGrow: rightGrow,
          flexBasis: 0,
          minWidth: 0,
          minHeight: 0,
        }}
      >
        {mid != null && (
          <Panel
            title={midTitle}
            focused={midFocused}
            trailing={midTrailing ?? trailing}
            headerless={midHeaderless}
            style={{ flexGrow: 30, flexBasis: 0, minHeight: 0 }}
          >
            {mid}
          </Panel>
        )}
        <Panel
          title={bottomTitle}
          focused={false}
          trailing={bottomTrailing}
          style={{
            flexGrow: mid != null ? 70 : 100,
            flexBasis: 0,
            minHeight: 0,
          }}
        >
          {bottom}
        </Panel>
      </div>
    </div>
  );
}
