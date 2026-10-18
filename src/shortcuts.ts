import { type View } from "./types";
import {
  type Shortcut,
  type KeyMods,
  matchShortcut,
  hints,
  NAV,
  PAGED_NAV,
} from "adwaita-gpuix";

export type Kbd = string | string[];

export type { Shortcut, KeyMods };
export { matchShortcut, hints };

export const CHANGES_LEFT: Shortcut[] = [
  ...PAGED_NAV,
  { id: "focus-right", kbds: ["tab"], desc: "focus" },
  { id: "new", kbds: ["n"], desc: "new" },
  { id: "edit", kbds: ["e"], desc: "edit" },
  { id: "split", kbds: ["s"], desc: "split" },
  { id: "squash", kbds: ["f"], desc: "squash" },
  { id: "absorb", kbds: ["a"], desc: "absorb" },
  { id: "revert", kbds: ["r"], desc: "revert" },
  { id: "bookmark", kbds: ["b"], desc: "bm" },
  { id: "evolog", kbds: ["v"], desc: "evolog" },
  { id: "move", kbds: ["enter"], desc: "move" },
  { id: "select", kbds: ["space"], desc: "sel" },
  { id: "describe", kbds: ["d"], desc: "desc" },
  { id: "copy-id", kbds: ["i"], desc: "id" },
  { id: "push", kbds: [["ctrl", "p"]], desc: "push" },
  { id: "drop", kbds: ["delete"], desc: "drop" },
  { id: "view", kbds: [["ctrl", "left"], ["ctrl", "right"]], desc: "view" },
  { id: "filter", kbds: ["/"], desc: "filter", hint: false },
];

export const CHANGES_RIGHT: Shortcut[] = [
  { id: "up", kbds: ["up"], desc: "nav" },
  { id: "down", kbds: ["down"], desc: "nav" },
  { id: "page-up", kbds: ["pageup"], desc: "file", hint: false },
  { id: "page-down", kbds: ["pagedown"], desc: "file", hint: false },
  { id: "home", kbds: ["home"], desc: "file", hint: false },
  { id: "end", kbds: ["end"], desc: "file", hint: false },
  {
    id: "scroll-up-page",
    kbds: [["shift", "pageup"]],
    desc: "scr",
  },
  {
    id: "scroll-down-page",
    kbds: [["shift", "pagedown"]],
    desc: "scr",
  },
  { id: "focus-left", kbds: ["tab"], desc: "focus" },
  { id: "open", kbds: ["e"], desc: "open" },
  { id: "split", kbds: ["s"], desc: "split" },
  { id: "discard", kbds: ["d"], desc: "discard" },
  { id: "restore-hunks", kbds: ["i"], desc: "rest" },
  { id: "hunks", kbds: ["h"], desc: "hunks" },
  { id: "back", kbds: ["q"], desc: "back", hint: false },
  { id: "view", kbds: [["ctrl", "left"], ["ctrl", "right"]], desc: "view" },
];

export const CHANGES_MOVE: Shortcut[] = [
  { id: "up", kbds: ["up"], desc: "move" },
  { id: "down", kbds: ["down"], desc: "move" },
  { id: "apply", kbds: ["enter"], desc: "apply" },
  { id: "cancel", kbds: ["escape"], desc: "cancel" },
];

export const BOOKMARKS_LEFT: Shortcut[] = [
  ...PAGED_NAV,
  { id: "focus-right", kbds: ["tab"], desc: "focus" },
  { id: "new", kbds: ["n"], desc: "new" },
  { id: "forget", kbds: ["delete"], desc: "forget" },
  { id: "fetch", kbds: ["g"], desc: "fetch" },
  { id: "push", kbds: ["p"], desc: "push" },
  { id: "back", kbds: ["q", "escape"], desc: "back" },
];

export const BOOKMARK_OVERLAY: Shortcut[] = [
  { id: "type", kbds: ["type"], desc: "bookmark", hint: false },
  { id: "nav-up", kbds: ["up"], desc: "nav" },
  { id: "nav-down", kbds: ["down"], desc: "nav" },
  { id: "set", kbds: ["enter"], desc: "set" },
  { id: "cancel", kbds: ["escape"], desc: "cancel" },
  { id: "forget", kbds: ["delete"], desc: "forget" },
];

export const BOOKMARKS_RIGHT: Shortcut[] = [
  { id: "up", kbds: ["up"], desc: "nav" },
  { id: "down", kbds: ["down"], desc: "nav" },
  { id: "page-up", kbds: ["pageup"], desc: "nav", hint: false },
  { id: "page-down", kbds: ["pagedown"], desc: "nav", hint: false },
  { id: "home", kbds: ["home"], desc: "nav", hint: false },
  { id: "end", kbds: ["end"], desc: "nav", hint: false },
  { id: "focus-left", kbds: ["tab"], desc: "focus" },
  { id: "open", kbds: ["e"], desc: "editor" },
  { id: "back", kbds: ["q"], desc: "back" },
  { id: "escape", kbds: ["escape"], desc: "back" },
];

