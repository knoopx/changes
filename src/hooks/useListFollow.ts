import { useCallback } from "react";
import type { NativeRenderer } from "@gpuix/native/host";
import type { PublicInstance } from "@gpuix/react";

export function useListFollow(
  listRef: { current: PublicInstance | null },
  renderer: NativeRenderer,
  rowHeight: number,
) {
  const ensureVisible = useCallback(
    (index: number) => {
      const id = listRef.current?.id;
      if (id === undefined) return;
      const anchor = renderer.getListScrollTop?.(id);
      if (!anchor) return;
      const [item, off, vh] = anchor;
      const H = vh ?? 0;
      const T = item * rowHeight + (off ?? 0);
      const rowTop = index * rowHeight;
      const rowBottom = (index + 1) * rowHeight;
      if (rowTop >= T && rowBottom <= T + H) return;

      const targetY = rowBottom > T + H ? rowBottom - H : rowTop;
      const ti = Math.max(0, Math.floor(targetY / rowHeight));
      const toff = Math.max(0, targetY - ti * rowHeight);
      renderer.scrollToItem?.(id, ti, toff);
    },
    [renderer, listRef, rowHeight],
  );

  return { ensureVisible };
}
