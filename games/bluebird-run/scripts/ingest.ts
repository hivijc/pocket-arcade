// Usage (run from the repo root):
//   npm run ingest:bluebird-run -- object <name> <png | dir-of-frames> [fps]
//       → assets/sprites/<name>.png + manifest image (a dir becomes a left-to-right frame strip)
//   npm run ingest:bluebird-run -- rider <dir>
//       → assets/sprites/rider.png + assets/rider.json
//     <dir> is an extracted PixelLab character ZIP. For each animation in ride, air, grab, tumble it reads
//     <dir>/<state>/animations/<anim>/<direction>/frame_NNN.png (rename PixelLab's animation folders to these names).
//     With no ride animation, the static <dir>/<state>/rotations/<direction>.png images become a 1-frame ride.
//     Raw downloads go in games/bluebird-run/assets/raw/ (gitignored).
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import paletteJson from '../assets/palette.json';
import { parsePalette } from '../src/render/palette';
import { ANIMS, DIRS } from '../src/world/rider';
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

function framesFor(dir: string, state: string, anim: string, d: string): string[] | null {
  const folder = join(dir, state, 'animations', anim, d);
  if (existsSync(folder)) return framesIn(folder);
  const still = join(dir, state, 'rotations', `${d}.png`);
  return anim === 'ride' && existsSync(still) ? [still] : null;
}

function ingestRider(dir: string): void {
  const state = readdirSync(dir, { withFileTypes: true }).find((e) => e.isDirectory())?.name;
  if (!state) throw new Error(`no state folder in ${dir}`);
  const rows: Bitmap[][] = []; // local accumulator for the sheet
  const anims: Record<string, { frames: number; rows: Record<string, number> }> = {};
  for (const anim of ANIMS) {
    const perDir = DIRS.map((d) => framesFor(dir, state, anim, d));
    if (perDir.every((f) => f === null)) {
      if (anim === 'ride') throw new Error(`no ride animation or rotations in ${join(dir, state)}`);
      continue;
    }
    const missing = DIRS.filter((_, i) => !perDir[i]?.length);
    if (missing.length) throw new Error(`${anim}: missing directions ${missing.join(', ')}`);
    const frames = Math.min(...perDir.map((f) => f!.length));
    anims[anim] = { frames, rows: Object.fromEntries(DIRS.map((d, i) => [d, rows.length + i])) };
    for (const files of perDir) rows.push(files!.slice(0, frames).map((f) => snapToPalette(readPng(f), colors)));
  }
  const sheet = packRows(rows);
  mkdirSync(`${ASSETS}/sprites`, { recursive: true });
  writePng(`${ASSETS}/sprites/rider.png`, sheet.bitmap);
  const layout = { src: 'rider.png', cell: sheet.cell, anchor: sheet.anchor, fps: RIDER_FPS, anims };
  writeFileSync(`${ASSETS}/rider.json`, `${JSON.stringify(layout, null, 2)}\n`);
  console.log(`rider: ${Object.keys(anims).join(', ')}; ${rows.length} rows, cell ${sheet.cell.join('x')}`);
}

const [kind, a, b] = process.argv.slice(2);
try {
  const fps = Number(process.argv[5] ?? 8);
  if (kind === 'object' && a && b && !(Number.isFinite(fps) && fps > 0)) throw new Error(`fps must be a positive number, got "${process.argv[5]}"`);
  if (kind === 'object' && a && b) ingestObject(a, b, fps);
  else if (kind === 'rider' && a) ingestRider(a);
  else {
    console.error('Usage: npm run ingest:bluebird-run -- object <name> <png|dir> [fps] | rider <dir>');
    process.exitCode = 2;
  }
} catch (err) {
  console.error(String(err));
  process.exitCode = 1;
}
