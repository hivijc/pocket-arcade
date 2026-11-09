import { describe, expect, it } from 'vitest';
import mapleLane from '../../src/world/streets/maple-lane.json';
import { inRect, lotOriginC, parseStreet, StreetError } from '../../src/world/street';
import { rawStreet } from '../helpers/make-street';

const lot = (o: Record<string, unknown>) => ({ side: 'L', s: 5, house: 'house-a', subscriber: true, porch: [1.5, 3, 2, 4], mailbox: [3.6, 5], ...o });

describe('parseStreet', () => {
  it('parses a valid street and makes lot geometry absolute', () => {
    const st = parseStreet(rawStreet());
    expect(st.name).toBe('Test Lane');
    expect(st.length).toBe(40);
    expect(st.lots[0]).toMatchObject({ index: 0, side: 'L', porch: { c0: 1.5, s0: 8, c1: 3.5, s1: 12 }, mailbox: [3.6, 10] });
    expect(st.lots[1]).toMatchObject({ index: 1, side: 'R', porch: { c0: 10.5, s0: 8, c1: 12.5, s1: 12 }, mailbox: [10.4, 10] });
    expect(st.dogHome).toEqual([12, 30]);
    expect(st.hazards).toEqual([]);
    expect(st.bundles).toEqual([[7, 25]]);
    expect(st.props).toEqual([{ kind: 'tree', at: [0.6, 20] }]);
  });
  it('parses cars, puddles and sprinklers', () => {
    const st = parseStreet(rawStreet({
      hazards: [
        { kind: 'car', at: [5.6, 20] },
        { kind: 'puddle', at: [7, 22] },
        { kind: 'sprinkler', at: [2, 30], spray: [3.5, 28, 5.5, 33] },
        { kind: 'dog', home: [12, 30] },
      ],
    }));
    expect(st.hazards).toEqual([
      { kind: 'car', at: [5.6, 20] },
      { kind: 'puddle', at: [7, 22] },
      { kind: 'sprinkler', at: [2, 30], spray: { c0: 3.5, s0: 28, c1: 5.5, s1: 33 } },
    ]);
  });
  it.each([
    ['not an object', 42, /must be an object/],
    ['no name', rawStreet({ name: '' }), /name/],
    ['too short', rawStreet({ length: 5 }), /length/],
    ['bad side', rawStreet({ lots: [lot({ side: 'X' })] }), /lots\[0\]\.side/],
    ['lot past the end', rawStreet({ lots: [lot({ s: 35 })] }), /lots\[0\]\.s/],
    ['bad house name', rawStreet({ lots: [lot({ house: 'House A' })] }), /lots\[0\]\.house/],
    ['porch outside the lot', rawStreet({ lots: [lot({ porch: [3, 3, 2, 4] })] }), /lots\[0\]\.porch/],
    ['mailbox outside the lot', rawStreet({ lots: [lot({ mailbox: [5, 5] })] }), /lots\[0\]\.mailbox/],
    ['overlapping lots', rawStreet({ lots: [lot({}), lot({ s: 10 })] }), /lots 0 and 1 overlap/],
    ['unknown hazard', rawStreet({ hazards: [{ kind: 'ufo', at: [1, 1] }, { kind: 'dog', home: [12, 30] }] }), /hazards\[0\]\.kind/],
    ['no dog', rawStreet({ hazards: [] }), /exactly one dog \(found 0\)/],
    ['two dogs', rawStreet({ hazards: [{ kind: 'dog', home: [12, 30] }, { kind: 'dog', home: [12, 20] }] }), /exactly one dog \(found 2\)/],
    ['spray off the street', rawStreet({ hazards: [{ kind: 'sprinkler', at: [2, 30], spray: [-5, 28, 5, 33] }, { kind: 'dog', home: [12, 30] }] }), /hazards\[0\]\.spray is outside the street/],
    ['bundle off the street', rawStreet({ bundles: [[20, 5]] }), /bundles\[0\].*outside the street/],
  ])('rejects %s', (_label, raw, message) => {
    expect(() => parseStreet(raw)).toThrow(StreetError);
    expect(() => parseStreet(raw)).toThrow(message);
  });
});

describe('helpers', () => {
  it('puts lot origins at the outer lawn edges', () => {
    expect(lotOriginC('L')).toBe(0);
    expect(lotOriginC('R')).toBe(10);
  });
  it('tests rectangles inclusively', () => {
    const r = { c0: 1, s0: 2, c1: 3, s1: 4 };
    expect(inRect(r, 1, 2)).toBe(true);
    expect(inRect(r, 3, 4)).toBe(true);
    expect(inRect(r, 3.1, 3)).toBe(false);
  });
});

describe('Maple Lane', () => {
  it('is a valid 140-tile street with 24 houses, 16 of them subscribers', () => {
    const st = parseStreet(mapleLane);
    expect(st.length).toBe(140);
    expect(st.lots).toHaveLength(24);
    expect(st.lots.filter((l) => l.subscriber)).toHaveLength(16);
  });
});
