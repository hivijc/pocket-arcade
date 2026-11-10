import { describe, expect, it } from 'vitest';
import { carveDepth, pushTrack, TRACK_MAX, trackPoint, trackSegments } from '../../src/render/tracks';
import { crash, newBoard } from '../../src/sim/board';
import { ollie } from '../../src/sim/air';

describe('carve tracks', () => {
  it('deepens with the carve', () => {
    expect(carveDepth(10)).toBe(0);
    expect(carveDepth(-75)).toBe(1);
    expect(carveDepth(47.5)).toBeCloseTo(0.5);
  });
  it('records a point on the snow and a gap in the air or a tumble', () => {
    const b = { ...newBoard(8, 10), heading: 75 };
    expect(trackPoint(b)).toEqual([8, 10, 1]);
    expect(trackPoint(ollie(b))).toBeNull();
    expect(trackPoint(crash(b))).toBeNull();
  });
  it('keeps the newest points and never stacks gaps', () => {
    let t = pushTrack([], [1, 1, 0]);
    t = pushTrack(t, null);
    t = pushTrack(t, null);
    expect(t).toEqual([[1, 1, 0], null]);
    const long = Array.from({ length: TRACK_MAX + 5 }, (_, i) => [8, i, 0] as const).reduce(pushTrack, [] as ReturnType<typeof pushTrack>);
    expect(long).toHaveLength(TRACK_MAX);
    expect(long[0]).toEqual([8, 5, 0]);
  });
  it('joins neighbouring points into segments across no gaps', () => {
    expect(trackSegments([[1, 1, 0], [1, 2, 0.5], null, [1, 4, 0], [1, 5, 1]])).toEqual([
      [[1, 1, 0], [1, 2, 0.5]],
      [[1, 4, 0], [1, 5, 1]],
    ]);
  });
});
