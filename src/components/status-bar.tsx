import { KbdGroup, useAdwaita } from "adwaita-gpuix";
import { type Shortcut } from "../shortcuts";
import { groupHints } from "./kbd";
import { ShortcutHint } from "./key-hint";

export function StatusBar({ hints }: { hints?: Shortcut[] }) {
  const t = useAdwaita();
  const { colors } = t;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        height: 32,
        paddingLeft: 12,
        paddingRight: 12,
        backgroundColor: colors.headerbar_bg,
        borderTopWidth: 1,
        borderColor: colors.border,
        minWidth: 0,
      }}
    >
      {hints && hints.length > 0 ? (
        <div
          style={{
            flexGrow: 1,
            justifyContent: "flex-end",
            display: "flex",
            minWidth: 0,
          }}
        >
          <KbdGroup style={{ overflow: "hidden" }}>
            {groupHints(hints).map((g) => (
              <ShortcutHint key={g.desc} group={g} />
            ))}
          </KbdGroup>
        </div>
      ) : null}
    </div>
  );
}
