export interface WindowKeyEvent {
  key: string;
  keyChar?: string;
  isHeld?: boolean;
  modifiers?: { cmd?: boolean; ctrl?: boolean; shift?: boolean; alt?: boolean };
}

export type KeyHandler = (event: WindowKeyEvent) => boolean | void;

export const keyHandler: { current: KeyHandler | null } = { current: null };

export const globalKeyHandler: { current: KeyHandler | null } = {
  current: null,
};

export function keyOf(event: WindowKeyEvent): string {
  const k = (event.key ?? "").toLowerCase();
  return k === " " ? "space" : k;
}
