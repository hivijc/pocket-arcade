import { describe, expect, it } from 'vitest';
import { DRAG_DEAD_ZONE_PX, DRAG_MAX_PX, dragShot } from '../../src/game/drag';
import { project, type View } from '../../src/render/iso';

const VIEW: View = { ox: 180, oy: 60 };
const BALL = { x: 2, y: 3, z: 0 };

/** Grid angle of the screen-space direction (dx, dy) as seen from the ball. */
function gridAngleOf(dx: number, dy: number): number {
  const [bx, by] = project(VIEW, BALL.x, BALL.y, BALL.z);
  // Probe one grid unit along x and along y to invert the iso projection.
  const [ax, ay] = project(VIEW, BALL.x + 1, BALL.y, BALL.z);
  const [cx, cy] = project(VIEW, BALL.x, BALL.y + 1, BALL.z);
  const ux = [ax - bx, ay - by], uy = [cx - bx, cy - by];
  const det = ux[0] * uy[1] - uy[0] * ux[1];
  const gx = (dx * uy[1] - uy[0] * dy) / det;
  const gy = (ux[0] * dy - dx * ux[1]) / det;
  return Math.atan2(gy, gx);
}

describe('dragShot', () => {
  it('returns null inside the dead zone', () => {
    expect(dragShot([100, 100], [100, 100], VIEW, BALL)).toBeNull();
    expect(dragShot([100, 100], [100 + DRAG_DEAD_ZONE_PX - 1, 100], VIEW, BALL)).toBeNull();
  });

  it('aims opposite the drag (pull back to shoot forward)', () => {
    // Drag left on screen: the shot goes right on screen.
    const left = dragShot([200, 200], [120, 200], VIEW, BALL)!;
    expect(left.angle).toBeCloseTo(gridAngleOf(1, 0));
    // Drag down on screen: the shot goes up on screen.
    const down = dragShot([200, 200], [200, 290], VIEW, BALL)!;
    expect(down.angle).toBeCloseTo(gridAngleOf(0, -1));
  });

  it('pulling back along screen down-left aims along grid +x', () => {
    // Grid +x projects to screen (+2, +1); pulling the opposite way shoots along it.
    const s = dragShot([200, 200], [200 - 80, 200 - 40], VIEW, BALL)!;
    expect(s.angle).toBeCloseTo(0);
  });

  it('power grows with distance from the dead zone to the cap', () => {
    const mid = (DRAG_DEAD_ZONE_PX + DRAG_MAX_PX) / 2;
    expect(dragShot([0, 0], [0, mid], VIEW, BALL)!.power).toBeCloseTo(0.5);
    expect(dragShot([0, 0], [0, DRAG_MAX_PX], VIEW, BALL)!.power).toBeCloseTo(1);
    expect(dragShot([0, 0], [DRAG_DEAD_ZONE_PX, 0], VIEW, BALL)!.power).toBe(0);
  });

  it('caps power at 1 beyond the maximum drag', () => {
    expect(dragShot([0, 0], [0, DRAG_MAX_PX * 3], VIEW, BALL)!.power).toBe(1);
  });

  it('the angle does not depend on where the drag starts', () => {
    const a = dragShot([10, 10], [60, 30], VIEW, BALL)!;
    const b = dragShot([300, 500], [350, 520], VIEW, BALL)!;
    expect(a.angle).toBeCloseTo(b.angle);
    expect(a.power).toBeCloseTo(b.power);
  });
});
