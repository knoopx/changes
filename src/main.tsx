import { render } from "@gpuix/react";
import { AdwaitaContext, ToastProvider } from "adwaita-gpuix";
import { globalKeyHandler, keyHandler } from "./keybus";
import { App } from "./app";
import { adwaitaTheme } from "./theme";
import { startConfigWatcher } from "./config";

startConfigWatcher();

render(
  <AdwaitaContext.Provider value={adwaitaTheme}>
    <ToastProvider>
      <App />
    </ToastProvider>
  </AdwaitaContext.Provider>,
  {
    title: "Changes",
    width: 1280,
    height: 800,
    focus: process.env.GPUIX_BACKGROUND !== "1",
    onKeyDown: (e) => {
      const ev = {
        key: e.key ?? "",
        keyChar: e.keyChar,
        isHeld: e.isHeld,
        modifiers: e.modifiers,
      };
      if (globalKeyHandler.current?.(ev)) return;
      keyHandler.current?.(ev);
    },
  },
);
