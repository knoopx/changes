import { useMemo, type Ref } from "react";
import { T, useAdwaita } from "adwaita-gpuix";
import type { PublicInstance, StyleDesc } from "@gpuix/react";
import { MONO } from "../theme";
import { alignTables, type TabularSides } from "../tabular";

const MAX_ROWS = 500;

const ROW_H = 22;

const CHAR_W = 7.2;

const CELL_PAD = 8;

const MAX_CELL = 40;

const MAX_COMPOSITE = 48;

function dispLen(s: string, cap: number): number {
  return Math.min(s.length, cap);
}

export function DataTable({
  sides,
  scrollRef,
}: {
  sides: TabularSides;

  scrollRef?: Ref<PublicInstance>;
}) {
  const t = useAdwaita();
  const { colors } = t;

  const aligned = useMemo(
    () => alignTables(sides.old, sides.next, sides.hasHeader),
    [sides],
  );
  const rows = aligned.rows;
  const shown = rows.length > MAX_ROWS ? rows.slice(0, MAX_ROWS) : rows;

  const colWidths = useMemo(() => {
    const widths = new Array<number>(aligned.cols).fill(0);
    for (let c = 0; c < aligned.cols; c++) {
      let m = dispLen(aligned.header[c] ?? "", MAX_CELL);
      for (const r of rows) {
        if (r.kind === "pair") {
          const cell = r.cells[c];
          if (!cell) continue;
          m = Math.max(
            m,
            cell.changed
              ? dispLen(`${cell.old} → ${cell.next}`, MAX_COMPOSITE)
              : dispLen(cell.next, MAX_CELL),
          );
        } else {
          m = Math.max(m, dispLen(r.cells[c] ?? "", MAX_CELL));
        }
      }
      widths[c] = CELL_PAD * 2 + m * CHAR_W;
    }
    return widths;
  }, [aligned, rows]);

  const gutterWidth = useMemo(() => {
    const maxNo = Math.max(rows.length, 1);
    return CELL_PAD * 2 + (String(maxNo).length * 2 + 1) * CHAR_W;
  }, [rows.length]);

  const counts = useMemo(() => {
    let added = 0;
    let removed = 0;
    let changed = 0;
    for (const r of rows) {
      if (r.kind === "added") added++;
      else if (r.kind === "removed") removed++;
      else for (const c of r.cells) if (c.changed) changed++;
    }
    return { added, removed, changed };
  }, [rows]);

  const tableWidth = gutterWidth + colWidths.reduce((a, b) => a + b, 0);

  const cellStyle = (width: number): StyleDesc => ({
    width,
    flexShrink: 0,
    paddingLeft: CELL_PAD / 2,
    paddingRight: CELL_PAD / 2,
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
    overflow: "hidden",
    fontFamily: MONO,
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flexGrow: 1,
        minHeight: 0,
        minWidth: 0,
      }}
    >
      {}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          height: 20,
          paddingLeft: 8,
          paddingRight: 8,
          borderBottomWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.headerbar_bg,
          flexShrink: 0,
        }}
      >
        <T
          size="caption"
          color={colors.dim_fg}
          style={{ whiteSpace: "nowrap" }}
        >
          {`rows ${rows.length}`}
        </T>
        <T
          size="caption"
          color={colors.success}
          style={{ whiteSpace: "nowrap" }}
        >
          {`+${counts.added}`}
        </T>
        <T
          size="caption"
          color={colors.destructive}
          style={{ whiteSpace: "nowrap" }}
        >
          {`−${counts.removed}`}
        </T>
        <T
          size="caption"
          color={colors.warning}
          style={{ whiteSpace: "nowrap" }}
        >
          {`~${counts.changed} cells`}
        </T>
        <T
          size="caption"
          color={colors.dim_fg}
          style={{
            whiteSpace: "nowrap",
            flexGrow: 1,
            textAlign: "right" as const,
          }}
        >
          {sides.delim === "\t" ? "tsv" : `delim "${sides.delim}"`}
        </T>
      </div>

      {}
      <div
        ref={scrollRef}
        style={{
          display: "flex",
          flexDirection: "column",
          flexGrow: 1,
          minHeight: 0,
          minWidth: 0,
          overflow: "scroll",
          padding: 8,
          backgroundColor: colors.view_bg,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: tableWidth,
            flexShrink: 0,
          }}
        >
          {}
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              height: ROW_H,
              backgroundColor: colors.headerbar_bg,
              borderBottomWidth: 1,
              borderColor: colors.border,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: gutterWidth,
                flexShrink: 0,
                paddingLeft: CELL_PAD / 2,
                paddingRight: CELL_PAD / 2,
              }}
            >
              <T
                size="caption"
                weight={700}
                color={colors.dim_fg}
                style={{ fontFamily: MONO, whiteSpace: "nowrap" }}
              >
                {"#"}
              </T>
            </div>
            {aligned.header.map((label, c) => (
              <div key={c} style={cellStyle(colWidths[c] as number)}>
                <T
                  size="caption"
                  weight={700}
                  color={colors.dim_fg}
                  style={cellStyle(colWidths[c] as number)}
                >
                  {label}
                </T>
              </div>
            ))}
          </div>

          {}
          {shown.map((r, ri) => {
            const bg =
              r.kind === "added"
                ? colors.successTint
                : r.kind === "removed"
                  ? colors.destructiveTint
                  : "transparent";
            const gutterText =
              r.kind === "pair"
                ? `${r.oldNo}:${r.nextNo}`
                : r.kind === "added"
                  ? `·:${r.nextNo}`
                  : `${r.oldNo}:·`;
            const gutterColor =
              r.kind === "added"
                ? colors.success
                : r.kind === "removed"
                  ? colors.destructive
                  : colors.dim_fg;
            return (
              <div
                key={ri}
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  height: ROW_H,
                  backgroundColor: bg,
                  borderBottomWidth: 1,
                  borderColor: colors.border,
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    width: gutterWidth,
                    flexShrink: 0,
                    paddingLeft: CELL_PAD / 2,
                    paddingRight: CELL_PAD / 2,
                  }}
                >
                  <T
                    size="caption"
                    color={gutterColor}
                    style={{ fontFamily: MONO, whiteSpace: "nowrap" }}
                  >
                    {gutterText}
                  </T>
                </div>
                {r.kind === "pair"
                  ? r.cells.map((cell, c) =>
                      cell ? (
                        <div
                          key={c}
                          style={{
                            width: colWidths[c],
                            flexShrink: 0,
                            backgroundColor: cell.changed
                              ? colors.warningTint
                              : "transparent",
                          }}
                        >
                          <T
                            size="caption"
                            color={cell.changed ? colors.warning : colors.fg}
                            weight={cell.changed ? 600 : 400}
                            style={cellStyle(colWidths[c] as number)}
                          >
                            {cell.changed
                              ? `${cell.old} → ${cell.next}`
                              : cell.next}
                          </T>
                        </div>
                      ) : null,
                    )
                  : r.cells.map((v, c) => (
                      <div
                        key={c}
                        style={{ width: colWidths[c], flexShrink: 0 }}
                      >
                        <T
                          size="caption"
                          color={
                            r.kind === "added"
                              ? colors.success
                              : colors.destructive
                          }
                          style={cellStyle(colWidths[c] as number)}
                        >
                          {v}
                        </T>
                      </div>
                    ))}
              </div>
            );
          })}

          {}
          {rows.length > MAX_ROWS && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: ROW_H,
                flexShrink: 0,
                backgroundColor: colors.view_bg,
              }}
            >
              <T
                size="caption"
                color={colors.dim_fg}
                style={{ whiteSpace: "nowrap" }}
              >
                {`… ${rows.length - MAX_ROWS} more rows not shown`}
              </T>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
