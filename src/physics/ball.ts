import { closestPointOnSegment, type Vec2 } from '../core/geometry';
import type { Hole, Surface } from '../world/hole';
import {
  BALL_R, CAPTURE_SPEED, CUP_R, FRICTION, GRAVITY, LAND_KEEP, LAUNCH_DROP, LIP_DEFLECT, LIP_KEEP,
  MAX_PUTT_SPEED, MIN_WALL_EVENT_SPEED, SLOPE_ACCEL, STEP, STOP_SPEED, WALL_KEEP,
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

/** The ground's rise rate (height per second) for a ball at (x, y) rolling with velocity (vx, vy). */
function groundRise(hole: Hole, x: number, y: number, vx: number, vy: number): number {
  const [gx, gy] = gradientAt(hole, x, y);
  return gx * vx + gy * vy;
}

export function strike(ball: Ball, hole: Hole, angle: number, power: number): Ball {
  const s = Math.max(0, Math.min(1, power)) * MAX_PUTT_SPEED;
  const vx = Math.cos(angle) * s;
  const vy = Math.sin(angle) * s;
  return { ...ball, vx, vy, vz: groundRise(hole, ball.x, ball.y, vx, vy), airborne: false };
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

/** Velocity after one step of slope pull and friction. Where the slope beats friction it is never zero. */
function rolledVelocity(b: Ball, grad: Vec2, friction: number, dt: number): Vec2 {
  const [gx, gy] = grad;
  const sx = b.vx - SLOPE_ACCEL * gx * dt;
  const sy = b.vy - SLOPE_ACCEL * gy * dt;
  const sp = Math.hypot(sx, sy);
  if (!Number.isFinite(sp)) return [sx, sy]; // let settle treat broken values as water
  if (sp > friction * dt) {
    const keep = (sp - friction * dt) / sp;
    return [sx * keep, sy * keep];
  }
  // Friction would zero the velocity (e.g. at an uphill turnaround). If the slope beats friction,
  // the ball starts rolling downhill with the net acceleration instead of parking mid-slope.
  const g = Math.hypot(gx, gy);
  const net = SLOPE_ACCEL * g - friction;
  if (net <= 0) return [0, 0];
  return [(-gx / g) * net * dt, (-gy / g) * net * dt];
}

function rollStep(b: Ball, hole: Hole, dt: number): Ball {
  const friction = frictionOf(surfaceAt(hole, b.x, b.y));
  const [vx, vy] = rolledVelocity(b, gradientAt(hole, b.x, b.y), friction, dt);
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
  let x = b.x, y = b.y, vx = b.vx, vy = b.vy, hit = false, impact = 0;
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
      impact = Math.max(impact, -vn);
    }
  };
  for (const w of hole.walls) {
    const [px, py] = closestPointOnSegment([x, y], w.a, w.b);
    pushOut(px, py, BALL_R);
  }
  for (const c of hole.circles) pushOut(c.c[0], c.c[1], c.r + BALL_R);
  if (impact > MIN_WALL_EVENT_SPEED) events.push('wall');
  if (x === b.x && y === b.y && vx === b.vx && vy === b.vy) return b;
  // A grounded ball redirected by a wall follows the ground along its new path; an airborne one keeps its vz.
  const vz = hit && !b.airborne ? groundRise(hole, x, y, vx, vy) : b.vz;
  return { ...b, x, y, vx, vy, vz };
}

const CONTACT_EPS = 1e-6;

/** Outward normals of every wall or prop the ball at (x, y) is touching. */
function contactNormals(hole: Hole, x: number, y: number): Vec2[] {
  const normals: Vec2[] = [];
  const touch = (px: number, py: number, minDist: number) => {
    const dx = x - px, dy = y - py;
    const d = Math.hypot(dx, dy);
    if (d > 0 && d <= minDist + CONTACT_EPS) normals.push([dx / d, dy / d]);
  };
  for (const w of hole.walls) {
    const [px, py] = closestPointOnSegment([x, y], w.a, w.b);
    touch(px, py, BALL_R);
  }
  for (const c of hole.circles) touch(c.c[0], c.c[1], c.r + BALL_R);
  return normals;
}

/** The slope's downhill pull at (x, y), less any part a touching wall or prop holds back. */
function freeSlopeAccel(hole: Hole, x: number, y: number): number {
  const [gx, gy] = gradientAt(hole, x, y);
  let dx = -gx, dy = -gy;
  for (const [nx, ny] of contactNormals(hole, x, y)) {
    const into = dx * nx + dy * ny;
    if (into < 0) {
      dx -= into * nx;
      dy -= into * ny;
    }
  }
  return SLOPE_ACCEL * Math.hypot(dx, dy);
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
  const entering = overCup && !b.overCup;
  // Capture is decided once per pass, on the entry step: a ball that lips out can't drop until it
  // re-enters — unless it comes (nearly) to rest still inside the cup, where it drops in.
  if ((entering && sp < CAPTURE_SPEED) || (overCup && sp < STOP_SPEED)) {
    events.push('holed');
    return { ...halt(b), x: hole.cup[0], y: hole.cup[1], z, overCup: true };
  }
  let vx = b.vx, vy = b.vy, vz = b.vz;
  if (entering) {
    events.push('lip');
    const side = Math.sign(vx * ty - vy * tx); // cup to the left (+) or right (-) of travel
    const a = -side * LIP_DEFLECT;
    [vx, vy] = [(vx * Math.cos(a) - vy * Math.sin(a)) * LIP_KEEP, (vx * Math.sin(a) + vy * Math.cos(a)) * LIP_KEEP];
  }
  const [gx, gy] = gradientAt(hole, b.x, b.y);
  if (entering) vz = gx * vx + gy * vy;
  if (Math.hypot(vx, vy) < STOP_SPEED && freeSlopeAccel(hole, b.x, b.y) < frictionOf(surf)) {
    events.push('stopped');
    return { ...halt(b), z, overCup };
  }
  return { ...b, z, vx, vy, vz, overCup };
}

/** True where the slope pulls harder than the surface's friction, so a ball can't rest there. */
function slopeBeatsFriction(hole: Hole, b: Ball): boolean {
  return freeSlopeAccel(hole, b.x, b.y) > frictionOf(surfaceAt(hole, b.x, b.y));
}

export function step(ball: Ball, hole: Hole, dt: number = STEP): StepResult {
  if (!isMoving(ball) && !slopeBeatsFriction(hole, ball)) return { ball, events: [] };
  const events: BallEvent[] = [];
  const moved = ball.airborne ? flyStep(ball, hole, dt, events) : rollStep(ball, hole, dt);
  const walled = collide(moved, hole, events);
  return { ball: settle(walled, hole, events), events };
}
