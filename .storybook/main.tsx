import type { ReactNode } from "react";
import { AdwaitaContext, ToastProvider } from "adwaita-gpuix";
import type { DecoratorFunction } from "storybook";
import { adwaitaTheme } from "../src/theme";

function Themed({ children }: { children: ReactNode }) {
  return (
    <AdwaitaContext.Provider value={adwaitaTheme}>
      <ToastProvider>{children}</ToastProvider>
    </AdwaitaContext.Provider>
  );
}

export const decorators: DecoratorFunction[] = [
  (storyFn) => <Themed>{storyFn()}</Themed>,
];
