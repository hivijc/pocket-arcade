import manifestJson from '../assets/manifest.json';
import paletteJson from '../assets/palette.json';
import { loadImage, loadSprites, spriteUrl } from './render/assets';
import { createPalette, type Palette } from './render/palette';
import { parseManifest, type Manifest } from './world/manifest';
import { parseRider, type RiderLayout } from './world/rider';
import { parseStreet, type Street } from './world/street';
import streetJson from './world/streets/maple-lane.json';

export const BUF_W = 360;
export const BUF_H = 270;

/** Present only once the rider art has been ingested (Task 17). */
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
  if (!url) throw new Error(`rider: assets/sprites/${layout.src} is missing`);
  return { layout, image: await loadImage(url) };
}

export async function loadContent(): Promise<Content> {
  const manifest = parseManifest(manifestJson);
  const [sprites, rider] = await Promise.all([loadSprites(manifest), loadRider()]);
  return { street: parseStreet(streetJson), manifest, palette: createPalette(paletteJson), sprites, rider };
}
