# Changes

A native, GPU-rendered desktop app for [Jujutsu](https://github.com/martinvonz/jj)
(`jj`) — no Electron, no webview: the UI is rendered directly by a GPU
renderer.

## What it does

Browse and manipulate a jj repository from a single window:

- **Changes** — the main view. A change list with a commit-graph gutter
  (branching history drawn per row), bookmark pills, and conflict markers,
  beside the change's file list and a diff preview. Text diffs get
  word-level highlighting, tabular files (csv/tsv) render as a table, and
  image files get a before/after comparison. Create, edit, split, squash,
  revert, and abandon changes; reorder them in move mode; multi-select and
  describe in one go; set or create bookmarks from a typeahead overlay; copy
  the change id; push a change's bookmarks; open a file in your editor.
  User-defined shell-command shortcuts (e.g. launch a terminal for the
  focused change) are configured in `commands` (see
  [Commands](#commands)).
  Absorb a change into its mutable ancestors (`a`); open the change's
  evolog (`v`) to see how it evolved across operations, with a per-version
  diff (`q` back). The revision filter is cycled in place, or edited in
  place (`/`) — an editable revset with autocompletion (functions,
  keywords, bookmarks, change ids, file globs) and signature help; Enter
  applies a custom filter, Esc cancels. On a file, interactive restore (`i`)
  restores a working-copy file per hunk: space marks hunks, Ctrl+Enter
  applies. The filter set and the starting filter are user-configurable
  (see [Configuration](#configuration)).

  ![Changes view — commit-graph gutter, file list, and native diff preview](assets/screenshot-changes.png)
  *Changes view: commit-graph gutter + file list + table diff preview.*

- **Bookmarks** — bookmark groups (local + remote references) with a file
  list and diff preview for each group's change; fetch, push, or forget
  bookmarks, and start a new change from a group.

  ![Bookmarks view — bookmark groups, file list, and new-file diff](assets/screenshot-bookmarks.png)
  *Bookmarks view: bookmark groups + file list + unified-diff preview.*

- **Op log** — the last 100 operations, each previewing the changes it
  introduced as a diff; restore to any operation, undo the latest one,
  or redo the last undone operation (Shift+U).

  ![Op-log view — operation history with diff preview](assets/screenshot-oplog.png)
  *Op-log view: operation history + diff of the operation's changes.*

- **Hunks** — a detail view of a file's hunks: select hunks, then split them
  into a new change or discard them (requires `jj-hunk`).

  ![Hunks view — component library image diff](assets/screenshot-image-diff.png)
  *Hunks view: image-file diff across a component-library change.*

- **Workspaces** — a browser for jj workspaces with per-workspace file list
  and diff; create a workspace, attach to its session, rebase + describe,
  open it in an editor or terminal, discard files, and delete it.

Lists refresh automatically when the repository changes on disk, and
transient results surface as toasts. The header bar carries the view
switcher, the current branch label, and the working directory; the status bar
shows the active view's key hints.

## Requirements

- [Bun](https://bun.sh)
- `jj` on your `PATH`
- `jj-hunk` on your `PATH` (optional — only needed for the Hunks view)
- `tmux` (or `wezterm`) on your `PATH` (only needed for the Workspaces
  attach / terminal actions)

## Run

```sh
bun install
bun --hot src/main.tsx [path]
```

or the standalone binary:

```sh
dist/changes [path]
```

An optional `[path]` opens the app at that directory's jj workspace root
(the nearest ancestor directory containing a `.jj`); when omitted it uses
the current working directory.

## Configuration

The revision filters shown in the Changes view (and which one starts
active), and user-defined command shortcuts, are configurable via
`~/.config/changes/config.json` (override the location with
`$GPUIX_CHANGES_CONFIG`). The file is optional; missing, empty, or invalid
entries fall back to the built-in defaults.
Copy `examples/config.json` to get started.

```jsonc
{
  // Replace the built-in filter list. Each entry is a label + jj revset.
  "filters": [
    { "label": "Stack", "revset": "ancestors(@) ~ root()" },
    { "label": "All", "revset": "::" },
    { "label": "Mine", "revset": "mine()" },
    { "label": "Tracked", "revset": "bookmarks()" },
    { "label": "Recent", "revset": "committer_date(after:'30 days ago')" }
  ],
  // Label of the filter active when the view opens (default: "Stack").
  "defaultFilter": "Stack",
  // User-defined shell-command shortcuts (see "Commands" below).
  "commands": [
    {
      "id": "describe",
      "keys": [["ctrl", "shift", "d"]],
      "cmd": "kitty",
      "args": ["@", "launch", "--type=os-window", "--cwd", "{root}", "pi", "Describe jujutsu changes {changes} ... (full prompts in examples/config.json)"]
    }
  ]
}
```

Only the keys you provide are applied: omit `filters` to keep the built-in
list, omit `defaultFilter` to start on Stack, omit `commands` to have no
commands. Any revset jj accepts works
(`@`, `bookmark(main)`, `description(my ~)`, ...). Edits to the config file
are hot-reloaded at runtime — no restart needed.

### Commands

`commands` is an optional array of user-defined shell-command shortcuts.
There are no built-in commands: a command that is not configured is
unavailable. Each entry:

| Field  | Description                                                        |
| ------ | ------------------------------------------------------------------ |
| `id`   | Command id; shown in the status bar hints                           |
| `keys` | Key binding (single key, or a chord like `["ctrl", "shift", "d"]`)  |
| `cmd`  | Executable to run (e.g. `kitty`, `wezterm`, `tmux`)                |
| `args` | Arguments, supporting the substitutions below                       |

Substitutions in `args`:

- `{root}` — the repository root.
- `{change}` — the focused change id.
- `{changes}` — every selected change id, space-joined (the focused change
  when nothing is multi-selected with `Space`).

Commands launch detached (non-blocking) — a terminal window opens without
pausing the app. A configured command takes precedence over the built-in
keybindings; while a modal overlay is open, the overlay's keys win.

Typical use: describe, split, or inspect the selected change(s) with `pi`
in a new kitty window (kitty remote control), passing a predefined prompt as
pi's task. `examples/config.json` ships three such commands — `describe`
(Ctrl+Shift+D), `split` (Ctrl+Shift+S), and `inspect` (Ctrl+Shift+I) — whose
prompts are the jujutsu describe/split/inspect operation templates (Conventional
Commits formatting, sem-guided grouping, per-change sequential workflow):

```jsonc
{
  "id": "describe",
  "keys": [["ctrl", "shift", "d"]],
  "cmd": "kitty",
  "args": [
    "@", "launch", "--type=os-window", "--cwd", "{root}",
    "pi",
    "Describe jujutsu changes {changes} using Conventional Commits format. ..."
  ]
}
```

`{changes}` carries the focused change, or every change selected with
`Space` — the prompts are written for one or many change IDs.
See [`examples/config.json`](examples/config.json) for the full prompts.
