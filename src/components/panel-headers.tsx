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

export function FileListTitle({
  description,
  focused,
}: {
  description: string | null | undefined;
  focused: boolean;
}) {
  const { colors } = useAdwaita();
  if (!description) return "Files";
  const noDesc = description === "" || description === "(no description)";
  if (noDesc)
    return (
      <T
        size="title4"
        color={colors.dim_fg}
        style={{ whiteSpace: "nowrap" }}
      >
        (no description)
      </T>
    );
  return (
    <T
      size="title4"
      weight={600}
      color={focused ? colors.accent : colors.fg}
      style={{ whiteSpace: "nowrap" }}
    >
      {description}
    </T>
  );
}
