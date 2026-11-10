import { SLOPE } from '../sim/constants';
import { ORIGIN, slopePx, type View } from './iso';

/** World pixel at the buffer's top-left corner. */
export interface Camera {
  readonly x: number;
  readonly y: number;
}

/** Where the rider sits in the 360×270 buffer: upper left, so the slope below and ahead (↘) is in view. */
export const RIDER_ANCHOR = [128, 76] as const;
/** Share of the rider's across offset the camera follows: carving shouldn't swing the view. */
const ACROSS_FOLLOW = 0.5;
const FOLLOW_RATE = 6;

export function cameraTarget(c: number, d: number): Camera {
  const mid = SLOPE.width / 2;
  const [px, py] = slopePx(ORIGIN, mid + (c - mid) * ACROSS_FOLLOW, d);
  return { x: px - RIDER_ANCHOR[0], y: py - RIDER_ANCHOR[1] };
}

export function followCamera(cam: Camera, target: Camera, dt: number, rate = FOLLOW_RATE): Camera {
  const k = 1 - Math.exp(-rate * Math.max(0, dt));
  return { x: cam.x + (target.x - cam.x) * k, y: cam.y + (target.y - cam.y) * k };
}

export const snapCamera = (cam: Camera): Camera => ({ x: Math.round(cam.x), y: Math.round(cam.y) });

export const viewOf = (cam: Camera): View => ({ ox: -cam.x, oy: -cam.y });
