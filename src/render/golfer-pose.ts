import type { Vec2 } from '../core/geometry';
import { aimAngle, chargePower, type GameState } from '../game/state';
import { DIRS, type AnimLayout, type Dir, type GolferAnim, type GolferLayout } from '../world/golfer';

/** How long the follow-through shows after release, seconds. */
export const STROKE_SECONDS = 0.35;
/** How far behind the ball the golfer stands, tiles. */
export const STANCE = 0.3;

export interface GolferPose {
  readonly anim: GolferAnim;
  readonly frame: number;
  readonly facing: Dir;
  /** Grid point under the golfer's feet. */
  readonly at: Vec2;
}

/** The 8-way screen direction a grid-space angle points (south = straight down the screen). */
export function screenDir(gridAngle: number): Dir {
  const c = Math.cos(gridAngle), s = Math.sin(gridAngle);
  const screenAngle = Math.atan2((c + s) / 2, c - s); // y grows downward
  const k = Math.round((screenAngle - Math.PI / 2) / (Math.PI / 4));
  return DIRS[((k % 8) + 8) % 8];
}

const behind = (p: Vec2, angle: number): Vec2 => [p[0] - Math.cos(angle) * STANCE, p[1] - Math.sin(angle) * STANCE];
const loop = (t: number, a: AnimLayout): number => Math.floor(t * a.fps) % a.frames;

export function golferPose(s: GameState, anims: GolferLayout['anims'], time: number): GolferPose | null {
  const p = s.phase;
  if (p.kind === 'aiming' || p.kind === 'charging') {
    const aim = aimAngle(s);
    const at = behind([s.ball.x, s.ball.y], aim);
    const facing = screenDir(aim);
    if (p.kind === 'aiming') return { anim: 'idle', frame: loop(time, anims.idle), facing, at };
    return { anim: 'backswing', frame: Math.round(chargePower(p.t) * (anims.backswing.frames - 1)), facing, at };
  }
  const at = behind(s.lastRest, s.aim);
  const facing = screenDir(s.aim);
  if (p.kind === 'rolling' && p.t < STROKE_SECONDS) {
    const n = anims.stroke.frames;
    return { anim: 'stroke', frame: Math.min(n - 1, Math.floor((p.t / STROKE_SECONDS) * n)), facing, at };
  }
  if (p.kind === 'holed') return { anim: 'celebrate', frame: loop(p.t, anims.celebrate), facing, at };
  return null;
}
