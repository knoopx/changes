import { Kbd as KbdBox, KbdGroup } from "adwaita-gpuix";
import { type Kbd, type Shortcut } from "../shortcuts";

const CODE_SYMBOLS: Record<string, string> = {
  up: "↑",
  down: "↓",
  left: "←",
  right: "→",
  pageup: "PgUp",
  pagedown: "PgDn",
  home: "Home",
  end: "End",
  tab: "Tab",
  space: "Space",
  delete: "Del",
  escape: "Esc",
  enter: "Enter",
  insert: "Ins",
  ctrl: "Ctrl",
  shift: "Shift",
  alt: "Alt",
  cmd: "Cmd",
};

export function kbdSymbol(code: string): string {
  return CODE_SYMBOLS[code] ?? code;
}

export function KbdKey({ code }: { code: string }) {
  return <KbdBox>{kbdSymbol(code)}</KbdBox>;
}

export function KbdBinding({ binding }: { binding: Kbd }) {
  const codes = Array.isArray(binding) ? binding : [binding];
  if (codes.length === 1) return <KbdKey code={codes[0]} />;
  return (
    <KbdGroup>
      {codes.map((c) => (
        <KbdKey key={c} code={c} />
      ))}
    </KbdGroup>
  );
}

export function KbdBindings({ kbds }: { kbds: Kbd[] }) {
  return (
    <KbdGroup>
      {kbds.map((b) => (
        <KbdBinding key={Array.isArray(b) ? b.join("-") : b} binding={b} />
      ))}
    </KbdGroup>
  );
}

export interface HintGroup {
  desc: string;
  kbds: Kbd[];
}

export function groupHints(shortcuts: Shortcut[]): HintGroup[] {
  const groups: HintGroup[] = [];
  for (const s of shortcuts) {
    const last = groups[groups.length - 1];
    if (last && last.desc === s.desc) last.kbds.push(...s.kbds);
    else groups.push({ desc: s.desc, kbds: [...s.kbds] });
  }
  return groups;
}
