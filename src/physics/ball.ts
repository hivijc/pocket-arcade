import { closestPointOnSegment, type Vec2 } from '../core/geometry';
import type { Hole, Surface } from '../world/hole';
import {
  BALL_R, CAPTURE_SPEED, CUP_R, FRICTION, GRAVITY, LAND_KEEP, LAUNCH_DROP, LIP_DEFLECT, LIP_KEEP,
  MAX_PUTT_SPEED, SLOPE_ACCEL, STEP, STOP_SPEED, WALL_KEEP,
} from './constants';
import { gradientAt, heightAt, surfaceAt } from './terrain';

export interface Ball {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly vx: number;
  readonly vy: number;
  /** Vertical speed: while rolling, the ground's rise rate along the path; while airborne, true vertical speed. */
  readonly vz: number;
  readonly airborne: boolean;
  /** True while the ball is over the cup (so a lip-out deflects only once per pass). */
  readonly overCup: boolean;
}

export type BallEvent = 'wall' | 'land' | 'lip' | 'holed' | 'water' | 'stopped';

export interface StepResult {
  readonly ball: Ball;
  readonly events: readonly BallEvent[];
}

export function restingBall(hole: Hole, at: Vec2): Ball {
  return { x: at[0], y: at[1], z: heightAt(hole, at[0], at[1]), vx: 0, vy: 0, vz: 0, airborne: false, overCup: false };
}

export function isMoving(b: Ball): boolean {
  return b.airborne || b.vx !== 0 || b.vy !== 0;
}

export function strike(ball: Ball, angle: number, power: number): Ball {
  const s = Math.max(0, Math.min(1, power)) * MAX_PUTT_SPEED;
  return { ...ball, vx: Math.cos(angle) * s, vy: Math.sin(angle) * s, vz: 0, airborne: false };
}

const frictionOf = (s: Surface | null): number => (s === 'R' ? FRICTION.R : s === 'S' ? FRICTION.S : FRICTION.G);
const halt = (b: Ball): Ball => ({ ...b, vx: 0, vy: 0, vz: 0, airborne: false });

function flyStep(b: Ball, hole: Hole, dt: number, events: BallEvent[]): Ball {
  const vz = b.vz - GRAVITY * dt;
  const x = b.x + b.vx * dt;
  const y = b.y + b.vy * dt;
  const z = b.z + vz * dt;
  const ground = heightAt(hole, x, y);
  if (z > ground) return { ...b, x, y, z, vz };
  events.push('land');
  return { ...b, x, y, z: ground, vx: b.vx * LAND_KEEP, vy: b.vy * LAND_KEEP, vz: 0, airborne: false };
}

function rollStep(b: Ball, hole: Hole, dt: number): Ball {
  const friction = frictionOf(surfaceAt(hole, b.x, b.y));
  const [gx, gy] = gradientAt(hole, b.x, b.y);
  const sx = b.vx - SLOPE_ACCEL * gx * dt;
  const sy = b.vy - SLOPE_ACCEL * gy * dt;
  const sp = Math.hypot(sx, sy);
  const keep = sp > 0 ? (sp - Math.min(sp, friction * dt)) / sp : 0;
  const vx = sx * keep;
  const vy = sy * keep;
  const x = b.x + vx * dt;
  const y = b.y + vy * dt;
  const ground = heightAt(hole, x, y);
  const groundVz = (ground - b.z) / dt;
  if (b.vz - groundVz > LAUNCH_DROP) {
    return { ...b, x, y, z: b.z + b.vz * dt, vx, vy, airborne: true };
  }
  return { ...b, x, y, z: ground, vx, vy, vz: groundVz };
}

function collide(b: Ball, hole: Hole, events: BallEvent[]): Ball {
  let x = b.x, y = b.y, vx = b.vx, vy = b.vy, hit = false;
  const pushOut = (px: number, py: number, minDist: number) => {
    const dx = x - px, dy = y - py;
    const d = Math.hypot(dx, dy);
    if (d >= minDist || d === 0) return;
    const nx = dx / d, ny = dy / d;
    x = px + nx * minDist;
    y = py + ny * minDist;
    const vn = vx * nx + vy * ny;
    if (vn < 0) {
      vx = (vx - 2 * vn * nx) * WALL_KEEP;
      vy = (vy - 2 * vn * ny) * WALL_KEEP;
      hit = true;
    }
  };
  for (const w of hole.walls) {
    const [px, py] = closestPointOnSegment([x, y], w.a, w.b);
    pushOut(px, py, BALL_R);
  }
  for (const c of hole.circles) pushOut(c.c[0], c.c[1], c.r + BALL_R);
  if (hit) events.push('wall');
  return x === b.x && y === b.y && vx === b.vx && vy === b.vy ? b : { ...b, x, y, vx, vy };
}

function settle(b: Ball, hole: Hole, events: BallEvent[]): Ball {
  if (![b.x, b.y, b.z, b.vx, b.vy, b.vz].every(Number.isFinite)) {
    events.push('water');
    return halt(b);
  }
  if (b.airborne) return b;
  const surf = surfaceAt(hole, b.x, b.y);
  if (surf === null || surf === 'W' || surf === 'X') {
    events.push('water');
    return halt(b);
  }
  const z = heightAt(hole, b.x, b.y);
  const sp = Math.hypot(b.vx, b.vy);
  const tx = hole.cup[0] - b.x, ty = hole.cup[1] - b.y;
  const overCup = Math.hypot(tx, ty) < CUP_R;
  if (overCup && sp < CAPTURE_SPEED) {
    events.push('holed');
    return { ...halt(b), x: hole.cup[0], y: hole.cup[1], z, overCup: true };
  }
  let vx = b.vx, vy = b.vy;
  if (overCup && !b.overCup) {
    events.push('lip');
    const side = Math.sign(vx * ty - vy * tx); // cup to the left (+) or right (-) of travel
    const a = -side * LIP_DEFLECT;
    [vx, vy] = [(vx * Math.cos(a) - vy * Math.sin(a)) * LIP_KEEP, (vx * Math.sin(a) + vy * Math.cos(a)) * LIP_KEEP];
  }
  const [gx, gy] = gradientAt(hole, b.x, b.y);
  if (Math.hypot(vx, vy) < STOP_SPEED && SLOPE_ACCEL * Math.hypot(gx, gy) < frictionOf(surf)) {
    events.push('stopped');
    return { ...halt(b), z, overCup };
  }
  return { ...b, z, vx, vy, overCup };
}

export function step(ball: Ball, hole: Hole, dt: number = STEP): StepResult {
  if (!isMoving(ball)) return { ball, events: [] };
  const events: BallEvent[] = [];
  const moved = ball.airborne ? flyStep(ball, hole, dt, events) : rollStep(ball, hole, dt);
  const walled = collide(moved, hole, events);
  return { ball: settle(walled, hole, events), events };
}
