// Usage: npm run eval-hole -- <hole number> ['[[angleDeg, power], ...]']
// With a shot list, traces those shots (outcome and resting point of each) instead.
// Design aid: prints the par search result plus how much of a 1° × 0.02 shot grid from the tee
// holes in one (so a designer can check a hole-in-one isn't trivial).
import { existsSync, readFileSync } from 'node:fs';
import manifestJson from '../assets/manifest.json';
import { restingBall } from '../src/physics/ball';
import { simulateShot } from '../src/physics/simulate';
import { parseHole } from '../src/world/hole';
import { parseManifest } from '../src/world/manifest';
import { range, solve } from '../src/world/solver';

const n = Number(process.argv[2]);
const file = `src/world/holes/${String(n).padStart(2, '0')}.json`;
if (!Number.isInteger(n) || !existsSync(file)) {
  console.error(`Usage: npm run eval-hole -- <hole number>  (no ${file})`);
  process.exit(2);
}
const hole = parseHole(JSON.parse(readFileSync(file, 'utf8')), parseManifest(manifestJson), file);
const from = restingBall(hole, hole.tee);
if (process.argv[3]) {
  let b = from;
  for (const [a, p] of JSON.parse(process.argv[3]) as [number, number][]) {
    const r = simulateShot(hole, b, (a * Math.PI) / 180, p);
    if (r.outcome !== 'water') b = r.ball;
    console.log(a, p, r.outcome, r.ball.x.toFixed(2), r.ball.y.toFixed(2), r.ball.z.toFixed(2), `${(r.steps / 120).toFixed(1)}s`);
  }
  process.exit(0);
}
const outcomes = { holed: 0, stopped: 0, water: 0, timeout: 0 };
const aces: [number, number][] = [];
for (const a of range(-180, 179, 1)) {
  for (const p of range(0.02, 1, 0.02)) {
    const o = simulateShot(hole, from, (a * Math.PI) / 180, p).outcome;
    outcomes[o]++;
    if (o === 'holed') aces.push([a, p]);
  }
}
const total = Object.values(outcomes).reduce((s, v) => s + v, 0);
console.log(JSON.stringify({ hole: hole.name, par: hole.par, ...solve(hole) }));
console.log(`ace share ${(100 * outcomes.holed / total).toFixed(3)}% of ${total}`, outcomes, aces.slice(0, 12));
