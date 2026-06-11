import { getRawDiff, openFileInEditor } from "../repo";
import type { FileChange } from "../types";
import type { FilePanelFocus } from "./use-file-diff-state";
import { useToast } from "../components/toast";

export function useFilePanelKeys(opts: {
  goFile: (dir: number) => void;
  pageFile: (dir: number, size?: number) => void;
  files: FileChange[];
  fileSel: number;
  setFileSel: (i: number) => void;
  setPatch: (p: string) => void;
  getChangeId: () => string | null;
  scrollDiff: (down: boolean) => void;
  setFocus: (f: FilePanelFocus) => void;

  onBack: () => void;

  onEscape?: () => void;

  onSplit?: () => void;

  onDiscard?: () => void;

  onHunks?: () => void;
}): (key: string) => boolean {
  const {
    goFile,
    pageFile,
    files,
    fileSel,
    setFileSel,
    setPatch,
    getChangeId,
    scrollDiff,
    setFocus,
    onBack,
    onEscape,
    onSplit,
    onDiscard,
    onHunks,
  } = opts;
  const toast = useToast();

  return (key: string): boolean => {
    const id = getChangeId();
    const jump = (index: number): void => {
      setFileSel(index);
      if (id) void getRawDiff(id, files[index]?.path).then(setPatch);
    };
    const optional: Record<string, (() => void) | undefined> = {
      s: onSplit,
      d: onDiscard,
      h: onHunks,
      escape: onEscape,
    };
    switch (key) {
      case "up":
        goFile(-1);
        return true;
      case "down":
        goFile(1);
        return true;
      case "pageup":
        pageFile(-1);
        return true;
      case "pagedown":
        pageFile(1);
        return true;
      case "home":
        if (files.length > 0) jump(0);
        return true;
      case "end":
        if (files.length > 0) jump(files.length - 1);
        return true;
      case "k":
        scrollDiff(false);
        return true;
      case "j":
        scrollDiff(true);
        return true;
      case "tab":
        setFocus("left");
        return true;
      case "e": {
        const f = files[fileSel];
        if (f) {
          openFileInEditor(f.path);
          toast(`Opening ${f.path} in editor`, { type: "info" });
        }
        return true;
      }
      case "q":
        onBack();
        return true;
      default: {
        const cb = optional[key];
        if (cb) {
          void cb();
          return true;
        }
        return false;
      }
    }
  };
}
