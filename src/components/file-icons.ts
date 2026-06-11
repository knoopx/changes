import {
  FILE_ICONS,
  FILENAME_ICONS,
  FILE_STATUS_ICONS,
} from "./file-icon-glyphs";
import { FILE_ICON_COLORS, FILENAME_COLORS } from "./file-icon-colors";
import { ACCENTS, shade } from "adwaita-gpuix";

const DEFAULT_ICON = "󰈙";
const DIR_ICON = "󰉋";

const DIR_COLOR = shade(ACCENTS.slate, 0.4);

function getFilename(filePath: string): string {
  const parts = filePath.split("/");
  return parts[parts.length - 1] || "";
}

function isDirectoryEntry(filePath: string): boolean {
  return filePath.endsWith("/");
}

function findFileIcon(filename: string): string | null {
  const dotIndex = filename.lastIndexOf(".");
  if (dotIndex > 0) {
    const ext = filename.slice(dotIndex).toLowerCase();
    return FILE_ICONS[ext] ?? null;
  }
  return null;
}

export function getFileIcon(filePath: string): string {
  if (isDirectoryEntry(filePath)) return DIR_ICON;
  const filename = getFilename(filePath);
  if (FILENAME_ICONS[filename]) return FILENAME_ICONS[filename];
  const icon = findFileIcon(filename);
  if (icon) return icon;
  return DEFAULT_ICON;
}

export function getFileStatusIcon(status: string): string {
  return FILE_STATUS_ICONS[status] || status;
}

function findFileIconColor(filename: string): string | null {
  const dotIndex = filename.lastIndexOf(".");
  if (dotIndex > 0) {
    const ext = filename.slice(dotIndex).toLowerCase();
    return FILE_ICON_COLORS[ext] ?? null;
  }
  return null;
}

export function getFileIconColor(filePath: string): string | null {
  if (isDirectoryEntry(filePath)) return DIR_COLOR;
  const filename = getFilename(filePath);
  if (FILENAME_COLORS[filename]) return FILENAME_COLORS[filename];
  const color = findFileIconColor(filename);
  if (color) return color;
  return null;
}
