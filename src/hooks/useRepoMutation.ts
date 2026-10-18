import { useToast } from "adwaita-gpuix";
import { failMessage } from "../errors";

export function useRepoMutation(opts: {
  setLoading: (loading: boolean) => void;
  refresh: () => Promise<void>;
}) {
  const toast = useToast();
  return async (fn: () => Promise<string | null | undefined>) => {
    opts.setLoading(true);
    try {
      const msg = await fn();
      if (msg) toast(msg, { type: "success" });
      await opts.refresh();
    } catch (e) {
      toast(failMessage(e), { type: "error" });
    } finally {
      opts.setLoading(false);
    }
  };
}
