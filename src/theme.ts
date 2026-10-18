import {
  buildTheme,
  hexToRgba,
  type AdwaitaTheme,
} from "adwaita-gpuix";

export { MONO, nativeDiffTheme } from "adwaita-gpuix/vcs";

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

export function selectionBg(t: AdwaitaTheme): string {
  return t.colors.accentTint;
}

export function rowHoverBg(t: AdwaitaTheme): string {
  return hexToRgba(t.colors.fg, 0.04);
}

export function scrimBg(t: AdwaitaTheme): string {
  return "rgba(0,0,0,0.45)";
}
