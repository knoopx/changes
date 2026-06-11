export function failMessage(e: unknown): string {
  return `Failed: ${e instanceof Error ? e.message : String(e)}`;
}
