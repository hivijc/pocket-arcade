import { describe, expect, it, vi } from 'vitest';
import { cameraTarget, snapCamera } from '../../src/render/camera';
import { createChunkCache, visibleChunks } from '../../src/render/chunks';

describe('chunk cache', () => {
  it('lists the chunks around the rider, far first', () => {
    const v = visibleChunks(360, snapCamera(cameraTarget(8, 100)), 360, 270);
    expect(v.length).toBeGreaterThan(0);
    expect(v).toContain(6);
    expect([...v].sort((a, b) => b - a)).toEqual(v);
  });
  it('bakes once and evicts what is not kept', () => {
    const bake = vi.fn((i: number) => i * 10);
    const cache = createChunkCache(bake);
    expect(cache.get(2)).toBe(20);
    cache.get(2);
    expect(bake).toHaveBeenCalledTimes(1);
    cache.get(3);
    cache.keepOnly([3]);
    expect(cache.size).toBe(1);
  });
});
