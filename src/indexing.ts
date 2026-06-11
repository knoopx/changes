export function wrapIndex(sel: number, dir: number, len: number): number {
  return (((sel + dir) % len) + len) % len;
}

export function clampIndex(sel: number, delta: number, len: number): number {
  return Math.max(0, Math.min(sel + delta, len - 1));
}
