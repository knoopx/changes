import { useEffect, useMemo, useRef } from "react";
import { useGpuixRequired, type PublicInstance } from "@gpuix/react";
import { useListFollow } from "../hooks/useListFollow";
import {
  FileChangeRow,
  fileRowStats,
  type FileRowData,
} from "adwaita-gpuix";

export function FileListPanel({
  files,
  selected,
  onSelect,
  focused = true,
  estimatedItemHeight = 22,
}: {
  files: FileRowData[];
  selected: number;
  onSelect: (index: number) => void;
  
  focused?: boolean;
  estimatedItemHeight?: number;
}) {
  const listRef = useRef<PublicInstance | null>(null);
  const renderer = useGpuixRequired();
  const stats = useMemo(() => fileRowStats(files), [files]);
  const { ensureVisible } = useListFollow(listRef, renderer, 28);

  useEffect(() => {
    ensureVisible(selected);
  }, [selected, ensureVisible]);

  return (
    <virtual-list
      ref={listRef}
      style={{
        display: "flex",
        flexDirection: "column",
        flexGrow: 1,
        minHeight: 0,
        width: "100%",
      }}
      estimatedItemHeight={estimatedItemHeight}
    >
      {files.map((f, i) => (
        <FileChangeRow
          key={f.path + i}
          file={f}
          stats={stats}
          selected={i === selected}
          focused={focused}
          onClick={() => onSelect(i)}
        />
      ))}
    </virtual-list>
  );
}
