import { describe, expect, it } from 'vitest';
import manifestJson from '../../assets/manifest.json';
import hole1 from '../../src/world/holes/01.json';
import hole2 from '../../src/world/holes/02.json';
import hole3 from '../../src/world/holes/03.json';
import { parseManifest } from '../../src/world/manifest';
import { parseHole } from '../../src/world/hole';

const manifest = parseManifest(manifestJson);
const holes = [hole1, hole2, hole3].map((raw, i) => parseHole(raw, manifest, `holes/0${i + 1}.json`));

describe('Backyard holes', () => {
  it('all load', () => {
    expect(holes.map((h) => h.name)).toEqual(['Gnome Alley', 'Picket Bank', 'Pool Hop']);
    expect(holes.map((h) => h.par)).toEqual([2, 3, 3]);
  });

  it('fit in the 360×270 buffer at 32 px tiles', () => {
    for (const h of holes) {
      expect((h.width + h.depth) * 16).toBeLessThanOrEqual(360); // screen width of the diamond
      expect((h.width + h.depth) * 8).toBeLessThanOrEqual(200); // screen height, leaving room for props
    }
  });

  it('hole 3 has water between the tee and the cup', () => {
    expect(holes[2].surface.some((row) => row.includes('W'))).toBe(true);
  });
});
