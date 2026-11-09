/** The dev-only test hook main.ts puts on window.__minigolf. */
export interface MinigolfHook {
  getState(): { phase: { kind: string; power?: number }; strokes: number[]; ball: { x: number; y: number } };
  /** The course being shown: 'backyard' or 'boardwalk'. */
  getCourse(): string;
  putt(angle: number, power: number): void;
}
declare global {
  interface Window { __minigolf: MinigolfHook }
}
