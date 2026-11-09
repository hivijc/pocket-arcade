// Usage:
//   npm run ingest -- object <name> <png>   → assets/sprites/<name>.png + manifest image/anchor
//   npm run ingest -- object <name> <png> --course boardwalk
//                                           → assets/courses/boardwalk/sprites/<name>.png, snapped to that
//                                             course's palette, + assets/courses/boardwalk/manifest.json
//   npm run ingest -- ui <name> <png>       → assets/ui/<name>.png
//   npm run ingest -- golfer <dir>          → assets/sprites/golfer.png + assets/golfer.json
//     <dir> is an extracted PixelLab character ZIP: <dir>/<state>/animations/<anim>/<direction>/frame_NNN.png
//     with animations named idle, backswing, stroke, celebrate.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { parsePalette, type RGB } from '../src/render/palette';
import { DIRS, GOLFER_ANIMS, type GolferAnim } from '../src/world/golfer';
import { bottomCenter, packRows, snapToPalette, trim, type Bitmap } from './lib/sprite-tools';

/** Where a course's palette, manifest and sprites live; Backyard keeps the original top-level paths. */
function courseAssets(course: string): { palette: string; manifest: string; sprites: string } {
  if (!/^[a-z0-9-]+$/.test(course)) throw new Error(`bad course id "${course}"`);
  const root = course === 'backyard' ? 'assets' : `assets/courses/${course}`;
  return { palette: `${root}/palette.json`, manifest: `${root}/manifest.json`, sprites: `${root}/sprites` };
}

const paletteOf = (file: string): RGB[] => parsePalette(JSON.parse(readFileSync(file, 'utf8')));
const colors = paletteOf('assets/palette.json');
const FPS: Record<GolferAnim, number> = { idle: 6, backswing: 1, stroke: 12, celebrate: 8 };

function readPng(file: string): Bitmap {
  const png = PNG.sync.read(readFileSync(file));
  return { width: png.width, height: png.height, data: new Uint8Array(png.data) };
}

function writePng(file: string, b: Bitmap): void {
  const png = new PNG({ width: b.width, height: b.height });
  png.data = Buffer.from(b.data);
  writeFileSync(file, PNG.sync.write(png));
}

function ingestObject(name: string, file: string, course: string): void {
  if (!/^[a-z0-9-]+$/.test(name)) throw new Error(`bad sprite name "${name}"`);
  const at = courseAssets(course);
  const bmp = trim(snapToPalette(readPng(file), paletteOf(at.palette)), 1);
  mkdirSync(at.sprites, { recursive: true });
  writePng(`${at.sprites}/${name}.png`, bmp);
  const manifest = JSON.parse(readFileSync(at.manifest, 'utf8')) as Record<string, Record<string, unknown>>;
  const anchor = bottomCenter(bmp);
  manifest[name] = { ...(manifest[name] ?? {}), image: { src: `${name}.png`, anchor } };
  writeFileSync(at.manifest, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`object ${name} (${course}): ${bmp.width}x${bmp.height}, anchor ${anchor.join(',')}`);
}

function ingestUi(name: string, file: string): void {
  mkdirSync('assets/ui', { recursive: true });
  writePng(`assets/ui/${name}.png`, snapToPalette(readPng(file), colors));
  console.log(`ui ${name} written`);
}

function ingestGolfer(dir: string): void {
  const state = readdirSync(dir, { withFileTypes: true }).find((d) => d.isDirectory())?.name;
  if (!state) throw new Error(`no state folder in ${dir}`);
  const rows: Bitmap[][] = [];
  const anims: Record<string, { frames: number; fps: number; rows: Record<string, number> }> = {};
  for (const anim of GOLFER_ANIMS) {
    const animRows: Record<string, number> = {};
    let frames = Infinity;
    for (const d of DIRS) {
      const folder = join(dir, state, 'animations', anim, d);
      if (!existsSync(folder)) throw new Error(`missing ${folder} (rename the animation folder to "${anim}")`);
      const files = readdirSync(folder).filter((f) => f.endsWith('.png')).sort();
      if (files.length === 0) throw new Error(`no frames in ${folder}`);
      frames = Math.min(frames, files.length);
      animRows[d] = rows.length;
      rows.push(files.map((f) => snapToPalette(readPng(join(folder, f)), colors)));
    }
    anims[anim] = { frames, fps: FPS[anim], rows: animRows };
  }
  const sheet = packRows(rows);
  mkdirSync('assets/sprites', { recursive: true });
  writePng('assets/sprites/golfer.png', sheet.bitmap);
  writeFileSync('assets/golfer.json', `${JSON.stringify({ src: 'golfer.png', cell: sheet.cell, anchor: sheet.anchor, anims }, null, 2)}\n`);
  console.log(`golfer: ${rows.length} rows, cell ${sheet.cell.join('x')}, sheet ${sheet.bitmap.width}x${sheet.bitmap.height}`);
}

const args = process.argv.slice(2);
const flag = args.indexOf('--course');
const course = flag >= 0 ? args[flag + 1] ?? '' : 'backyard';
const [kind, a, b] = flag >= 0 ? args.filter((_, i) => i !== flag && i !== flag + 1) : args;
try {
  if (kind === 'object' && a && b) ingestObject(a, b, course);
  else if (kind === 'ui' && a && b) ingestUi(a, b);
  else if (kind === 'golfer' && a) ingestGolfer(a);
  else {
    console.error('Usage: npm run ingest -- object <name> <png> [--course <id>] | ui <name> <png> | golfer <dir>');
    process.exitCode = 2;
  }
} catch (err) {
  console.error(String(err));
  process.exitCode = 1;
}
