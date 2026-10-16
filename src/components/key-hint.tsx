import { T, useAdwaita } from "adwaita-gpuix";
import { type HintGroup, KbdBindings } from "./kbd";

export function ShortcutHint({ group }: { group: HintGroup }) {
  const t = useAdwaita();
  const label =
    group.desc.charAt(0).toUpperCase() + group.desc.slice(1);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <KbdBindings kbds={group.kbds} />
      <T size="caption" color={t.colors.dim_fg}>
        {label}
      </T>
    </div>
  );
}
