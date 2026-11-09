// Greedy par search: each stroke tries a coarse grid of angles × powers, refines the best,
// and stops as soon as a stroke sinks the ball. "Best" is the shortest walking distance to the
// cup around X tiles, so bank shots through a maze aren't scored as if fences weren't there.
// Water counts as open: a ball can hop it (shots that stop in it are never candidates).
// Pure and browser-safe: used by `npm run solve` and the hole editor.
import { restingBall, type Ball } from '../physics/ball';
import { simulateShot, type ShotResult } from '../physics/simulate';
import type { Hole } from './hole';

export type Shot = readonly [angleDeg: number, power: number];
export interface Solution { readonly holed: boolean; readonly shots: readonly Shot[] }
interface Candidate { readonly shot: Shot; readonly result: ShotResult; readonly dist: number }

export const range = (from: number, to: number, stepSize: number): number[] =>
  Array.from({ length: Math.round((to - from) / stepSize) + 1 }, (_, i) => Number((from + i * stepSize).toFixed(4)));

const DIAG = Math.SQRT2;
const NEIGHBOURS: readonly (readonly [number, number, number])[] = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, DIAG], [1, -1, DIAG], [-1, 1, DIAG], [-1, -1, DIAG],
];

/** Tile-to-cup distance over every tile but X (water can be hopped); Infinity where the cup can't be reached. */
export function distanceField(hole: Hole): number[][] {
  const field = hole.surface.map((row) => [...row].map(() => Infinity));
  const playable = (x: number, y: number) => x >= 0 && y >= 0 && x < hole.width && y < hole.depth && hole.surface[y][x] !== 'X';
  const cx = Math.floor(hole.cup[0]), cy = Math.floor(hole.cup[1]);
  field[cy][cx] = 0;
  // Dijkstra on a small grid: a sorted frontier is plenty fast.
  let frontier: [number, number][] = [[cx, cy]];
  while (frontier.length > 0) {
    frontier.sort((a, b) => field[a[1]][a[0]] - field[b[1]][b[0]]);
    const [x, y] = frontier.shift()!;
    for (const [dx, dy, cost] of NEIGHBOURS) {
      const nx = x + dx, ny = y + dy;
      // No corner-cutting: a diagonal needs both orthogonal tiles open.
      if (!playable(nx, ny) || (dx !== 0 && dy !== 0 && (!playable(x + dx, y) || !playable(x, y + dy)))) continue;
      const d = field[y][x] + cost;
      if (d < field[ny][nx]) {
        field[ny][nx] = d;
        frontier = [...frontier.filter(([fx, fy]) => fx !== nx || fy !== ny), [nx, ny]];
      }
    }
  }
  return field;
}

/** Distance from a resting point to the cup: straight-line on the cup tile, else walking distance plus the in-tile offset. */
export function cupDistance(hole: Hole, field: readonly (readonly number[])[], x: number, y: number): number {
  const straight = Math.hypot(x - hole.cup[0], y - hole.cup[1]);
  const tile = field[Math.floor(y)]?.[Math.floor(x)] ?? Infinity;
  if (tile === 0) return straight;
  return Math.max(straight, tile + Math.hypot(x - Math.floor(x) - 0.5, y - Math.floor(y) - 0.5));
}

function search(hole: Hole, field: number[][], ball: Ball, angles: number[], powers: number[]): Candidate | null {
  let best: Candidate | null = null;
  for (const a of angles) {
    for (const p of powers) {
      const result = simulateShot(hole, ball, (a * Math.PI) / 180, p);
      if (result.outcome === 'holed') return { shot: [a, p], result, dist: 0 };
      if (result.outcome !== 'stopped') continue;
      const dist = cupDistance(hole, field, result.ball.x, result.ball.y);
      if (!best || dist < best.dist) best = { shot: [a, p], result, dist };
    }
  }
  return best;
}

export function solve(hole: Hole, strokes: number = hole.par): Solution {
  const field = distanceField(hole);
  let ball = restingBall(hole, hole.tee);
  const shots: Shot[] = [];
  for (let stroke = 0; stroke < strokes; stroke++) {
    const coarse = search(hole, field, ball, range(-180, 178, 2), range(0.05, 1, 0.05));
    if (!coarse) break;
    const pick = coarse.dist === 0 ? coarse : search(
      hole, field, ball,
      range(coarse.shot[0] - 2, coarse.shot[0] + 2, 0.25),
      range(Math.max(0.02, coarse.shot[1] - 0.05), Math.min(1, coarse.shot[1] + 0.05), 0.005),
    ) ?? coarse;
    shots.push(pick.shot);
    if (pick.dist === 0) return { holed: true, shots };
    ball = pick.result.ball;
  }
  return { holed: false, shots };
}
