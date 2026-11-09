import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import manifestJson from '../../assets/manifest.json';
import paletteJson from '../../assets/palette.json';
import hole1 from '../../src/world/holes/01.json';
import hole2 from '../../src/world/holes/02.json';
import hole3 from '../../src/world/holes/03.json';
import { picketPixels } from '../../src/render/fences';
import { viewFor } from '../../src/render/iso';
import { bakeLightMask, lampsOf } from '../../src/render/lights';
import { createPalette } from '../../src/render/palette';
import { buildPhaseTables } from '../../src/render/post';
import { PHASES, PHASE_IDS } from '../../src/render/time-of-day';
import { bakeTerrain } from '../../src/render/terrain-bake';
import { parseHole } from '../../src/world/hole';
import { parseManifest } from '../../src/world/manifest';

/**
 * Backyard must look byte-identical across the multi-course refactor. These hashes were taken from
 * the single-course code (commit 45058fa) and cover the baked terrain frames, ground heights,
 * lamp-light mask and every fence pixel of holes 1–3, plus the palette LUT and post-pass tables.
 */
const GOLDEN: Record<string, string> = {
  'Gnome Alley': '0cf0b62251cff9304eb6c9db69b5f1037e3e98bf435359a97f83f3cede1a938b',
  'Picket Bank': 'a8979814a76e59ef68573e1df23b3cc2e1cbb1485329f57c704d81e0c4b8aba0',
  'Pool Hop': 'aeb3dd5399c8cf7300a87c928475a98f1e721226fbda448b6c7021818c7d6095',
};
const GOLDEN_POST = '95ae579cc63d285d02b67afee71233364b4b0eea18ed4629651f327ee771ade3';

const manifest = parseManifest(manifestJson);
const holes = [hole1, hole2, hole3].map((raw, i) => parseHole(raw, manifest, `holes/0${i + 1}.json`));

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
  it.each([0, 1, 2])('hole %i is unchanged', (i) => {
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
