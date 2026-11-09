import { distance, type Vec2 } from '../core/geometry';
import type { Hazard, OtherRider } from '../world/slope';
import { BOARD, CLEAR_Z, HAZARD_R, RIDERS } from './constants';

/** Index of the hazard the rider at (c, d, z) overlaps, or −1. `skip` lists hazards that are gone (burst snowmen). */
export function hitHazard(hazards: readonly Hazard[], c: number, d: number, z: number, skip: readonly number[] = []): number {
  return hazards.findIndex((h, i) =>
    Math.abs(h.at[1] - d) < 1.5 && z < CLEAR_Z[h.kind] && !skip.includes(i) && distance(h.at, [c, d]) <= HAZARD_R[h.kind] + BOARD.radius);
}

export interface RiderPos {
  readonly c: number;
  readonly d: number;
}

export function pathLength(path: readonly Vec2[]): number {
  return path.slice(1).reduce((n, p, i) => n + distance(path[i], p), 0);
}

/** The point `dist` tiles along a path, or null past its end (the rider has left the slope). */
export function pointAlong(path: readonly Vec2[], dist: number): RiderPos | null {
  let left = dist;
  for (let i = 1; i < path.length; i++) {
    const seg = distance(path[i - 1], path[i]);
    if (left <= seg) {
      const t = seg === 0 ? 0 : left / seg;
      return { c: path[i - 1][0] + (path[i][0] - path[i - 1][0]) * t, d: path[i - 1][1] + (path[i][1] - path[i - 1][1]) * t };
    }
    left -= seg;
  }
  return null;
}

export const wakes = (r: OtherRider, playerD: number): boolean => playerD >= r.path[0][1] - RIDERS.wake;

export const riderPos = (r: OtherRider, startedAt: number | null, now: number): RiderPos | null =>
  startedAt === null ? null : pointAlong(r.path, r.speed * Math.max(0, now - startedAt));

export function hitsRider(positions: readonly (RiderPos | null)[], c: number, d: number, z: number): boolean {
  if (z >= CLEAR_Z.rider) return false;
  return positions.some((p) => p !== null && distance([p.c, p.d], [c, d]) <= RIDERS.radius + BOARD.radius);
}
