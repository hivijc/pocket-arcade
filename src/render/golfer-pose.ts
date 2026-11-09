import type { Vec2 } from '../core/geometry';
import { aimAngle, chargePower, type GameState } from '../game/state';
import type { Hole } from '../world/hole';
import { DIRS, type AnimLayout, type Dir, type GolferAnim, type GolferLayout } from '../world/golfer';

/** How long the follow-through shows after release, seconds; the golfer idles there while the ball rolls on. */
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

const along = (p: Vec2, angle: number, d: number): Vec2 => [p[0] + Math.cos(angle) * d, p[1] + Math.sin(angle) * d];

/** True when a point lies on a play tile: inside the grid and not an 'X'. */
function onCourse(hole: Hole, p: Vec2): boolean {
  const x = Math.floor(p[0]), y = Math.floor(p[1]);
  if (x < 0 || y < 0 || x >= hole.width || y >= hole.depth) return false;
  return hole.surface[y][x] !== 'X';
}

/** Where the golfer stands: behind the ball if that's on the course, else in front, else on the ball itself. */
function stance(hole: Hole, ball: Vec2, angle: number): Vec2 {
  const back = along(ball, angle, -STANCE);
  if (onCourse(hole, back)) return back;
  const front = along(ball, angle, STANCE);
  return onCourse(hole, front) ? front : ball;
}
const loop = (t: number, a: AnimLayout): number => Math.floor(t * a.fps) % a.frames;

export function golferPose(s: GameState, hole: Hole, anims: GolferLayout['anims'], time: number): GolferPose | null {
  const p = s.phase;
  if (p.kind === 'aiming' || p.kind === 'charging' || p.kind === 'dragging') {
    const aim = aimAngle(s);
    const at = stance(hole, [s.ball.x, s.ball.y], aim);
    const facing = screenDir(aim);
    if (p.kind === 'aiming') return { anim: 'idle', frame: loop(time, anims.idle), facing, at };
    const power = p.kind === 'charging' ? chargePower(p.t) : p.power;
    return { anim: 'backswing', frame: Math.round(power * (anims.backswing.frames - 1)), facing, at };
  }
  const at = stance(hole, s.lastRest, s.aim);
  const facing = screenDir(s.aim);
  if (p.kind === 'rolling' && p.t < STROKE_SECONDS) {
    const n = anims.stroke.frames;
    return { anim: 'stroke', frame: Math.min(n - 1, Math.floor((p.t / STROKE_SECONDS) * n)), facing, at };
  }
  if (p.kind === 'rolling') return { anim: 'idle', frame: loop(time, anims.idle), facing, at };
  if (p.kind === 'holed') return { anim: 'celebrate', frame: loop(p.t, anims.celebrate), facing, at };
  return null;
}
