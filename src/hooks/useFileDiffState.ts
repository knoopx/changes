import { useState } from "react";
import type { FileChange } from "../types";

export type FilePanelFocus = "left" | "right";

export function useFileDiffPanelState<FileT = FileChange>() {
  const [files, setFiles] = useState<FileT[]>([]);
  const [fileSel, setFileSel] = useState(0);
  const [patch, setPatch] = useState("");
  const [focus, setFocus] = useState<FilePanelFocus>("left");
  const [loading, setLoading] = useState(true);

  const clearFiles = () => {
    setFiles([]);
    setFileSel(0);
    setPatch("");
  };
  return {
    files,
    setFiles,
    fileSel,
    setFileSel,
    patch,
    setPatch,
    focus,
    setFocus,
    loading,
    setLoading,
    clearFiles,
  };
}
