# AGENTS.md

Guidance for AI agents working in this repo. Read this before making changes.

## What this is

`changes` — a native, GPU-rendered desktop app for [Jujutsu](https://github.com/martinvonz/jj)
(`jj`): no Electron, no webview. The UI is rendered directly by
[GPUix](https://github.com/gpuix) (`@gpuix/react` + `@gpuix/native`, a
GPU-rendered React runtime — no DOM, no browser), styled with the local
`adwaita-gpuix` component library (`file:../adwaita-gpuix`). Screens:
Changes, Bookmarks, Workspaces, Op Log, Evolog, Hunks. User-defined
shell-command shortcuts (`commands`) and the revision filters are configurable
via `~/.config/changes/config.json` (override with `$GPUIX_CHANGES_CONFIG`).

## Commands

```sh
bun install              # install deps
bun run typecheck        # tsc --noEmit  (CPU-only gate)
bun run build            # compile standalone binary → dist/changes
bun dev                  # bun --hot src/main.tsx  (HUMAN dev only — see rule below)
```

There is no unit-test runner. `typecheck` is the only static gate; UI is
verified by the storybook harness (below).

## Visual verification — storybook harness, NEVER launch the app

**Do NOT launch the app to verify anything.** No `dist/changes`, no
`bun dev` / `bun --hot src/main.tsx`, no "background the app then screenshot
a live window." Launching the real app is forbidden for agent work: it leaves
orphan processes and gives a false sense of verification.

- **Verify UI by rendering stories through the shared storybook harness**
  (the `storybook` workspace package at `../storybook`):
  `bun run storybook` renders every `*.stories.tsx` under `src/` through the
  REAL GPUix renderer (`@gpuix/native` GpuixRenderer + `@gpuix/react`) in a
  real niri window and captures each with niri's per-window compositor
  screenshot (`niri msg action screenshot-window`), one process per story.
  PNGs land next to the story source file in a `<Title>/` subfolder
  (e.g. `src/screens/Changes/Default.png` beside `src/screens/changes.tsx`).
  `bun run storybook -- --only <filter>` renders a subset.
- **Stories live in `*.stories.tsx` next to the component/screen** they
  show: `src/app.stories.tsx` (the `App` shell) and one per screen under
  `src/screens/`. They use `defineMeta`/`defineStory` from `storybook` and
  render the real screen components against the live jj repo (screens shell
  out to `jj` in `findWorkspaceRoot()`), so shots show real data. Screens
  that need a `changeId` (Evolog, Hunks) resolve the current `@` id at
  module load. Set `parameters: { width, height, settleMs }` on the meta to
  control window size and how long the renderer settles (async jj loads need
  settle time).
- **`.storybook/main.tsx` holds the preview decorators** —
  the adwaita theme context (`AdwaitaContext` + the `nightsky` theme from
  `src/theme.ts`) and `ToastProvider`, matching the app's mount in
  `src/main.tsx`. New cross-cutting story chrome goes there, not in
  individual stories.
- **`src/main.tsx` mounts only under `import.meta.main`** so the storybook
  CLI (which imports every `src/*.tsx` to discover stories) doesn't launch
  the app. Keep new entry-point side effects behind that guard.
- **Do NOT write runtime/interaction probes.** The GPUix test renderer cannot
  read back rendered images on Linux. If a behaviour can't be seen in a static
  shot, say so — don't fabricate a probe.
- **A stale `dist/changes` binary is a real failure mode.** The binary is a
  compiled snapshot of `src/`; after changing `src/` you must `bun run build`
  before the binary reflects it. Check a binary's feature surface with
  `strings dist/changes | grep <symbol>` when in doubt — do not launch it.
- **Stale `gpuix-storybook` windows are a real failure mode.** The harness
  screenshots the first niri window titled `gpuix-storybook`; a leftover window
  from a crashed/aborted earlier run can be captured instead of the story
  (you'll see a foreign screen in the PNG). If a shot looks like the wrong
  UI, close the stragglers —
  `niri msg --json windows | jq -r '.[] | select(.title == "gpuix-storybook") | .id'`
  → `niri msg action close-window --id <id>` — and re-run the story.

## GPUix JSX conventions (differ from the web)

`tsconfig.json` targets GPUix's JSX runtime (`"jsx": "react-jsx"`,
`"jsxImportSource": "@gpuix/react"`). Rules that break if you assume a browser:

- **Host elements** are `div`, `text`, `input`, `img`, `svg`, `canvas`,
  `textarea`, `<virtual-list>`. There is **no `<button>`** — a button is a
  `<div onClick>` with `cursor: 'pointer'` (adwaita-gpuix `Button` does this).
- **`div` is block by default.** Set `display: 'flex'` (plus `flexDirection`)
  before using `gap` / `alignItems` / `justifyContent`.
- **Every `<text>` needs an explicit colour** (GPUix doesn't inherit colour).
  Use the adwaita `T` helper or set `color`.
- **`hover` / `active`** are nested one-level style objects; **`boxShadow`**
  is an object; **`padding` / `margin` / `borderWidth` / `borderRadius` are
  numbers** (px).
- **`<virtual-list>`** is the only scroller. Wrap each row in a `<div>`.
- `render` and `motion` come from `@gpuix/react`.

## Design language

- **Use adwaita-gpuix exclusively — no hand-rolling.** Build UI from the
  adwaita-gpuix components and theme tokens; colours come from
  `useAdwaita()` (`src/theme.ts`). Icons: the adwaita `Icon` set.
- Keyboard hints use the `Ctrl+K` form (the `Kbd` / `KbdGroup` components in
  adwaita-gpuix). This is a Linux app — no macOS chrome, no ⌘-key hints.

## Layout

- `src/main.tsx` — mount point (guarded by `import.meta.main` so storybook
  discovery doesn't launch the app): window options, global key-event bus,
  `startConfigWatcher()`.
- `src/app.stories.tsx` + `src/screens/*.stories.tsx` — storybook stories
  (one per screen + the `App` shell); `.storybook/main.tsx` —
  preview decorators (adwaita theme context + toasts).
- `src/app.tsx` — `App`: header bar (view switcher + branch label + cwd), the
  active screen, and the key-hint `StatusBar`.
- `src/screens/` — the screens: `changes`, `bookmarks`, `workspaces`,
  `oplog`, `evolog`, `hunks`.
- `src/components/` — UI components (panels, diff/image-diff, overlays,
  `status-bar`, `kbd`/`key-hint`, toasts, virtual list).
- `src/shortcuts.ts` — keybinding sets + `hints()`/`matchShortcut`;
  `src/commands.ts` — user-defined command shortcuts (`findCommandBinding`,
  `runCommand`); `src/config.ts` — filter + command config loading/watching.
- `src/repo.ts` — the jj layer (shells out to `jj`); `src/watch.ts` — repo +
  config file watchers; `src/graph.ts` — commit-graph gutter layout.

## Definition of done

A UI change is complete when:
1. `bun run typecheck` passes.
2. The relevant story renders cleanly via the storybook harness (`bun run
   storybook -- --only <Title>`; inspect the PNG under
   `src/<dir>/<Title>/<Story>.png` next to the source file).
3. No app was launched; no probe / scratch / generated files are left in the
   working directory (story PNGs are the exception — they are the verified
   artifacts).
4. If `src/` changed and the binary is the deliverable, `bun run build` was
   re-run (the `dist/changes` binary is a snapshot of `src/`).
