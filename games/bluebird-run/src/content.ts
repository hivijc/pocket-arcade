import manifestJson from '../assets/manifest.json';
import paletteJson from '../assets/palette.json';
import { loadImageOrNull, loadSprites, spriteUrl } from './render/assets';
import { createPalette, type Palette } from './render/palette';
import { parseManifest, type Manifest } from './world/manifest';
import { parseRider, type RiderLayout } from './world/rider';
import { parseSlope, type Slope } from './world/slope';
import slopeJson from './world/slopes/pinecone-bowl.json';

export const BUF_W = 360;
export const BUF_H = 270;

/** Written by the ingest script; while it is missing, the renderer draws a placeholder rider. */
const RIDER_JSON = import.meta.glob('../assets/rider.json', { eager: true, import: 'default' }) as Record<string, unknown>;

export interface Rider {
  readonly layout: RiderLayout;
  readonly image: HTMLImageElement;
}

export interface Content {
  readonly slope: Slope;
  readonly manifest: Manifest;
  readonly palette: Palette;
  readonly sprites: ReadonlyMap<string, HTMLImageElement>;
  /** null → the renderer draws a placeholder rider. */
  readonly rider: Rider | null;
}

async function loadRider(): Promise<Rider | null> {
  const raw = RIDER_JSON['../assets/rider.json'];
  if (raw === undefined) return null;
  const layout = parseRider(raw);
  const url = spriteUrl(layout.src);
  if (!url) {
    console.warn(`rider: assets/sprites/${layout.src} is missing; drawing the placeholder rider`);
    return null;
  }
  const image = await loadImageOrNull(url, 'rider');
  return image ? { layout, image } : null;
}

export async function loadContent(): Promise<Content> {
  const manifest = parseManifest(manifestJson);
  const [sprites, rider] = await Promise.all([loadSprites(manifest), loadRider()]);
  return { slope: parseSlope(slopeJson), manifest, palette: createPalette(paletteJson), sprites, rider };
}
