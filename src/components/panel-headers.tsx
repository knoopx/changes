import type { ReactNode } from "react";
import { Spinner, T, useAdwaita } from "adwaita-gpuix";
import { MONO } from "../theme";

export function MonoBadge({ text }: { text: string | null }) {
  const { colors } = useAdwaita();
  if (!text) return null;
  return (
    <T
      size="caption"
      color={colors.dim_fg}
      style={{ fontFamily: MONO, whiteSpace: "nowrap" }}
    >
      {text}
    </T>
  );
}

export function PanelTrailing({
  loading,
  badge,
}: {
  loading: boolean;
  badge: ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {loading && <Spinner size={16} />}
      {badge}
    </div>
  );
}
