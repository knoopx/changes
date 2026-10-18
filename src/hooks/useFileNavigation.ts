import { getRawDiff } from "../repo";
import { clampIndex, wrapIndex } from "../indexing";
import type { FileChange } from "../types";

export function useFileNavigation(opts: {
  files: FileChange[];
  fileSel: number;
  setFileSel: (i: number) => void;
  setPatch: (p: string) => void;
  getChangeId: () => string | null;
}) {
  const { files, fileSel, setFileSel, setPatch, getChangeId } = opts;

  const goFile = (dir: number) => {
    if (files.length === 0) return;
    const nf = wrapIndex(fileSel, dir, files.length);
    setFileSel(nf);
    const id = getChangeId();
    if (id) void getRawDiff(id, files[nf]?.path).then(setPatch);
  };

  const pageFile = (dir: number, size = 10) => {
    if (files.length === 0) return;
    const nf = clampIndex(fileSel, dir * size, files.length);
    if (nf === fileSel) return;
    setFileSel(nf);
    const id = getChangeId();
    if (id) void getRawDiff(id, files[nf]?.path).then(setPatch);
  };
  return { goFile, pageFile };
}
