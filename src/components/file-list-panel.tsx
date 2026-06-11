import { useEffect, useRef } from "react";
import { useGpuixRequired, type PublicInstance } from "@gpuix/react";
import { useListFollow } from "../hooks/use-list-follow";
import { FileChangeRow, type FileRowData } from "./file-row";

export function FileListPanel({
  files,
  selected,
  onSelect,
  estimatedItemHeight = 22,
}: {
  files: FileRowData[];
  selected: number;
  onSelect: (index: number) => void;
  estimatedItemHeight?: number;
}) {
  const listRef = useRef<PublicInstance | null>(null);
  const renderer = useGpuixRequired();
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
          selected={i === selected}
          onClick={() => onSelect(i)}
        />
      ))}
    </virtual-list>
  );
}
