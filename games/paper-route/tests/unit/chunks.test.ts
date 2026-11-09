import { describe, expect, it, vi } from 'vitest';
import { cameraTarget, snapCamera } from '../../src/render/camera';
import { createChunkCache, visibleChunks } from '../../src/render/chunks';

describe('visibleChunks', () => {
  it('sees the first chunks at the start, far chunks first', () => {
    const v = visibleChunks(140, snapCamera(cameraTarget(140, 2)), 360, 270);
    expect(v).toContain(0);
    expect(v).not.toContain(8);
    expect([...v].sort((a, b) => b - a)).toEqual(v);
  });
  it('follows the bike down the street', () => {
    const v = visibleChunks(140, snapCamera(cameraTarget(140, 100)), 360, 270);
    expect(v).toContain(6);
    expect(v).not.toContain(0);
  });
});

describe('createChunkCache', () => {
  it('bakes each chunk once until it is evicted', () => {
    const bake = vi.fn((i: number) => `chunk ${i}`);
    const cache = createChunkCache(bake);
    expect(cache.get(1)).toBe('chunk 1');
    expect(cache.get(1)).toBe('chunk 1');
    expect(bake).toHaveBeenCalledTimes(1);
    cache.get(2);
    cache.keepOnly([2]);
    expect(cache.size).toBe(1);
    cache.get(1);
    expect(bake).toHaveBeenCalledTimes(3);
  });
});
