import { useEffect, type RefObject } from "react";
import { keyHandler, type WindowKeyEvent } from "../keybus";

export function useKeyHandler(
  keyRef: RefObject<(e: WindowKeyEvent) => void>,
): void {
  useEffect(() => {
    keyHandler.current = (e) => keyRef.current(e);
    return () => {
      keyHandler.current = null;
    };
  }, []);
}
