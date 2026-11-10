import type { Camera } from './camera';
import { chunkBounds, chunkCount } from './slope-bake';

/** Indices of chunks overlapping the camera's buffer, far (high d) first. */
export function visibleChunks(length: number, cam: Camera, width: number, height: number): number[] {
  const out: number[] = [];
  for (let i = chunkCount(length) - 1; i >= 0; i--) {
    const b = chunkBounds(length, i);
    if (b.x < cam.x + width && b.x + b.width > cam.x && b.y < cam.y + height && b.y + b.height > cam.y) out.push(i);
  }
  return out;
}

export interface ChunkCache<T> {
  get(index: number): T;
  /** Drop every cached chunk not listed. */
  keepOnly(keep: readonly number[]): void;
  readonly size: number;
}

export function createChunkCache<T>(bake: (index: number) => T): ChunkCache<T> {
  const cache = new Map<number, T>(); // a cache: mutated on purpose
  return {
    get(index) {
      const hit = cache.get(index);
      if (hit !== undefined) return hit;
      const baked = bake(index);
      cache.set(index, baked);
      return baked;
    },
    keepOnly(keep) {
      for (const k of [...cache.keys()]) if (!keep.includes(k)) cache.delete(k);
    },
    get size() {
      return cache.size;
    },
  };
}
