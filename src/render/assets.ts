import type { Manifest } from '../world/manifest';
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

const SPRITE_URLS = import.meta.glob('../../assets/sprites/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

export function spriteUrl(file: string): string | undefined {
  return SPRITE_URLS[`../../assets/sprites/${file}`];
}

export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load image ${url}`));
    img.src = url;
  });
}

/** Loads every manifest sprite that has an image. A listed image with no file is an error. */
export async function loadSprites(manifest: Manifest): Promise<Map<string, HTMLImageElement>> {
  const entries = await Promise.all(Object.entries(manifest).flatMap(([name, def]) => {
    if (!def.image) return [];
    const url = spriteUrl(def.image.src);
    if (!url) throw new Error(`manifest: ${name}.image file assets/sprites/${def.image.src} is missing`);
    return [loadImage(url).then((img) => [name, img] as const)];
  }));
  return new Map(entries);
}
