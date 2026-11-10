import type { Manifest } from '../world/manifest';
import type { ChunkBake } from './slope-bake';

/** One canvas per wind frame of a baked chunk. */
export function bakeToCanvases(bake: ChunkBake): HTMLCanvasElement[] {
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

/** Where sprite files come from; injectable so the fallbacks can be tested without a browser. */
export interface SpriteIo {
  readonly urlFor: (file: string) => string | undefined;
  readonly load: (url: string) => Promise<HTMLImageElement>;
}

const BROWSER_IO: SpriteIo = { urlFor: spriteUrl, load: loadImage };

/** Loads an image, or warns (naming `what`) and resolves null if it cannot be decoded. */
export async function loadImageOrNull(url: string, what: string, load: SpriteIo['load'] = loadImage): Promise<HTMLImageElement | null> {
  try {
    return await load(url);
  } catch (err) {
    console.warn(`${what}: ${err instanceof Error ? err.message : String(err)}; drawing its placeholder`);
    return null;
  }
}

async function loadSprite(name: string, file: string, io: SpriteIo): Promise<readonly [string, HTMLImageElement] | null> {
  const url = io.urlFor(file);
  if (!url) {
    console.warn(`manifest: ${name}.image file assets/sprites/${file} is missing; drawing its placeholder`);
    return null;
  }
  const img = await loadImageOrNull(url, `manifest: ${name}.image`, io.load);
  return img ? ([name, img] as const) : null;
}

/** Loads every manifest sprite that has an image. A listed image that is missing or will not decode warns and falls back to its placeholder. */
export async function loadSprites(manifest: Manifest, io: SpriteIo = BROWSER_IO): Promise<Map<string, HTMLImageElement>> {
  const loaded = await Promise.all(Object.entries(manifest).flatMap(([name, def]) => (def.image ? [loadSprite(name, def.image.src, io)] : [])));
  return new Map(loaded.flatMap((e) => (e ? [e] : [])));
}
