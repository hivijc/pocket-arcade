import type { Vec2 } from '../core/geometry';
import { project, unproject, type View } from '../render/iso';

/** Drags shorter than this (CSS pixels) are a cancel, not a shot. */
export const DRAG_DEAD_ZONE_PX = 14;
/** Drag length (CSS pixels) that gives full power. */
export const DRAG_MAX_PX = 150;

export interface DragShot {
  /** Grid-space aim angle in radians. */
  readonly angle: number;
  /** 0..1 */
  readonly power: number;
}

interface BallAt {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * Slingshot mapping: a drag from `start` to `current` (client pixels) aims the ball the opposite way on screen,
 * with power rising from 0 at the dead zone to 1 at DRAG_MAX_PX. Returns null inside the dead zone.
 */
export function dragShot(start: Vec2, current: Vec2, view: View, ball: BallAt): DragShot | null {
  const dx = current[0] - start[0];
  const dy = current[1] - start[1];
  const dist = Math.hypot(dx, dy);
  if (dist < DRAG_DEAD_ZONE_PX) return null;
  // The canvas is scaled uniformly, so a client-pixel direction is also a buffer-pixel direction.
  const [bx, by] = project(view, ball.x, ball.y, ball.z);
  const [tx, ty] = unproject(view, bx - dx / dist, by - dy / dist, ball.z);
  const power = Math.min(1, (dist - DRAG_DEAD_ZONE_PX) / (DRAG_MAX_PX - DRAG_DEAD_ZONE_PX));
  return { angle: Math.atan2(ty - ball.y, tx - ball.x), power };
}
