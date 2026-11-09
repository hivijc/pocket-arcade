import { describe, expect, it } from 'vitest';
import { parseHole } from '../../src/world/hole';
import { TEST_MANIFEST, makeHole, rawHole } from '../helpers/makeHole';

const parse = (raw: unknown) => parseHole(raw, TEST_MANIFEST, 'test.json');

describe('parseHole: valid data', () => {
  it('loads a simple hole', () => {
    const h = makeHole({ width: 4, depth: 3, tee: [0.5, 1.5], cup: [3.5, 1.5], par: 2 });
    expect(h.name).toBe('Test');
    expect(h.par).toBe(2);
    expect([h.width, h.depth]).toEqual([4, 3]);
    expect(h.tee).toEqual([0.5, 1.5]);
    expect(h.cup).toEqual([3.5, 1.5]);
  });

  it('converts quarter-step heights to tiles', () => {
    const h = makeHole({ width: 2, depth: 1, tee: [0.5, 0.5], cup: [1.5, 0.5], heightOf: (x) => x * 2 });
    expect(h.heights).toEqual([[0, 0.5, 1], [0, 0.5, 1]]);
  });

  it('builds walls around the outside of a hole', () => {
    const h = makeHole({ width: 2, depth: 1, tee: [0.5, 0.5], cup: [1.5, 0.5] });
    expect(h.walls).toHaveLength(6);
  });

  it('builds walls between play tiles and X tiles', () => {
    const h = makeHole({ width: 2, depth: 2, rows: ['GG', 'GX'], tee: [0.5, 0.5], cup: [1.5, 0.5] });
    // 6 outer-boundary edges of the 3 play tiles + 2 edges facing the X tile = 8
    expect(h.walls).toHaveLength(8);
  });

  it('keeps explicit walls', () => {
    const h = makeHole({ walls: [[[5, 0], [5, 2]]] });
    expect(h.walls).toContainEqual({ a: [5, 0], b: [5, 2] });
  });

  it('turns circle footprints into circles and box footprints into 4 walls', () => {
    const plain = makeHole();
    const h = makeHole({ props: [{ sprite: 'post', at: [6, 2.5] }, { sprite: 'crate', at: [10, 2.5] }, { sprite: 'flower', at: [12, 1] }] });
    expect(h.circles).toEqual([{ c: [6, 2.5], r: 0.3 }]);
    expect(h.walls.length - plain.walls.length).toBe(4);
    expect(h.props).toHaveLength(3);
  });
});

describe('parseHole: invalid data', () => {
  const bad = (patch: Record<string, unknown>) => ({ ...rawHole(), ...patch });

  it('rejects a non-object', () => {
    expect(() => parse(null)).toThrow(/test\.json: must be an object/);
  });
  it('rejects a missing name', () => {
    expect(() => parse(bad({ name: '' }))).toThrow(/name must be a non-empty string/);
  });
  it('rejects par outside 1..5', () => {
    expect(() => parse(bad({ par: 7 }))).toThrow(/par must be an integer from 1 to 5/);
  });
  it('rejects a bad size', () => {
    expect(() => parse(bad({ size: [0, 5] }))).toThrow(/size must be \[width, depth\]/);
  });
  it('rejects the wrong number of surface rows', () => {
    expect(() => parse(bad({ surface: ['G'.repeat(20)] }))).toThrow(/surface must have 5 rows/);
  });
  it('rejects a surface row of the wrong length', () => {
    const rows = Array.from({ length: 5 }, () => 'G'.repeat(20));
    rows[2] = 'G'.repeat(19);
    expect(() => parse(bad({ surface: rows }))).toThrow(/surface row 2 must be a string of 20 letters/);
  });
  it('rejects an unknown surface letter', () => {
    const rows = Array.from({ length: 5 }, () => 'G'.repeat(20));
    rows[1] = 'GGQ' + 'G'.repeat(17);
    expect(() => parse(bad({ surface: rows }))).toThrow(/surface row 1 has unknown letter "Q"/);
  });
  it('rejects a height grid of the wrong size', () => {
    expect(() => parse(bad({ height: [[0]] }))).toThrow(/height must have 6 rows of corners/);
    const h = Array.from({ length: 6 }, () => Array(21).fill(0));
    h[3] = Array(20).fill(0);
    expect(() => parse(bad({ height: h }))).toThrow(/height row 3 must have 21 numbers/);
  });
  it('rejects a tee that is not on green', () => {
    const rows = Array.from({ length: 5 }, () => 'G'.repeat(20));
    rows[2] = 'GR' + 'G'.repeat(18);
    expect(() => parse(bad({ surface: rows }))).toThrow(/tee must be on a green \(G\) tile/);
  });
  it('rejects a cup outside the grid', () => {
    expect(() => parse(bad({ cup: [30, 1] }))).toThrow(/cup must be on a green \(G\) tile/);
  });
  it('rejects a malformed point', () => {
    expect(() => parse(bad({ tee: [1] }))).toThrow(/tee must be \[x, y\]/);
  });
  it('rejects an unknown sprite', () => {
    expect(() => parse(bad({ props: [{ sprite: 'unicorn', at: [3, 3] }] }))).toThrow(/props\[0\] uses unknown sprite "unicorn"/);
  });
  it('rejects a prop outside the grid', () => {
    expect(() => parse(bad({ props: [{ sprite: 'flower', at: [40, 3] }] }))).toThrow(/props\[0\]\.at is outside the grid/);
  });
  it('rejects a tee inside a prop footprint', () => {
    expect(() => parse(bad({ props: [{ sprite: 'post', at: [1.6, 2.5] }] }))).toThrow(/tee is inside a wall or prop/);
  });
  it('rejects a cup touching a wall', () => {
    expect(() => parse(bad({ cup: [18.5, 0.03] }))).toThrow(/cup is inside a wall or prop/);
  });
  it('rejects malformed walls', () => {
    expect(() => parse(bad({ walls: [[1, 2]] }))).toThrow(/walls\[0\] must be \[\[x, y\], \[x, y\]\]/);
  });
});
