import type { TerrainBake } from './terrain-bake';

/** One canvas per wind frame of a baked terrain. */
export function bakeToCanvases(bake: TerrainBake): HTMLCanvasElement[] {
  return bake.frames.map((pixels) => {
    const canvas = document.createElement('canvas');
    canvas.width = bake.width;
    canvas.height = bake.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas is not available');
    ctx.putImageData(new ImageData(new Uint8ClampedArray(pixels), bake.width, bake.height), 0, 0);
    return canvas;
  });
}
