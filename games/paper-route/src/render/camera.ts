import { STRIPS } from '../world/street';
import { ORIGIN, streetPx, type View } from './iso';

/** World pixel at the buffer's top-left corner. */
export interface Camera {
  readonly x: number;
  readonly y: number;
}

/** Where the road under the bike sits in the 360×270 buffer: lower left, so the street ahead (up-right) is in view. */
export const BIKE_ANCHOR = [120, 185] as const;
const ROAD_MID = (STRIPS.road[0] + STRIPS.road[1]) / 2;
const FOLLOW_RATE = 8;

/** The camera follows the bike's s only, so drifting across the road doesn't shake the view. */
export function cameraTarget(length: number, s: number): Camera {
  const [px, py] = streetPx(ORIGIN, length, ROAD_MID, s);
  return { x: px - BIKE_ANCHOR[0], y: py - BIKE_ANCHOR[1] };
}

export function followCamera(cam: Camera, target: Camera, dt: number, rate = FOLLOW_RATE): Camera {
  const k = 1 - Math.exp(-rate * Math.max(0, dt));
  return { x: cam.x + (target.x - cam.x) * k, y: cam.y + (target.y - cam.y) * k };
}

export const snapCamera = (cam: Camera): Camera => ({ x: Math.round(cam.x), y: Math.round(cam.y) });

export const viewOf = (cam: Camera): View => ({ ox: -cam.x, oy: -cam.y });
