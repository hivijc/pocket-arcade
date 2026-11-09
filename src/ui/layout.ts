/**
 * How much to scale the bufW×bufH canvas to fit a vw×vh viewport.
 * Whole-pixel steps keep the pixel art crisp; on touch screens below 2× that would waste up to half the screen,
 * so there we fill the limiting side with a fractional scale (the canvas uses image-rendering: pixelated).
 */
export function canvasScale(vw: number, vh: number, bufW: number, bufH: number, touch: boolean): number {
  const fit = Math.min(vw / bufW, vh / bufH);
  if (touch && fit < 2) return fit;
  return Math.max(1, Math.floor(fit));
}
