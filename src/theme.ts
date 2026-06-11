import {
  buildTheme,
  hexToRgba,
  isDarkScheme,
  type AdwaitaTheme,
} from "adwaita-gpuix";
import type { GpuixTheme } from "@gpuix/react";

export const adwaitaTheme: AdwaitaTheme = buildTheme("nightsky");

export const MONO = adwaitaTheme.typography.fontFamilyMono;

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

export function nativeDiffTheme(t: AdwaitaTheme): GpuixTheme {
  return {
    appearance: isDarkScheme(t.scheme) ? "dark" : "light",
    bg: t.colors.view_bg,
    border: t.colors.border,
    text: t.colors.fg,
    textMuted: t.colors.dim_fg,
    textDim: t.colors.dim_fg,
    textFaint: t.colors.dim_fg,
    accent: t.colors.accent,
    diffAdd: t.colors.successTint,
    diffDel: t.colors.destructiveTint,
    diffHunkBg: t.colors.headerbar_bg,
    fontSans: t.typography.fontFamily,
    fontMono: t.typography.fontFamilyMono,
  };
}
