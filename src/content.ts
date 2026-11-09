import manifestJson from '../assets/manifest.json';
import paletteJson from '../assets/palette.json';
import hole1 from './world/holes/01.json';
import hole2 from './world/holes/02.json';
import hole3 from './world/holes/03.json';
import { bakeToCanvases, loadImage, loadSprites, spriteUrl } from './render/assets';
import { viewFor, type View } from './render/iso';
import { bakeLightMask, lampsOf } from './render/lights';
import { createPalette, type Palette } from './render/palette';
import { bakeTerrain } from './render/terrain-bake';
import { parseGolfer, type GolferLayout } from './world/golfer';
import { parseHole, type Hole } from './world/hole';
import { parseManifest, type Manifest } from './world/manifest';

export const BUF_W = 360;
export const BUF_H = 270;

const GOLFER_JSON = import.meta.glob('../assets/golfer.json', { eager: true, import: 'default' }) as Record<string, unknown>;

export interface HoleContent {
  readonly hole: Hole;
  readonly view: View;
  /** One canvas per wind frame. */
  readonly terrain: readonly HTMLCanvasElement[];
  readonly light: Uint8Array;
}

export interface GolferArt {
  readonly layout: GolferLayout;
  readonly image: HTMLImageElement;
}

export interface Content {
  readonly manifest: Manifest;
  readonly palette: Palette;
  readonly holes: readonly Hole[];
  readonly perHole: readonly HoleContent[];
  readonly sprites: ReadonlyMap<string, HTMLImageElement>;
  readonly golfer: GolferArt | null;
}

async function loadGolfer(): Promise<GolferArt | null> {
  const raw = Object.values(GOLFER_JSON)[0];
  if (raw === undefined) return null; // no golfer art ingested yet: placeholder golfer
  const layout = parseGolfer(raw);
  const url = spriteUrl(layout.src);
  if (!url) throw new Error(`golfer: assets/sprites/${layout.src} is missing`);
  return { layout, image: await loadImage(url) };
}

export async function loadContent(): Promise<Content> {
  const manifest = parseManifest(manifestJson);
  const palette = createPalette(paletteJson);
  const holes = [hole1, hole2, hole3].map((raw, i) => parseHole(raw, manifest, `holes/0${i + 1}.json`));
  const perHole = holes.map((hole) => {
    const view = viewFor(hole, BUF_W, BUF_H);
    const bake = bakeTerrain(hole, view, BUF_W, BUF_H);
    return { hole, view, terrain: bakeToCanvases(bake), light: bakeLightMask(bake, view, lampsOf(hole, manifest)) };
  });
  const [sprites, golfer] = await Promise.all([loadSprites(manifest), loadGolfer()]);
  return { manifest, palette, holes, perHole, sprites, golfer };
}
