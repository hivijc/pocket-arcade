import { describe, expect, it } from 'vitest';
import { ORIGIN, streetPx } from '../../src/render/iso';
import { bakeChunk, chunkBounds, chunkCount, chunkRange, groundAt, ownerChunk, pixelKind, type ChunkBake } from '../../src/render/street-bake';

const px = (length: number, c: number, s: number, z = 0) => streetPx(ORIGIN, length, c, s, z);
const painted = (b: ChunkBake, wx: number, wy: number): number => {
  const x = wx - b.x, y = wy - b.y;
  if (x < 0 || y < 0 || x >= b.width || y >= b.height) return 0;
  return b.frames[0][(y * b.width + x) * 4 + 3] === 255 ? 1 : 0;
};

describe('groundAt', () => {
  it.each([
    [2, 10, 'lawn'], [4.5, 10, 'walk'], [5, 10, 'kerb'], [6, 10, 'road'], [7, 10.5, 'dash'], [7, 11.5, 'road'],
    [9, 10, 'kerb'], [9.5, 10, 'walk'], [12, 10, 'lawn'],
  ])('c %s, s %s is %s', (c, s, kind) => {
    expect(groundAt(100, c, s)).toBe(kind);
  });
  it('is null off the street', () => {
    expect(groundAt(100, -1, 10)).toBeNull();
    expect(groundAt(100, 14, 10)).toBeNull();
    expect(groundAt(100, 7, 100)).toBeNull();
    expect(groundAt(100, 7, -0.1)).toBeNull();
  });
});

describe('pixelKind', () => {
  it('reads the top surface under a pixel', () => {
    const [x, y] = px(100, 6, 10);
    expect(pixelKind(100, x, y)?.kind).toBe('road');
  });
  it('finds the right-hand earth side below the c = 14 edge', () => {
    const [x, y] = px(100, 14, 50, -0.25);
    expect(pixelKind(100, x, y)?.kind).toBe('sideR');
  });
  it('finds the near-end earth side below s = 0', () => {
    const [x, y] = px(100, 7, 0, -0.25);
    expect(pixelKind(100, x, y)?.kind).toBe('sideL');
  });
  it('is empty sky off the street', () => {
    const [x, y] = px(100, -3, 50);
    expect(pixelKind(100, x, y)).toBeNull();
  });
});

describe('chunks', () => {
  it('splits the street into 16-tile chunks', () => {
    expect(chunkCount(140)).toBe(9);
    expect(chunkRange(140, 0)).toEqual([0, 16]);
    expect(chunkRange(140, 8)).toEqual([128, 140]);
  });
  it('owns each pixel by its s, clamped to the street', () => {
    expect(ownerChunk(100, ...px(100, 7, 17))).toBe(1);
    expect(ownerChunk(100, ...px(100, 7, -3))).toBe(0);
    expect(ownerChunk(100, ...px(100, 7, 120))).toBe(6);
  });
  it('bakes two wind frames sized to its bounds', () => {
    const b = bakeChunk(40, 1);
    const r = chunkBounds(40, 1);
    expect([b.x, b.y, b.width, b.height]).toEqual([r.x, r.y, r.width, r.height]);
    expect(b.frames).toHaveLength(2);
    expect(b.frames[0]).toHaveLength(r.width * r.height * 4);
  });
  it('paints only the pixels it owns', () => {
    const b = bakeChunk(40, 1);
    const [ix, iy] = px(40, 6, 20).map(Math.floor);
    const [ox, oy] = px(40, 6, 33).map(Math.floor);
    expect(painted(b, ix, iy)).toBe(1);
    expect(painted(b, ox, oy)).toBe(0);
  });
  it('tiles seamlessly: each street pixel near a seam is painted by exactly one chunk', () => {
    const a = bakeChunk(40, 0);
    const b = bakeChunk(40, 1);
    for (const c of [0.5, 3, 4.5, 7, 9.5, 13]) {
      for (const s of [15.6, 15.9, 16.1, 16.4]) {
        const [wx, wy] = px(40, c, s).map(Math.floor);
        expect(painted(a, wx, wy) + painted(b, wx, wy), `c ${c} s ${s}`).toBe(1);
      }
    }
  });
});
