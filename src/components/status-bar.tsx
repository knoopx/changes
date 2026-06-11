import { KbdGroup, useAdwaita } from "adwaita-gpuix";
import { KeyHint } from "./key-hint";

export function StatusBar({ hints }: { hints?: string[] }) {
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
            {hints.map((h) => (
              <KeyHint key={h} hint={h} />
            ))}
          </KbdGroup>
        </div>
      ) : null}
    </div>
  );
}
