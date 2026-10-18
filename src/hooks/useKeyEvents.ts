import { useRef } from "react";
import { type WindowKeyEvent } from "../keybus";
import { useKeyHandler } from "./useKeyHandler";

export function useKeyEvents(handler: (e: WindowKeyEvent) => void): void {
  const keyRef = useRef<(e: WindowKeyEvent) => void>(() => {});
  keyRef.current = handler;
  useKeyHandler(keyRef);
}
