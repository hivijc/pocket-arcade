import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import manifestJson from '../../assets/manifest.json';
import paletteJson from '../../assets/palette.json';
import { parsePalette } from '../../src/render/palette';
import { parseGolfer } from '../../src/world/golfer';
import { parseManifest } from '../../src/world/manifest';

const palette = new Set(parsePalette(paletteJson).map((c) => c.join(',')));
const pngsIn = (dir: string) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.png')).map((f) => `${dir}/${f}`) : []);

describe('assets', () => {
  it('every manifest image file exists', () => {
    for (const [name, def] of Object.entries(parseManifest(manifestJson))) {
      if (def.image) expect(existsSync(`assets/sprites/${def.image.src}`), `${name}: ${def.image.src}`).toBe(true);
    }
  });

  it('every sprite and UI image uses only palette colours and full or no alpha', () => {
    for (const file of [...pngsIn('assets/sprites'), ...pngsIn('assets/ui')]) {
      const png = PNG.sync.read(readFileSync(file));
      for (let i = 0; i < png.data.length; i += 4) {
        const a = png.data[i + 3];
        if (a === 0) continue;
        expect(a, `${file}: partial alpha at pixel ${i / 4}`).toBe(255);
        expect(palette.has(`${png.data[i]},${png.data[i + 1]},${png.data[i + 2]}`), `${file}: off-palette at pixel ${i / 4}`).toBe(true);
      }
    }
  });

  it('the golfer layout (if present) matches its sheet', () => {
    if (!existsSync('assets/golfer.json')) return;
    const g = parseGolfer(JSON.parse(readFileSync('assets/golfer.json', 'utf8')));
    const png = PNG.sync.read(readFileSync(`assets/sprites/${g.src}`));
    const rowCount = Math.max(...Object.values(g.anims).flatMap((a) => Object.values(a.rows))) + 1;
    const maxFrames = Math.max(...Object.values(g.anims).map((a) => a.frames));
    expect(png.height).toBe(rowCount * g.cell[1]);
    expect(png.width).toBeGreaterThanOrEqual(maxFrames * g.cell[0]);
  });
});
