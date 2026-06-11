import { useGpuixRequired, type PublicInstance } from "@gpuix/react";
import type { Ref } from "react";
import { useAdwaita } from "adwaita-gpuix";
import { DataTable } from "./datatable";
import type { TabularSides } from "../tabular";
import { nativeDiffTheme } from "../theme";

const MAX_DIFF_LINES = 500;

export function DiffPanel({
  patch,
  tabular = null,
  diffRef,
}: {
  patch: string;

  tabular?: TabularSides | null;

  diffRef?: Ref<PublicInstance>;
}) {
  const t = useAdwaita();
  const { colors } = t;

  useGpuixRequired();
  return tabular ? (
    <DataTable sides={tabular} scrollRef={diffRef} />
  ) : (
    <div
      ref={diffRef}
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
      <diff
        patch={patch}
        wordDiff
        maxLines={MAX_DIFF_LINES}
        theme={nativeDiffTheme(t)}
      />
    </div>
  );
}
