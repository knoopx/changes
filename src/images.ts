import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { findWorkspaceRoot, getOpHead } from "./repo";

const pExecFile = promisify(execFile);

const IMAGE_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  tiff: "image/tiff",
  tif: "image/tiff",
};

export function isImagePath(path: string): boolean {
  const dot = path.lastIndexOf(".");
  if (dot < 0) return false;
  return IMAGE_MIME[path.slice(dot + 1).toLowerCase()] !== undefined;
}

export function imageMime(path: string): string {
  const dot = path.lastIndexOf(".");
  if (dot < 0) return "application/octet-stream";
  return (
    IMAGE_MIME[path.slice(dot + 1).toLowerCase()] ?? "application/octet-stream"
  );
}

export interface ImageSides {
  old?: string;

  next?: string;

  oldSize?: ImageSize;

  nextSize?: ImageSize;
}

export interface ImageSize {
  width: number;
  height: number;
}

export function readImageDimensions(bytes: Buffer): ImageSize | null {
  const has = (n: number) => bytes.length >= n;

  if (
    has(24) &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }

  if (has(10) && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return { width: bytes.readUInt16LE(6), height: bytes.readUInt16LE(8) };
  }

  if (has(26) && bytes[0] === 0x42 && bytes[1] === 0x4d) {
    return {
      width: bytes.readUInt32LE(18),
      height: Math.abs(bytes.readInt32LE(22)),
    };
  }

  if (
    has(12) &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return null;
  }

  if (has(4) && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let i = 2;
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = bytes[i + 1];
      if (
        marker >= 0xc0 &&
        marker <= 0xcf &&
        marker !== 0xc4 &&
        marker !== 0xc8 &&
        marker !== 0xcc
      ) {
        return {
          height: bytes.readUInt16BE(i + 5),
          width: bytes.readUInt16BE(i + 7),
        };
      }

      if (
        marker === 0xd8 ||
        marker === 0x01 ||
        (marker >= 0xd0 && marker <= 0xd9)
      ) {
        i += 2;
        continue;
      }
      i += 2 + bytes.readUInt16BE(i + 2);
    }
  }
  return null;
}

const imageSidesCache = new Map<string, ImageSides>();

async function showFileBytes(
  revset: string,
  path: string,
): Promise<Buffer | null> {
  try {
    const { stdout } = await pExecFile(
      "jj",
      ["file", "show", "-r", revset, path],
      {
        cwd: findWorkspaceRoot(),
        encoding: "buffer",
        maxBuffer: 128 * 1024 * 1024,
      },
    );
    return stdout as Buffer;
  } catch {
    return null;
  }
}

function toDataUrl(bytes: Buffer, path: string): string {
  return `data:${imageMime(path)};base64,${bytes.toString("base64")}`;
}

export async function getImageSides(
  changeId: string,
  path: string,
): Promise<ImageSides> {
  const opHead = await getOpHead();
  const key = `${changeId}:${opHead}:${path}`;
  const cached = imageSidesCache.get(key);
  if (cached) return cached;

  const sides: ImageSides = {};
  const [old, next] = await Promise.all([
    showFileBytes(`parents(${changeId})`, path),
    showFileBytes(changeId, path),
  ]);
  if (old) {
    sides.old = toDataUrl(old, path);
    const s = readImageDimensions(old);
    if (s) sides.oldSize = s;
  }
  if (next) {
    sides.next = toDataUrl(next, path);
    const s = readImageDimensions(next);
    if (s) sides.nextSize = s;
  }
  imageSidesCache.set(key, sides);
  return sides;
}
