import { describe, expect, it } from 'vitest';
import { DIRS, parseRider, RiderError, riderDir } from '../../src/world/rider';

const rows = Object.fromEntries(DIRS.map((d, i) => [d, i]));

describe('parseRider', () => {
  it('parses a layout', () => {
    expect(parseRider({ src: 'rider.png', cell: [34, 36], anchor: [17, 35], frames: 6, fps: 10, rows })).toEqual({
      src: 'rider.png', cell: [34, 36], anchor: [17, 35], frames: 6, fps: 10, rows,
    });
  });
  it.each([
    ['a bad src', { src: 'x.gif', cell: [1, 1], anchor: [0, 0], frames: 1, fps: 1, rows }, /src/],
    ['a bad cell', { src: 'r.png', cell: [0, 1], anchor: [0, 0], frames: 1, fps: 1, rows }, /cell/],
    ['a missing row', { src: 'r.png', cell: [1, 1], anchor: [0, 0], frames: 1, fps: 1, rows: { south: 0 } }, /rows\./],
  ])('rejects %s', (_l, raw, msg) => {
    expect(() => parseRider(raw)).toThrow(RiderError);
    expect(() => parseRider(raw)).toThrow(msg);
  });
});

describe('riderDir', () => {
  it('faces up-right when riding straight and leans with the steering', () => {
    expect(riderDir(0)).toBe('north-east');
    expect(riderDir(-1)).toBe('north');
    expect(riderDir(1)).toBe('east');
  });
});
