import { describe, expect, it } from 'vitest';
import { BIKE_ANCHOR, cameraTarget, followCamera, snapCamera, viewOf } from '../../src/render/camera';
import { streetPx } from '../../src/render/iso';

describe('camera', () => {
  it('puts the road middle at the bike anchor in the buffer', () => {
    expect(streetPx(viewOf(cameraTarget(140, 50)), 140, 7, 50)).toEqual([...BIKE_ANCHOR]);
  });
  it('moves up-right as the bike rides forward', () => {
    const a = cameraTarget(140, 50);
    const b = cameraTarget(140, 51);
    expect(b.x).toBeGreaterThan(a.x);
    expect(b.y).toBeLessThan(a.y);
  });
  it('eases toward the target and converges', () => {
    const step = followCamera({ x: 0, y: 0 }, { x: 100, y: -50 }, 1 / 60);
    expect(step.x).toBeGreaterThan(0);
    expect(step.x).toBeLessThan(100);
    let cam = { x: 0, y: 0 };
    for (let i = 0; i < 300; i++) cam = followCamera(cam, { x: 100, y: -50 }, 1 / 60);
    expect(cam.x).toBeCloseTo(100, 3);
    expect(cam.y).toBeCloseTo(-50, 3);
    expect(followCamera({ x: 3, y: 4 }, { x: 100, y: 0 }, 0)).toEqual({ x: 3, y: 4 });
  });
  it('snaps to whole pixels', () => {
    expect(snapCamera({ x: 10.4, y: -3.6 })).toEqual({ x: 10, y: -4 });
  });
});
