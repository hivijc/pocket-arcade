// Usage: npm run solve -- <hole number 1..3>
// Greedy search: each stroke tries a coarse grid of angles × powers, refines the best,
// and stops as soon as a stroke sinks the ball. Prints JSON: { hole, holed, shots: [[angleDeg, power], ...] }.
import { readFileSync } from 'node:fs';
import manifestJson from '../assets/manifest.json';
import { parseManifest } from '../src/world/manifest';
import { parseHole, type Hole } from '../src/world/hole';
import { restingBall, type Ball } from '../src/physics/ball';
import { simulateShot, type ShotResult } from '../src/physics/simulate';

type Shot = readonly [number, number];
interface Candidate { shot: Shot; result: ShotResult; dist: number }

const range = (from: number, to: number, stepSize: number): number[] =>
  Array.from({ length: Math.round((to - from) / stepSize) + 1 }, (_, i) => Number((from + i * stepSize).toFixed(4)));

function search(hole: Hole, ball: Ball, angles: number[], powers: number[]): Candidate | null {
  let best: Candidate | null = null;
  for (const a of angles) {
    for (const p of powers) {
      const result = simulateShot(hole, ball, (a * Math.PI) / 180, p);
      if (result.outcome === 'holed') return { shot: [a, p], result, dist: 0 };
      if (result.outcome !== 'stopped') continue;
      const dist = Math.hypot(result.ball.x - hole.cup[0], result.ball.y - hole.cup[1]);
      if (!best || dist < best.dist) best = { shot: [a, p], result, dist };
    }
  }
  return best;
}

function solve(hole: Hole): { holed: boolean; shots: Shot[] } {
  let ball = restingBall(hole, hole.tee);
  const shots: Shot[] = [];
  for (let stroke = 0; stroke < hole.par; stroke++) {
    const coarse = search(hole, ball, range(-180, 178, 2), range(0.05, 1, 0.05));
    if (!coarse) break;
    const pick = coarse.dist === 0 ? coarse : search(
      hole, ball,
      range(coarse.shot[0] - 2, coarse.shot[0] + 2, 0.25),
      range(Math.max(0.02, coarse.shot[1] - 0.05), Math.min(1, coarse.shot[1] + 0.05), 0.005),
    ) ?? coarse;
    shots.push(pick.shot);
    if (pick.dist === 0) return { holed: true, shots };
    ball = pick.result.ball;
  }
  return { holed: false, shots };
}

const n = Number(process.argv[2]);
if (![1, 2, 3].includes(n)) {
  console.error('Usage: npm run solve -- <1|2|3>');
  process.exit(2);
}
const file = `src/world/holes/0${n}.json`;
const hole = parseHole(JSON.parse(readFileSync(file, 'utf8')), parseManifest(manifestJson), file);
const result = solve(hole);
console.log(JSON.stringify({ hole: hole.name, ...result }));
process.exitCode = result.holed ? 0 : 1;
