import { T, useAdwaita, hexToRgba, type AdwaitaColors } from "adwaita-gpuix";
import { ListRow } from "./panel";
import { getFileIcon, getFileStatusIcon, getFileIconColor } from "./file-icons";

export interface FileRowData {
  status: string;
  path: string;
  insertions: number;
  deletions: number;
}

const SEGMENTS = 6;

const SEG_W = 3;
const SEG_H = 12;
const SEG_GAP = 1;

const ICON_COL_W = 32;

const STATUS_COL_W = 14;

const COUNT_COL_W = 44;

export function DiffHistogram({
  insertions,
  deletions,
  colors,
}: {
  insertions: number;
  deletions: number;
  colors: AdwaitaColors;
}) {
  const total = insertions + deletions;
  const green = total === 0 ? 0 : Math.round((insertions / total) * SEGMENTS);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        gap: SEG_GAP,
        width: SEGMENTS * SEG_W + (SEGMENTS - 1) * SEG_GAP,
        height: SEG_H,
        flexShrink: 0,
      }}
    >
      {Array.from({ length: SEGMENTS }, (_, i) => (
        <div
          key={i}
          style={{
            width: SEG_W,
            height: SEG_H,
            backgroundColor:
              total === 0
                ? hexToRgba(colors.dim_fg, 0.2)
                : i < green
                  ? colors.success
                  : colors.destructive,
          }}
        />
      ))}
    </div>
  );
}

function statusColorOf(status: string, colors: AdwaitaColors): string {
  if (status === "A") return colors.success;
  if (status === "D") return colors.destructive;
  return colors.warning;
}

export function FileChangeRow({
  file,
  selected = false,
  height = 28,
  onClick,
}: {
  file: FileRowData;
  selected?: boolean;
  height?: number;
  onClick?: () => void;
}) {
  const { colors, typography } = useAdwaita();

  const icon = getFileIcon(file.path);
  const iconColor = getFileIconColor(file.path) ?? colors.dim_fg;

  const statusGlyph = getFileStatusIcon(file.status);
  const statusColor = statusColorOf(file.status, colors);

  const countColumn = (color: string, text: string) => (
    <div
      style={{
        width: COUNT_COL_W,
        flexShrink: 0,
        whiteSpace: "nowrap",
        textOverflow: "ellipsis",
        overflow: "hidden",
      }}
    >
      <T
        size="caption"
        color={color}
        style={{
          width: COUNT_COL_W,
          flexShrink: 0,
          textAlign: "right",
          whiteSpace: "nowrap",
          textOverflow: "ellipsis",
          overflow: "hidden",
          fontSize: 11,
        }}
      >
        {text}
      </T>
    </div>
  );
  return (
    <ListRow selected={selected} height={height} onClick={onClick}>
      {}
      <div
        style={{
          width: ICON_COL_W,
          flexShrink: 0,
          whiteSpace: "nowrap",
          overflow: "hidden",
        }}
      >
        <T
          size="caption"
          color={iconColor}
          style={{
            width: ICON_COL_W,
            flexShrink: 0,
            textAlign: "center",
            whiteSpace: "nowrap",
            overflow: "hidden",
            fontSize: 24,

            fontFamily: typography.fontFamilyMono,
          }}
        >
          {icon}
        </T>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          minWidth: 0,
          flexGrow: 1,

          overflow: "hidden",
        }}
      >
        {}
        <T
          size="caption"
          color={colors.fg}
          style={{
            flexGrow: 1,
            minWidth: 0,
            whiteSpace: "nowrap",
            textOverflow: "ellipsis",
            overflow: "hidden",
          }}
        >
          {file.path}
        </T>
        {}
        <div
          style={{
            width: STATUS_COL_W,
            flexShrink: 0,
            whiteSpace: "nowrap",
            textOverflow: "ellipsis",
            overflow: "hidden",
          }}
        >
          <T
            size="caption"
            color={statusColor}
            style={{
              width: STATUS_COL_W,
              flexShrink: 0,
              textAlign: "center",
              whiteSpace: "nowrap",
              textOverflow: "ellipsis",
              overflow: "hidden",

              fontFamily: typography.fontFamilyMono,
            }}
          >
            {statusGlyph}
          </T>
        </div>
        {}
        {countColumn(colors.success, `+${file.insertions}`)}
        {}
        {countColumn(colors.destructive, `-${file.deletions}`)}
        {}
        <DiffHistogram
          insertions={file.insertions}
          deletions={file.deletions}
          colors={colors}
        />
      </div>
    </ListRow>
  );
}
