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

/** Share of a portrait phone's height the game fills; the sides of the buffer are cropped to get there. */
const PORTRAIT_FILL = 0.58;
/** However tall the phone, at least this many buffer pixels stay visible across (rider at x 128 plus the slope ahead). */
const PORTRAIT_MIN_VISIBLE = 200;

/**
 * Scale for a touch phone held upright: a width fit leaves the game a thin strip, so fill PORTRAIT_FILL of the height
 * and let the canvas overflow (and crop) both sides, keeping at least PORTRAIT_MIN_VISIBLE buffer pixels in view.
 */
export function portraitScale(vw: number, vh: number, bufW: number, bufH: number): number {
  const fill = (PORTRAIT_FILL * vh) / bufH;
  return Math.max(vw / bufW, Math.min(fill, vw / PORTRAIT_MIN_VISIBLE));
}