export const WS_LEFT: Shortcut[] = [
  ...PAGED_NAV,
  { id: "focus-right", kbds: ["tab"], desc: "focus" },
  { id: "new", kbds: ["n"], desc: "new" },
  { id: "attach", kbds: ["a"], desc: "attach" },
  { id: "rebase", kbds: ["r"], desc: "rebase" },
  { id: "edit", kbds: ["e"], desc: "edit" },
  { id: "term", kbds: ["t"], desc: "term" },
  { id: "forget", kbds: ["d", ["ctrl", "d"]], desc: "del" },
  { id: "back", kbds: ["q", "escape"], desc: "back" },
];

export const WS_RIGHT: Shortcut[] = [
  ...NAV,
  { id: "scroll-up", kbds: ["pageup"], desc: "scr" },
  { id: "scroll-down", kbds: ["pagedown"], desc: "scr" },
  { id: "focus-left", kbds: ["tab"], desc: "focus" },
  { id: "discard", kbds: ["d"], desc: "discard" },
  { id: "back", kbds: ["q", "escape"], desc: "back" },
];

export const OPLOG: Shortcut[] = [
  ...NAV,
  { id: "restore", kbds: ["r"], desc: "restore" },
  { id: "undo", kbds: ["u"], desc: "undo" },
  { id: "redo", kbds: [["shift", "u"]], desc: "redo" },
  { id: "back", kbds: ["q", "escape"], desc: "back" },
  { id: "view", kbds: [["ctrl", "left"], ["ctrl", "right"]], desc: "view" },
];

export const EVOLONG: Shortcut[] = [
  ...NAV,
  { id: "back", kbds: ["q", "escape"], desc: "back" },
  { id: "view", kbds: [["ctrl", "left"], ["ctrl", "right"]], desc: "view" },
];

export const REVOLET_OVERLAY: Shortcut[] = [
  { id: "type", kbds: ["type"], desc: "revset", hint: false },
  { id: "nav-up", kbds: ["up"], desc: "nav" },
  { id: "nav-down", kbds: ["down"], desc: "nav" },
  { id: "apply", kbds: ["enter"], desc: "apply" },
  { id: "cancel", kbds: ["escape"], desc: "cancel" },
];

export const RESTORE_OVERLAY: Shortcut[] = [
  { id: "select", kbds: ["space"], desc: "select" },
  { id: "nav-up", kbds: ["up"], desc: "nav" },
  { id: "nav-down", kbds: ["down"], desc: "nav" },
  { id: "apply", kbds: [["ctrl", "enter"], ["cmd", "enter"]], desc: "apply" },
  { id: "cancel", kbds: ["escape"], desc: "cancel" },
];

export const HUNKS: Shortcut[] = [
  ...NAV,
  { id: "select", kbds: ["space"], desc: "select" },
  { id: "split", kbds: ["s"], desc: "split" },
  { id: "discard", kbds: ["d"], desc: "discard" },
  { id: "focus-right", kbds: ["tab"], desc: "focus" },
  { id: "back", kbds: ["q", "escape"], desc: "back" },
  {
    id: "view",
    kbds: [["ctrl", "left"], ["ctrl", "right"]],
    desc: "view",
  },
];

export const HUNKS_RIGHT: Shortcut[] = [
  { id: "scroll-up", kbds: ["pageup"], desc: "scr" },
  { id: "scroll-down", kbds: ["pagedown"], desc: "scr" },
  {
    id: "scroll-up-big",
    kbds: [["shift", "pageup"]],
    desc: "scr",
    hint: false,
  },
  {
    id: "scroll-down-big",
    kbds: [["shift", "pagedown"]],
    desc: "scr",
    hint: false,
  },
  { id: "focus-left", kbds: ["tab"], desc: "focus" },
  { id: "back", kbds: ["q", "escape"], desc: "back" },
];

export const DESCRIBE_OVERLAY: Shortcut[] = [
  {
    id: "describe",
    kbds: [["ctrl", "enter"], ["cmd", "enter"]],
    desc: "describe",
  },
  { id: "cancel", kbds: ["escape"], desc: "cancel" },
];

export const GLOBAL: Shortcut[] = [
  { id: "view-left", kbds: [["ctrl", "left"]], desc: "view" },
  { id: "view-right", kbds: [["ctrl", "right"]], desc: "view" },
];

export const VIEW_SHORTCUTS: Record<View["kind"], Shortcut[]> = {
  changes: CHANGES_LEFT,
  bookmarks: BOOKMARKS_LEFT,
  oplog: OPLOG,
  evolog: EVOLONG,
  hunks: HUNKS,
  workspaces: WS_LEFT,
};
