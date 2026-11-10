import { describe, expect, it } from 'vitest';
import { ollie } from '../../src/sim/air';
import { crash, newBoard } from '../../src/sim/board';
import { animFor, dirFor, DIRS, parseRider, RiderError, rowsFor } from '../../src/world/rider';

const rows = Object.fromEntries(DIRS.map((d, i) => [d, i]));
const raw = { src: 'rider.png', cell: [48, 48], anchor: [24, 44], fps: 10, anims: { ride: { frames: 4, rows }, grab: { frames: 1, rows } } };

describe('parseRider', () => {
  it('parses a layout and falls back to ride for missing animations', () => {
    const l = parseRider(raw);
    expect(l.cell).toEqual([48, 48]);
    expect(rowsFor(l, 'grab').frames).toBe(1);
    expect(rowsFor(l, 'tumble')).toBe(l.anims.ride);
  });
  it.each([
    ['no src', { ...raw, src: 'x.gif' }, /src/],
    ['no ride', { ...raw, anims: {} }, /anims\.ride/],
    ['a missing row', { ...raw, anims: { ride: { frames: 1, rows: { south: 0 } } } }, /rows\.south-west/],
    ['a bad cell', { ...raw, cell: [0, 4] }, /cell/],
  ])('rejects %s', (_l, bad, msg) => {
    expect(() => parseRider(bad)).toThrow(RiderError);
    expect(() => parseRider(bad)).toThrow(msg);
  });
});

describe('dirFor', () => {
  it.each([[0, 'south-east'], [45, 'east'], [75, 'north-east'], [-45, 'south'], [-75, 'south-west'], [180, 'north-west'], [-180, 'north-west'], [360, 'south-east']])(
    'facing %s° → %s', (deg, dir) => {
      expect(dirFor(deg)).toBe(dir);
    },
  );
});

describe('animFor', () => {
  it('picks ride, air, grab or tumble', () => {
    const b = { ...newBoard(8, 10), speed: 5 };
    expect(animFor(b)).toBe('ride');
    const up = ollie(b);
    expect(animFor(up)).toBe('air');
    expect(animFor({ ...up, air: { ...up.air!, grabbing: true } })).toBe('grab');
    expect(animFor(crash(b))).toBe('tumble');
  });
});
