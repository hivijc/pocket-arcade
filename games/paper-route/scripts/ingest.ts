// Usage (run from the repo root):
//   npm run ingest:paper-route -- object <name> <png | dir-of-frames> [fps]
//       → assets/sprites/<name>.png + manifest image (a dir becomes a left-to-right frame strip)
//   npm run ingest:paper-route -- rider <dir>
//       → assets/sprites/rider.png + assets/rider.json
//     <dir> is an extracted PixelLab character ZIP: <dir>/<state>/animations/ride/<direction>/frame_NNN.png
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import paletteJson from '../assets/palette.json';
import { parsePalette } from '../src/render/palette';
import { DIRS } from '../src/world/rider';
import { bottomCenter, packRows, snapToPalette, trim, type Bitmap } from './lib/sprite-tools';

/** Resolved from this script's own location, so the game folder can move. */
const ASSETS = fileURLToPath(new URL('../assets', import.meta.url));
const RIDER_FPS = 10;
const colors = parsePalette(paletteJson);

function readPng(file: string): Bitmap {
  const png = PNG.sync.read(readFileSync(file));
  return { width: png.width, height: png.height, data: new Uint8Array(png.data) };
}

function writePng(file: string, b: Bitmap): void {
  const png = new PNG({ width: b.width, height: b.height });
  png.data = Buffer.from(b.data);
  writeFileSync(file, PNG.sync.write(png));
}

const framesIn = (dir: string): string[] => readdirSync(dir).filter((f) => f.endsWith('.png')).sort().map((f) => join(dir, f));

function ingestObject(name: string, input: string, fps: number): void {
  if (!/^[a-z0-9-]+$/.test(name)) throw new Error(`bad sprite name "${name}"`);
  const files = statSync(input).isDirectory() ? framesIn(input) : [input];
  if (files.length === 0) throw new Error(`no frames in ${input}`);
  const frames = files.map((f) => snapToPalette(readPng(f), colors));
  const sheet = frames.length === 1
    ? (() => { const b = trim(frames[0], 1); return { bitmap: b, anchor: bottomCenter(b) }; })()
    : packRows([frames]);
  mkdirSync(`${ASSETS}/sprites`, { recursive: true });
  writePng(`${ASSETS}/sprites/${name}.png`, sheet.bitmap);
  const manifestFile = `${ASSETS}/manifest.json`;
  const manifest = JSON.parse(readFileSync(manifestFile, 'utf8')) as Record<string, Record<string, unknown>>;
  manifest[name] = { ...(manifest[name] ?? {}), image: { src: `${name}.png`, anchor: sheet.anchor, frames: frames.length, fps } };
  writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`object ${name}: ${frames.length} frame(s), sheet ${sheet.bitmap.width}x${sheet.bitmap.height}, anchor ${sheet.anchor.join(',')}`);
}

function ingestRider(dir: string): void {
  const state = readdirSync(dir, { withFileTypes: true }).find((d) => d.isDirectory())?.name;
  if (!state) throw new Error(`no state folder in ${dir}`);
  const rows: Bitmap[][] = [];
  const rowOf: Record<string, number> = {};
  let frames = Infinity;
  for (const d of DIRS) {
    const folder = join(dir, state, 'animations', 'ride', d);
    if (!existsSync(folder)) throw new Error(`missing ${folder} (rename the animation folder to "ride")`);
    const files = framesIn(folder);
    if (files.length === 0) throw new Error(`no frames in ${folder}`);
    frames = Math.min(frames, files.length);
    rowOf[d] = rows.length;
    rows.push(files.map((f) => snapToPalette(readPng(f), colors)));
  }
  const sheet = packRows(rows);
  mkdirSync(`${ASSETS}/sprites`, { recursive: true });
  writePng(`${ASSETS}/sprites/rider.png`, sheet.bitmap);
  const layout = { src: 'rider.png', cell: sheet.cell, anchor: sheet.anchor, frames, fps: RIDER_FPS, rows: rowOf };
  writeFileSync(`${ASSETS}/rider.json`, `${JSON.stringify(layout, null, 2)}\n`);
  console.log(`rider: ${rows.length} rows x ${frames} frames, cell ${sheet.cell.join('x')}`);
}

const [kind, a, b] = process.argv.slice(2);
try {
  if (kind === 'object' && a && b) ingestObject(a, b, Number(process.argv[5] ?? 8));
  else if (kind === 'rider' && a) ingestRider(a);
  else {
    console.error('Usage: npm run ingest:paper-route -- object <name> <png|dir> [fps] | rider <dir>');
    process.exitCode = 2;
  }
} catch (err) {
  console.error(String(err));
  process.exitCode = 1;
}
