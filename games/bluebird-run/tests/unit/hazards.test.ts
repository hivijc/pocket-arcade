import { describe, expect, it } from 'vitest';
import { hitHazard, hitsRider, pathLength, pointAlong, riderPos, wakes } from '../../src/sim/hazards';
import type { Hazard, OtherRider } from '../../src/world/slope';

const hazards: Hazard[] = [
  { kind: 'pine', at: [4, 20] },
  { kind: 'rock-s', at: [8, 30] },
  { kind: 'rock-l', at: [10, 40] },
  { kind: 'snowman', at: [6, 50] },
];

describe('hitHazard', () => {
  it('finds an overlap between the rider and a footprint', () => {
    expect(hitHazard(hazards, 4.5, 20.2, 0)).toBe(0);
    expect(hitHazard(hazards, 5.2, 20, 0)).toBe(-1);
  });
  it('lets an ollie clear a small rock but not a big one', () => {
    expect(hitHazard(hazards, 8, 30, 0.2)).toBe(1);
    expect(hitHazard(hazards, 8, 30, 0.4)).toBe(-1);
    expect(hitHazard(hazards, 10, 40, 0.5)).toBe(2);
    expect(hitHazard(hazards, 10, 40, 0.7)).toBe(-1);
  });
  it('lets a high kicker jump clear a snowman, and skips burst ones', () => {
    expect(hitHazard(hazards, 6, 50, 0.9)).toBe(3);
    expect(hitHazard(hazards, 6, 50, 1.1)).toBe(-1);
    expect(hitHazard(hazards, 6, 50, 0, [3])).toBe(-1);
  });
});

describe('other riders', () => {
  const r: OtherRider = { look: 'skier-red', speed: 2, path: [[8, 100], [8, 110], [4, 113]] };
  it('measures and walks a path', () => {
    expect(pathLength(r.path)).toBeCloseTo(15);
    expect(pointAlong(r.path, 0)).toEqual({ c: 8, d: 100 });
    expect(pointAlong(r.path, 5)).toEqual({ c: 8, d: 105 });
    expect(pointAlong(r.path, 12.5)).toEqual({ c: 6, d: 111.5 });
    expect(pointAlong(r.path, 15.1)).toBeNull();
  });
  it('wakes when the player comes within 30 tiles above its start', () => {
    expect(wakes(r, 69)).toBe(false);
    expect(wakes(r, 70)).toBe(true);
  });
  it('moves along its path from the moment it woke', () => {
    expect(riderPos(r, null, 50)).toBeNull();
    expect(riderPos(r, 10, 12.5)).toEqual({ c: 8, d: 105 });
  });
  it('crashes the player on touch unless they are high enough', () => {
    const at = [{ c: 8, d: 105 }, null];
    expect(hitsRider(at, 8.4, 105.2, 0)).toBe(true);
    expect(hitsRider(at, 9, 105, 0)).toBe(false);
    expect(hitsRider(at, 8, 105, 1.3)).toBe(false);
  });
});
