// Usage: npm run solve -- <hole number, e.g. 4>
// Prints JSON: { hole, holed, shots: [[angleDeg, power], ...] }. Exit code 1 when par isn't reached.
import { existsSync, readFileSync } from 'node:fs';
import manifestJson from '../assets/manifest.json';
import { parseManifest } from '../src/world/manifest';
import { parseHole } from '../src/world/hole';
import { solve } from '../src/world/solver';

const n = Number(process.argv[2]);
const file = `src/world/holes/${String(n).padStart(2, '0')}.json`;
if (!Number.isInteger(n) || n < 1 || !existsSync(file)) {
  console.error(`Usage: npm run solve -- <hole number>  (no ${file})`);
  process.exit(2);
}
const hole = parseHole(JSON.parse(readFileSync(file, 'utf8')), parseManifest(manifestJson), file);
const result = solve(hole);
console.log(JSON.stringify({ hole: hole.name, ...result }));
process.exitCode = result.holed ? 0 : 1;
