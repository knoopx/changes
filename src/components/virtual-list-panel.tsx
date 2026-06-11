import type { ReactNode } from "react";
import type { PublicInstance } from "@gpuix/react";

export function ListPanel({
  listRef,
  estimatedItemHeight = 24,
  children,
}: {
  listRef: { current: PublicInstance | null };
  estimatedItemHeight?: number;
  children: ReactNode;
}) {
  return (
    <virtual-list
      ref={listRef}

      style={{
        display: "flex",
        flexDirection: "column",
        flexGrow: 1,
        minHeight: 0,
        width: "100%",
      }}
      estimatedItemHeight={estimatedItemHeight}
    >
      {children}
    </virtual-list>
  );
}
