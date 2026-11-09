// Usage: npm run solve -- <hole number> [--course <id>]   (default course: backyard)
// Greedy search: each stroke tries a coarse grid of angles × powers, refines the best,
// and stops as soon as a stroke sinks the ball. Prints JSON: { hole, holed, shots: [[angleDeg, power], ...] }.
import { courseHoles, isCourseId, loadCourseDef } from '../src/world/course';
import { parseManifest } from '../src/world/manifest';
import { solve } from '../src/world/solver';

const args = process.argv.slice(2);
const flag = args.indexOf('--course');
const courseId = flag >= 0 ? args[flag + 1] : 'backyard';
const n = Number(flag === 0 ? args[2] : args[0]);
if (!isCourseId(courseId)) {
  console.error(`Unknown course "${courseId}"`);
  process.exit(2);
}
const course = await loadCourseDef(courseId);
if (!Number.isInteger(n) || n < 1 || n > course.holes.length) {
  console.error(`Usage: npm run solve -- <1..${course.holes.length}> [--course <id>]`);
  process.exit(2);
}
const hole = courseHoles(course, parseManifest(course.manifest))[n - 1];
const result = solve(hole);
console.log(JSON.stringify({ course: courseId, hole: hole.name, ...result }));
process.exitCode = result.holed ? 0 : 1;
