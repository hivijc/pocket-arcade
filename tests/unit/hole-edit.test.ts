import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import manifestJson from '../../assets/manifest.json';
import {
  addProp, blankHole, bumpCorner, formatHole, nearestCorner, paintSurface, removePropNear, resizeHole, setCup, setTee, toHoleJson,
} from '../../src/world/hole-edit';
import { parseHole } from '../../src/world/hole';
import { parseManifest } from '../../src/world/manifest';

const manifest = parseManifest(manifestJson);

describe('blankHole', () => {
  it('is a valid flat green with tee and cup', () => {
    const h = parseHole(blankHole(10, 6), manifest, 'blank');
    expect([h.width, h.depth]).toEqual([10, 6]);
    expect(h.surface.every((r) => r === 'G'.repeat(10))).toBe(true);
  });
});

describe('edits', () => {
  const base = blankHole(6, 4);

  it('paints a tile without touching the original', () => {
    const next = paintSurface(base, 2, 1, 'W');
    expect(next.surface[1]).toBe('GGWGGG');
    expect(base.surface[1]).toBe('GGGGGG');
    expect(paintSurface(base, 9, 9, 'W')).toBe(base);
  });

  it('raises and lowers a corner in quarter steps, never below 0', () => {
    const up = bumpCorner(bumpCorner(base, 3, 2, 1), 3, 2, 1);
    expect(up.height[2][3]).toBe(2);
    expect(bumpCorner(base, 3, 2, -1).height[2][3]).toBe(0);
    expect(base.height[2][3]).toBe(0);
    expect(bumpCorner(base, 7, 7, 1)).toBe(base);
  });

  it('finds the corner nearest a grid point', () => {
    expect(nearestCorner(base, [2.4, 1.6])).toEqual([2, 2]);
    expect(nearestCorner(base, [-3, 9])).toEqual([0, 4]);
  });

  it('moves the tee and cup, rounded to a tenth', () => {
    expect(setTee(base, [1.234, 2.06]).tee).toEqual([1.2, 2.1]);
    expect(setCup(base, [4.55, 0.51]).cup).toEqual([4.6, 0.5]);
  });

  it('adds a prop and removes the nearest one in reach', () => {
    const one = addProp(base, 'gnome', [2.04, 2.0]);
    expect(one.props).toEqual([{ sprite: 'gnome', at: [2, 2] }]);
    expect(removePropNear(one, [2.3, 2.2], 0.5).props).toEqual([]);
    expect(removePropNear(one, [4, 3], 0.5)).toBe(one);
  });

  it('resizes, padding with flat green and keeping tee, cup and props inside', () => {
    const grown = resizeHole(paintSurface(base, 0, 0, 'S'), 8, 5);
    expect(grown.size).toEqual([8, 5]);
    expect(grown.surface[0]).toBe('SGGGGGGG');
    expect(grown.height).toHaveLength(6);
    expect(grown.height[0]).toHaveLength(9);
    const shrunk = resizeHole(addProp(base, 'gnome', [5.5, 3.5]), 3, 2);
    expect(shrunk.surface).toEqual(['GGG', 'GGG']);
    expect(shrunk.cup[0]).toBeLessThanOrEqual(3);
    expect(shrunk.props[0].at).toEqual([3, 2]);
  });
});

describe('toHoleJson', () => {
  it('accepts a hole file and copies it', () => {
    const raw = JSON.parse(readFileSync('src/world/holes/01.json', 'utf8'));
    const h = toHoleJson(raw);
    expect(h.name).toBe('Gnome Alley');
    expect(h.surface).not.toBe(raw.surface);
  });

  it('rejects something that is not a hole', () => {
    expect(() => toHoleJson({ name: 'x' })).toThrow(/size/);
    expect(() => toHoleJson(null)).toThrow();
  });
});

describe('formatHole', () => {
  it('writes the same layout as the hole files', () => {
    for (const f of ['01', '02', '03', '04', '05', '06', '07', '08', '09']) {
      const text = readFileSync(`src/world/holes/${f}.json`, 'utf8');
      expect(formatHole(toHoleJson(JSON.parse(text)))).toBe(text);
    }
  });

  it('writes an empty prop list on one line', () => {
    expect(formatHole(blankHole(3, 2))).toContain('"props": []');
  });

  it('includes walls when there are any', () => {
    const text = formatHole({ ...blankHole(4, 3), walls: [[[1, 0], [1, 2]]] });
    expect(JSON.parse(text).walls).toEqual([[[1, 0], [1, 2]]]);
  });
});
