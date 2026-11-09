/** The dev-only test hook main.ts puts on window.__minigolf. */
export interface MinigolfHook {
  getState(): { phase: { kind: string; power?: number }; strokes: number[]; ball: { x: number; y: number } };
  putt(angle: number, power: number): void;
}
declare global {
  interface Window { __minigolf: MinigolfHook }
}
