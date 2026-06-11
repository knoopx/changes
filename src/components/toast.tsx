import { createContext, useContext, type ReactNode } from "react";
import { Toaster, useToasts, type ToastOptions } from "adwaita-gpuix";

export type ToastFn = (message: string, opts?: ToastOptions) => string;

const ToastContext = createContext<ToastFn | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const { toasts, toast, dismiss } = useToasts();
  return (
    <ToastContext.Provider value={toast}>
      <div style={{ position: "relative", width: "100%", height: "100%" }}>
        {children}
        <Toaster toasts={toasts} onDismiss={dismiss} position="bottom-left" />
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastFn {
  const fn = useContext(ToastContext);
  if (!fn) throw new Error("useToast must be used within a ToastProvider");
  return fn;
}
