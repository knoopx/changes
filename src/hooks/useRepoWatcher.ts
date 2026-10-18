import { useEffect, useRef } from "react";
import { findWorkspaceRoot } from "../repo";
import { createRepoWatcher } from "../watch";

export function useRepoRefresh(
  refresh: (opts?: { keepId?: string }) => Promise<void>,
  currentKeepId: () => string | null,
): void {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const keepIdRef = useRef(currentKeepId);
  keepIdRef.current = currentKeepId;

  useEffect(() => {
    void refreshRef.current();
    const watcher = createRepoWatcher(findWorkspaceRoot(), () => {
      const id = keepIdRef.current();
      void refreshRef.current(id === null ? undefined : { keepId: id });
    });
    return () => watcher.stop();
  }, []);
}
