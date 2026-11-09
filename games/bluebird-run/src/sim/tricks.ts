import { TRICK } from './constants';

export interface Trick {
  /** Half-turns (180° each) landed. */
  readonly halves: number;
  readonly grabbed: boolean;
  readonly points: number;
  readonly name: string;
}

/** Clean when the spin ends within ±35° of any multiple of 180° (switch landings are fine). */
export function isCleanLanding(spin: number): boolean {
  return Math.abs(spin - 180 * Math.round(spin / 180)) <= TRICK.window;
}

export function trickName(halves: number, grabbed: boolean): string {
  return [halves > 0 ? String(halves * 180) : '', grabbed ? 'Grab' : ''].filter(Boolean).join(' ');
}

/** The trick a clean landing scores, or null if there was nothing to score. */
export function trickOf(spin: number, grabTime: number): Trick | null {
  const halves = Math.abs(Math.round(spin / 180));
  const grabbed = grabTime >= TRICK.grabMin;
  if (halves === 0 && !grabbed) return null;
  const base = halves * TRICK.per180 + (grabbed ? TRICK.grab : 0);
  const styled = grabbed && halves * 180 >= TRICK.styleMin;
  return { halves, grabbed, points: Math.round(base * (styled ? TRICK.style : 1)), name: trickName(halves, grabbed) };
}
