import type { NativeRenderer } from "@gpuix/native/host";
import type { PublicInstance } from "@gpuix/react";

export function makeDiffScroller(
  diffRef: { current: PublicInstance | null },
  renderer: NativeRenderer,
): (down: boolean) => void {
  return (down: boolean): void => {
    const id = diffRef.current?.id;
    if (id === undefined) return;

    const off = renderer.getScrollOffset?.(id);
    const y = off ? (off[1] ?? 0) : 0;
    renderer.scrollTo?.(id, 0, down ? y - 200 : y + 200);
  };
}
