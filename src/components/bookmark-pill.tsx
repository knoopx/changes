import { Icon, T, useAdwaita } from "adwaita-gpuix";

const PILL_H = 22;
const PILL_PAD_X = 8;
const PILL_GAP = 4;
const PILL_ICON = 12;

const PILL_TEXT_MIN = 24;

const PILL_MIN_W = PILL_ICON + PILL_PAD_X * 2 + PILL_GAP + PILL_TEXT_MIN + 2;

export function BookmarkPill({
  name,
  dimmed = false,
}: {
  name: string;
  dimmed?: boolean;
}) {
  const { colors, radii } = useAdwaita();
  const fg = dimmed ? colors.dim_fg : colors.fg;
  const iconColor = dimmed ? colors.dim_fg : colors.accent;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: PILL_GAP,
        height: PILL_H,
        paddingLeft: PILL_PAD_X,
        paddingRight: PILL_PAD_X,
        borderRadius: radii.pill,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.view_bg,
        flexShrink: 1,
        minWidth: PILL_MIN_W,
      }}
    >
      <Icon name="bookmark" size={PILL_ICON} color={iconColor} />
      <T
        size="caption"
        color={fg}
        style={{
          whiteSpace: "nowrap",
          minWidth: PILL_TEXT_MIN,
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {name}
      </T>
    </div>
  );
}
