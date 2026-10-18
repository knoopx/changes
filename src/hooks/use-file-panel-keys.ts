import { getRawDiff, openFileInEditor } from "../repo";
import type { FileChange } from "../types";
import type { FilePanelFocus } from "./use-file-diff-state";
import { useToast } from "../components/toast";
import { matchShortcut, type KeyMods, type Shortcut } from "../shortcuts";

interface FilePanelKeyCtx {
  goFile: (dir: number) => void;
  pageFile: (dir: number) => void;
  jump: (index: number) => void;
  files: FileChange[];
  setFocus: (f: FilePanelFocus) => void;
  scrollDiff: (down: boolean) => void;
  openSelected: () => void;
  onBack: () => void;
  onEscape?: () => void;
  onSplit?: () => void;
  onDiscard?: () => void;
  onHunks?: () => void;
  onRestoreHunks?: () => void;
}

function fileMoveSel(id: string, ctx: FilePanelKeyCtx): boolean {
  switch (id) {
    case "up":
      ctx.goFile(-1);
      return true;
    case "down":
      ctx.goFile(1);
      return true;
    case "page-up":
      ctx.pageFile(-1);
      return true;
    case "page-down":
      ctx.pageFile(1);
      return true;
    default:
      return false;
  }
}

function fileJumpSel(id: string, ctx: FilePanelKeyCtx): boolean {
  switch (id) {
    case "home":
      if (ctx.files.length > 0) ctx.jump(0);
      return true;
    case "end":
      if (ctx.files.length > 0) ctx.jump(ctx.files.length - 1);
      return true;
    default:
      return false;
  }
}

function fileScroll(id: string, ctx: FilePanelKeyCtx): boolean {
  switch (id) {
    case "scroll-up":
      ctx.scrollDiff(false);
      return true;
    case "scroll-down":
      ctx.scrollDiff(true);
      return true;
    default:
      return false;
  }
}

function fileAction(id: string, ctx: FilePanelKeyCtx): boolean {
  switch (id) {
    case "focus-left":
      ctx.setFocus("left");
      return true;
    case "open":
      ctx.openSelected();
      return true;
    case "back":
      ctx.onBack();
      return true;
    default:
      return false;
  }
}

function fileCallbackAction(id: string, ctx: FilePanelKeyCtx): boolean {
  switch (id) {
    case "escape":
      if (ctx.onEscape) {
        ctx.onEscape();
        return true;
      }
      return false;
    case "split":
      if (ctx.onSplit) {
        ctx.onSplit();
        return true;
      }
      return false;
    case "discard":
      if (ctx.onDiscard) {
        ctx.onDiscard();
        return true;
      }
      return false;
    case "hunks":
      if (ctx.onHunks) {
        ctx.onHunks();
        return true;
      }
      return false;
    case "restore-hunks":
      if (ctx.onRestoreHunks) {
        ctx.onRestoreHunks();
        return true;
      }
      return false;
    default:
      return false;
  }
}

const FILE_MOVE_IDS = new Set(["up", "down", "page-up", "page-down"]);
const FILE_JUMP_IDS = new Set(["home", "end"]);
const FILE_SCROLL_IDS = new Set(["scroll-up", "scroll-down"]);
const FILE_ACTION_IDS = new Set(["focus-left", "open", "back"]);
const FILE_CALLBACK_IDS = new Set([
  "escape",
  "split",
  "discard",
  "hunks",
  "restore-hunks",
]);

export function useFilePanelKeys(opts: {
  set: Shortcut[];
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

  onRestoreHunks?: () => void;
}): (key: string, mods: KeyMods) => boolean {
  const {
    set,
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
    onRestoreHunks,
  } = opts;
  const toast = useToast();

  const jump = (index: number): void => {
    setFileSel(index);
    const id = getChangeId();
    if (id) void getRawDiff(id, files[index]?.path).then(setPatch);
  };

  const openSelected = (): void => {
    const f = files[fileSel];
    if (f) {
      openFileInEditor(f.path);
      toast(`Opening ${f.path} in editor`, { type: "info" });
    }
  };

  const ctx: FilePanelKeyCtx = {
    goFile,
    pageFile,
    jump,
    files,
    setFocus,
    scrollDiff,
    openSelected,
    onBack,
    onEscape,
    onSplit,
    onDiscard,
    onHunks,
    onRestoreHunks,
  };

  return (key: string, mods: KeyMods): boolean => {
    const m = matchShortcut(set, key, mods);
    if (!m) return false;
    if (FILE_MOVE_IDS.has(m.id)) return fileMoveSel(m.id, ctx);
    if (FILE_JUMP_IDS.has(m.id)) return fileJumpSel(m.id, ctx);
    if (FILE_SCROLL_IDS.has(m.id)) return fileScroll(m.id, ctx);
    if (FILE_ACTION_IDS.has(m.id)) return fileAction(m.id, ctx);
    if (FILE_CALLBACK_IDS.has(m.id)) return fileCallbackAction(m.id, ctx);
    return false;
  };
}
