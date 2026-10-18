import { buildTheme, type AdwaitaTheme } from "adwaita-gpuix";

export { MONO, nativeDiffTheme } from "adwaita-gpuix";

export const adwaitaTheme: AdwaitaTheme = buildTheme("nightsky");

export function fileStatusColor(t: AdwaitaTheme, status: string): string {
  switch (status) {
    case "A":
      return t.colors.success;
    case "D":
      return t.colors.destructive;
    default:
      return t.colors.warning;
  }
}

export function scrimBg(t: AdwaitaTheme): string {
  return "rgba(0,0,0,0.45)";
}
