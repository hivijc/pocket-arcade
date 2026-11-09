// Usage: npm run ace-scan -- [--course <id>]
// Counts the (angle, power) pairs that make a hole-in-one from the tee on each hole,
// over 1° × 0.01-power steps, and prints the angle ranges that do. Used to keep aces rare.
import { courseHoles, isCourseId, loadCourseDef } from '../src/world/course';
import { parseManifest } from '../src/world/manifest';
import { restingBall } from '../src/physics/ball';
import { simulateShot } from '../src/physics/simulate';

const args = process.argv.slice(2);
const flag = args.indexOf('--course');
const id = flag >= 0 ? args[flag + 1] : 'backyard';
if (!isCourseId(id)) throw new Error(`unknown course ${id}`);
const course = await loadCourseDef(id);
const manifest = parseManifest(course.manifest);
for (const hole of courseHoles(course, manifest)) {
  const from = restingBall(hole, hole.tee);
  const aces: number[] = [];
  let total = 0;
  for (let deg = -180; deg < 180; deg++) {
    for (let p = 1; p <= 100; p++) {
      total++;
      if (simulateShot(hole, from, (deg * Math.PI) / 180, p / 100).outcome === 'holed') aces.push(deg);
    }
  }
  const angles = [...new Set(aces)];
  console.log(`${hole.name}: ${aces.length}/${total} aces (${((aces.length / total) * 100).toFixed(3)}%), angles ${angles.join(' ')}`);
}
