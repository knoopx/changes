import { Kbd, T, useAdwaita } from "adwaita-gpuix";

export function KeyHint({ hint }: { hint: string }) {
  const t = useAdwaita();
  const sp = hint.indexOf(" ");
  const key = sp === -1 ? hint : hint.slice(0, sp);
  const label = sp === -1 ? "" : hint.slice(sp + 1);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <Kbd>{key}</Kbd>
      {label ? (
        <T size="caption" color={t.colors.dim_fg}>
          {label}
        </T>
      ) : null}
    </div>
  );
}
