import { describe, expect, it } from 'vitest';
import { CENTER_DROP, depthOf, project, sortByDepth, unproject, viewFor } from '../../src/render/iso';
import { makeHole } from '../helpers/makeHole';

describe('iso projection', () => {
  const view = { ox: 100, oy: 50 };

  it('maps the grid origin to the view origin', () => {
    expect(project(view, 0, 0, 0)).toEqual([100, 50]);
  });

  it('moves right-down for +x and left-down for +y, up for +z', () => {
    expect(project(view, 1, 0, 0)).toEqual([116, 58]);
    expect(project(view, 0, 1, 0)).toEqual([84, 58]);
    expect(project(view, 0, 0, 1)).toEqual([100, 34]);
  });

  it('unproject undoes project at a given height', () => {
    const [sx, sy] = project(view, 3.25, 1.5, 0.5);
    const [x, y] = unproject(view, sx, sy, 0.5);
    expect(x).toBeCloseTo(3.25);
    expect(y).toBeCloseTo(1.5);
  });

  it('centres a hole in the buffer', () => {
    const hole = makeHole({ width: 12, depth: 8, tee: [1.5, 2.5], cup: [10.5, 2.5] });
    const v = viewFor(hole, 360, 270);
    expect(project(v, 6, 4, 0)).toEqual([180, 135 + CENTER_DROP]);
  });

  it('sorts by depth, back to front', () => {
    const items = [{ depth: depthOf(5, 5) }, { depth: depthOf(1, 1) }, { depth: depthOf(5, 4) }];
    expect(sortByDepth(items).map((i) => i.depth)).toEqual([2, 9, 10]);
    expect(items[0].depth).toBe(10); // input untouched
  });
});
