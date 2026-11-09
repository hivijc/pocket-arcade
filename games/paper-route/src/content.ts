import manifestJson from '../assets/manifest.json';
import paletteJson from '../assets/palette.json';
import { loadImageOrNull, loadSprites, spriteUrl } from './render/assets';
import { createPalette, type Palette } from './render/palette';
import { parseManifest, type Manifest } from './world/manifest';
import { parseRider, type RiderLayout } from './world/rider';
import { parseStreet, type Street } from './world/street';
import streetJson from './world/streets/maple-lane.json';

export const BUF_W = 360;
export const BUF_H = 270;

/** Written by the ingest script; if it is ever missing, the renderer draws a placeholder rider. */
const RIDER_JSON = import.meta.glob('../assets/rider.json', { eager: true, import: 'default' }) as Record<string, unknown>;

export interface Rider {
  readonly layout: RiderLayout;
  readonly image: HTMLImageElement;
}

export interface Content {
  readonly street: Street;
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
  return { street: parseStreet(streetJson), manifest, palette: createPalette(paletteJson), sprites, rider };
}
