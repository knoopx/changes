import type { ReactNode } from "react";
import { Frame, Icon, T, useAdwaita, type IconName } from "adwaita-gpuix";
import { rowHoverBg, selectionBg } from "../theme";
import { BookmarkPill } from "./bookmark-pill";

export interface PanelProps {
  title: ReactNode;
  focused?: boolean;

  trailing?: ReactNode;

  headerless?: boolean;
  children: ReactNode;
  style?: Record<string, unknown>;
}

export function Panel({
  title,
  focused = false,
  trailing,
  headerless = false,
  children,
  style = {},
}: PanelProps) {
  const t = useAdwaita();
  const { colors, radii } = t;
  return (
    <Frame
      style={{
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
        minHeight: 0,
        overflow: "hidden",
        borderRadius: radii.card,
        borderColor: focused ? colors.accent : colors.border,
        ...style,
      }}
    >
      {!headerless && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            paddingLeft: 12,
            paddingRight: 12,
            paddingTop: 8,
            paddingBottom: 8,
            borderBottomWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.headerbar_bg,
            minWidth: 0,
          }}
        >
          {}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              flexGrow: 1,
              minWidth: 0,
            }}
          >
            {typeof title === "string" ? (
              <T
                size="title4"
                weight={600}
                color={focused ? colors.accent : colors.fg}
                style={{ minWidth: 0, whiteSpace: "nowrap" }}
              >
                {title}
              </T>
            ) : (
              title
            )}
          </div>
          {trailing}
        </div>
      )}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flexGrow: 1,
          minHeight: 0,
          minWidth: 0,
        }}
      >
        {children}
      </div>
    </Frame>
  );
}

export function ListRow({
  selected = false,
  current = false,
  onClick,
  children,
  height = 24,
  style = {},
}: {
  selected?: boolean;
  current?: boolean;
  onClick?: () => void;
  children: ReactNode;
  height?: number;
  style?: Record<string, unknown>;
}) {
  const t = useAdwaita();
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        width: "100%",
        height,
        paddingLeft: 8,
        paddingRight: 8,
        backgroundColor: selected ? selectionBg(t) : "transparent",
        cursor: "pointer",
        hover: { backgroundColor: selected ? selectionBg(t) : rowHoverBg(t) },
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Line({
  children,
  color,
  bold = false,
  indent = 0,
}: {
  children: ReactNode;
  color?: string;
  bold?: boolean;
  indent?: number;
}) {
  const t = useAdwaita();
  return (
    <div style={{ display: "flex", paddingLeft: indent, height: 18 }}>
      <T
        size="body"
        weight={bold ? 600 : 400}
        color={color ?? t.colors.fg}
        style={{ whiteSpace: "nowrap" }}
      >
        {children}
      </T>
    </div>
  );
}

export function RowShell({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        minWidth: 0,
        flexGrow: 1,
      }}
    >
      {children}
    </div>
  );
}

export function PillGroup({
  names,
  dimmed = false,
}: {
  names: string[];
  dimmed?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        gap: 4,
        minWidth: 0,
        flexShrink: 1,
        overflow: "hidden",
      }}
    >
      {names.map((n) => (
        <BookmarkPill key={n} name={n} dimmed={dimmed} />
      ))}
    </div>
  );
}

export function RowIcon({
  name,
  color,
  size = 14,
}: {
  name: IconName;
  color: string;
  size?: number;
}) {
  return (
    <div
      style={{
        width: 14,
        flexShrink: 0,
        display: "flex",
        justifyContent: "center",
      }}
    >
      <Icon name={name} size={size} color={color} />
    </div>
  );
}
