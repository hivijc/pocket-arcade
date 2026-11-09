import type { Vec2 } from '../core/geometry';
import type { Hole } from '../world/hole';
import type { Manifest } from '../world/manifest';
import { unproject, type View } from './iso';
import type { TerrainBake } from './terrain-bake';

export interface Lamp {
  readonly at: Vec2;
  readonly radius: number;
}

/** Hard light bands, so pools read as pixel art rather than an airbrush. */
export function lightBand(dist: number, radius: number): number {
  if (dist < radius * 0.4) return 3;
  if (dist < radius * 0.7) return 2;
  if (dist < radius) return 1;
  return 0;
}

export function lampsOf(hole: Hole, manifest: Manifest): Lamp[] {
  return hole.props.flatMap((p) => {
    const light = manifest[p.sprite].light;
    return light ? [{ at: p.at, radius: light.radius }] : [];
  });
}

/** Light band (0..3) per buffer pixel, from the ground under it; 0 where there's no ground. */
export function bakeLightMask(bake: TerrainBake, view: View, lamps: readonly Lamp[]): Uint8Array {
  const mask = new Uint8Array(bake.width * bake.height);
  if (lamps.length === 0) return mask;
  for (let y = 0; y < bake.height; y++) {
    for (let x = 0; x < bake.width; x++) {
      const z = bake.ground[y * bake.width + x];
      if (Number.isNaN(z)) continue;
      const [gx, gy] = unproject(view, x + 0.5, y + 0.5, z);
      let band = 0;
      for (const l of lamps) band = Math.max(band, lightBand(Math.hypot(gx - l.at[0], gy - l.at[1]), l.radius));
      mask[y * bake.width + x] = band;
    }
  }
  return mask;
}
