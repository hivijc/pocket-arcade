import { describe, expect, it } from 'vitest';
import { WIND_FPS, swayOffset, windStep } from '../../src/render/wind';
import { bakeLightMask, lampsOf, lightBand } from '../../src/render/lights';
import { bakeTerrain } from '../../src/render/terrain-bake';
import { project, viewFor } from '../../src/render/iso';
import { parseManifest } from '../../src/world/manifest';
import { parseHole } from '../../src/world/hole';
import { rawHole } from '../helpers/makeHole';

describe('wind', () => {
  it('steps at 8 fps between two frames', () => {
    expect(WIND_FPS).toBe(8);
    expect(windStep(0)).toBe(0);
    expect(windStep(1 / 8)).toBe(1);
    expect(windStep(2 / 8)).toBe(0);
  });
  it('sways only on step 1, by one pixel', () => {
    expect(swayOffset(0, [3, 4])).toBe(0);
    expect([1, -1]).toContain(swayOffset(1, [3, 4]));
  });
});

describe('lights', () => {
  it('bands get weaker with distance', () => {
    expect(lightBand(0.1, 2)).toBe(3);
    expect(lightBand(1.0, 2)).toBe(2);
    expect(lightBand(1.9, 2)).toBe(1);
    expect(lightBand(2.5, 2)).toBe(0);
  });

  const manifest = parseManifest({
    lamp: { placeholder: { color: '#000', w: 2, h: 20 }, light: { radius: 2 } },
    rock: { placeholder: { color: '#000', w: 4, h: 4 } },
  });
  const hole = parseHole(rawHole({ width: 8, depth: 5, props: [{ sprite: 'lamp', at: [4, 2.5] }, { sprite: 'rock', at: [1, 1] }] }), manifest, 'lit.json');

  it('lists only light-casting props', () => {
    expect(lampsOf(hole, manifest)).toEqual([{ at: [4, 2.5], radius: 2 }]);
  });

  it('masks pixels near a lamp brighter than far ones', () => {
    const view = viewFor(hole, 360, 270);
    const mask = bakeLightMask(bakeTerrain(hole, view, 360, 270), view, lampsOf(hole, manifest));
    const band = (gx: number, gy: number) => {
      const [sx, sy] = project(view, gx, gy, 0);
      return mask[Math.round(sy) * 360 + Math.round(sx)];
    };
    expect(band(4, 2.5)).toBe(3);
    expect(band(0.5, 0.5)).toBe(0);
    expect(mask[0]).toBe(0);
  });

  it('returns an empty mask without lamps', () => {
    const view = viewFor(hole, 360, 270);
    expect(bakeLightMask(bakeTerrain(hole, view, 360, 270), view, []).every((v) => v === 0)).toBe(true);
  });
});
