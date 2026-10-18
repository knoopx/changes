import { useEffect, type RefObject } from "react";
import { keyHandler, type WindowKeyEvent } from "../keybus";

export function useKeyHandler(
  keyRef: RefObject<(e: WindowKeyEvent) => void>,
): void {
  useEffect(() => {
    const prev = keyHandler.current;
    keyHandler.current = (e) => keyRef.current(e);
    return () => {
      
      
      keyHandler.current = prev;
    };
  }, []);
}
