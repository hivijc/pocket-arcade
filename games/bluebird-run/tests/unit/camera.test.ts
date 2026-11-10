import { describe, expect, it } from 'vitest';
import { cameraTarget, followCamera, RIDER_ANCHOR, snapCamera, viewOf } from '../../src/render/camera';
import { slopePx } from '../../src/render/iso';

describe('camera', () => {
  it('puts a centred rider at the anchor', () => {
    const cam = cameraTarget(8, 50);
    expect(slopePx(viewOf(cam), 8, 50)).toEqual([RIDER_ANCHOR[0], RIDER_ANCHOR[1]]);
  });
  it("follows across at half rate, so carving doesn't swing the view", () => {
    const a = cameraTarget(8, 50);
    const b = cameraTarget(12, 50);
    const [x0] = slopePx(viewOf(a), 12, 50);
    const [x1] = slopePx(viewOf(b), 12, 50);
    expect(x0 - x1).toBeCloseTo(32); // 4 tiles across = 64 px, half followed
  });
  it('eases toward the target and snaps to whole pixels', () => {
    const c = followCamera({ x: 0, y: 0 }, { x: 100, y: 50 }, 0.1);
    expect(c.x).toBeGreaterThan(0);
    expect(c.x).toBeLessThan(100);
    expect(snapCamera({ x: 1.6, y: -2.4 })).toEqual({ x: 2, y: -2 });
  });
});
