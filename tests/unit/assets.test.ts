import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { parsePalette } from '../../src/render/palette';
import { parseGolfer } from '../../src/world/golfer';
import { parseManifest } from '../../src/world/manifest';

/** Each course's palette, manifest and sprite folders (Backyard keeps the top-level paths; UI art uses its palette). */
const COURSES = [
  { id: 'backyard', palette: 'assets/palette.json', manifest: 'assets/manifest.json', sprites: 'assets/sprites', extra: ['assets/ui'] },
  { id: 'boardwalk', palette: 'assets/courses/boardwalk/palette.json', manifest: 'assets/courses/boardwalk/manifest.json', sprites: 'assets/courses/boardwalk/sprites', extra: [] },
];
const readJson = (f: string): unknown => JSON.parse(readFileSync(f, 'utf8'));
const pngsIn = (dir: string) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.png')).map((f) => `${dir}/${f}`) : []);

describe.each(COURSES)('$id assets', (c) => {
  const palette = new Set(parsePalette(readJson(c.palette)).map((rgb) => rgb.join(',')));

  it('has a 32-colour palette', () => {
    expect(palette.size).toBe(32);
  });

  it('every manifest image file exists', () => {
    for (const [name, def] of Object.entries(parseManifest(readJson(c.manifest)))) {
      if (def.image) expect(existsSync(`${c.sprites}/${def.image.src}`), `${name}: ${def.image.src}`).toBe(true);
    }
  });

  it('every sprite uses only its palette colours and full or no alpha', () => {
    for (const file of [c.sprites, ...c.extra].flatMap(pngsIn)) {
      const png = PNG.sync.read(readFileSync(file));
      for (let i = 0; i < png.data.length; i += 4) {
        const a = png.data[i + 3];
        if (a === 0) continue;
        expect(a, `${file}: partial alpha at pixel ${i / 4}`).toBe(255);
        expect(palette.has(`${png.data[i]},${png.data[i + 1]},${png.data[i + 2]}`), `${file}: off-palette at pixel ${i / 4}`).toBe(true);
      }
    }
  });
});

describe('Boardwalk manifest', () => {
  const m = parseManifest(readJson('assets/courses/boardwalk/manifest.json'));
  it('has lights for night and a swaying palm', () => {
    expect(Object.values(m).some((d) => d.light)).toBe(true);
    expect(m.palm.sway).toBe(true);
  });
  it('every prop has a PixelLab image', () => {
    for (const [name, def] of Object.entries(m)) expect(def.image, name).toBeDefined();
  });
});

describe('golfer', () => {
  it('the golfer layout (if present) matches its sheet', () => {
    if (!existsSync('assets/golfer.json')) return;
    const g = parseGolfer(readJson('assets/golfer.json'));
    const png = PNG.sync.read(readFileSync(`assets/sprites/${g.src}`));
    const rowCount = Math.max(...Object.values(g.anims).flatMap((a) => Object.values(a.rows))) + 1;
    const maxFrames = Math.max(...Object.values(g.anims).map((a) => a.frames));
    expect(png.height).toBe(rowCount * g.cell[1]);
    expect(png.width).toBeGreaterThanOrEqual(maxFrames * g.cell[0]);
  });
});
