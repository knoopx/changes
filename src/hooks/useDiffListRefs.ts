import { useRef } from "react";
import type { NativeRenderer } from "@gpuix/native/host";
import { useGpuixRequired, type PublicInstance } from "@gpuix/react";
import { makeDiffScroller } from "adwaita-gpuix";
import { useListFollow } from "./useListFollow";

type ListRefs = {
  listRef: { current: PublicInstance | null };
  renderer: NativeRenderer;
  ensureVisible: (index: number) => void;
};
type DiffRefs = ListRefs & {
  diffRef: { current: PublicInstance | null };
  scrollDiff: (down: boolean) => void;
};

export function useDiffListRefs(): ListRefs;
export function useDiffListRefs(withDiff: true): DiffRefs;
export function useDiffListRefs(_withDiff?: boolean): DiffRefs {
  const listRef = useRef<PublicInstance | null>(null);
  const diffRef = useRef<PublicInstance | null>(null);
  const renderer = useGpuixRequired();
  const { ensureVisible } = useListFollow(listRef, renderer, 24);
  const scrollDiff = makeDiffScroller(diffRef, renderer);
  return { listRef, renderer, ensureVisible, diffRef, scrollDiff };
}
