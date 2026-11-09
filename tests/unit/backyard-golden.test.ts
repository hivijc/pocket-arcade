import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import manifestJson from '../../assets/manifest.json';
import paletteJson from '../../assets/palette.json';
import { picketPixels } from '../../src/render/fences';
import { viewFor } from '../../src/render/iso';
import { bakeLightMask, lampsOf } from '../../src/render/lights';
import { createPalette } from '../../src/render/palette';
import { buildPhaseTables } from '../../src/render/post';
import { PHASES, PHASE_IDS } from '../../src/render/time-of-day';
import { bakeTerrain } from '../../src/render/terrain-bake';
import { parseCourse } from '../../src/world/course';
import { parseManifest } from '../../src/world/manifest';

/**
 * Backyard must look byte-identical across the multi-course refactor. These hashes were taken from
 * the single-course code (holes 1–3 at commit 45058fa, holes 4–9 at main 22fac3f) and cover the baked
 * terrain frames, ground heights, lamp-light mask and every fence pixel, plus the palette LUT and
 * post-pass tables.
 */
const GOLDEN: Record<string, string> = {
  'Gnome Alley': '0cf0b62251cff9304eb6c9db69b5f1037e3e98bf435359a97f83f3cede1a938b',
  'Picket Bank': 'a8979814a76e59ef68573e1df23b3cc2e1cbb1485329f57c704d81e0c4b8aba0',
  'Pool Hop': 'aeb3dd5399c8cf7300a87c928475a98f1e721226fbda448b6c7021818c7d6095',
  'Bunker Guard': 'e8212d6b2441cf317ec18cf0e75c49a6f9b4bfc0374dac245a84cb2d161ca050',
  'Tilted Green': '3ffdccba73c0aa1c2edf64c784240159c16a5b75cd1a9f9be8bbceac55b10649',
  'Plank Bridge': 'a3670175178f919c77f57fade5c8b61f6be63a77d428405505fe61eacbbb5867',
  'Upper Deck': '24107727c45d4422c4c34b7aa1eaac00d117fbf8877d0ea13c587bccd4009719',
  'Gnome Maze': '2afe5c9b0ad49d7037cdca2ca478ab812a62d5f718e9cd24d7552a4a925a5c8a',
  'Grand Finale': 'e8e722c37566206963163a8e927a48f2327483fe75ea343c7b1735f745b375ad',
};
const GOLDEN_POST = '95ae579cc63d285d02b67afee71233364b4b0eea18ed4629651f327ee771ade3';

const manifest = parseManifest(manifestJson);
const holes = parseCourse(import.meta.glob('../../src/world/holes/*.json', { eager: true, import: 'default' }), manifest);

function bakeHash(i: number): string {
  const hole = holes[i];
  const view = viewFor(hole, 360, 270);
  const bake = bakeTerrain(hole, view, 360, 270);
  const h = createHash('sha256');
  for (const f of bake.frames) h.update(f);
  h.update(new Uint8Array(bake.ground.buffer));
  h.update(bakeLightMask(bake, view, lampsOf(hole, manifest)));
  h.update(JSON.stringify(hole.walls.map((w) => picketPixels(hole, view, w))));
  return h.digest('hex');
}

describe('Backyard golden bake', () => {
  it('covers every Backyard hole', () => {
    expect(holes.map((h) => h.name)).toEqual(Object.keys(GOLDEN));
  });

  it.each(holes.map((_, i) => i))('hole %i is unchanged', (i) => {
    expect(bakeHash(i)).toBe(GOLDEN[holes[i].name]);
  });

  it('palette LUT and post-pass tables are unchanged', () => {
    const palette = createPalette(paletteJson);
    const h = createHash('sha256').update(palette.lut);
    for (const id of PHASE_IDS) for (const band of buildPhaseTables(palette, PHASES[id]).bands) h.update(band);
    const hash = h.digest('hex');
    expect(hash).toBe(GOLDEN_POST);
  });
});
