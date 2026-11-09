import manifestJson from '../assets/manifest.json';
import paletteJson from '../assets/palette.json';
import { bakeToCanvases, loadImage, loadSprites, spriteUrl } from './render/assets';
import { viewFor, type View } from './render/iso';
import { bakeLightMask, lampsOf } from './render/lights';
import { createPalette, type Palette } from './render/palette';
import { bakeTerrain } from './render/terrain-bake';
import { parseGolfer, type GolferLayout } from './world/golfer';
import { lazyList, parseCourse } from './world/course';
import type { Hole } from './world/hole';
import { parseManifest, type Manifest } from './world/manifest';

export const BUF_W = 360;
export const BUF_H = 270;

const HOLE_JSON = import.meta.glob('./world/holes/*.json', { eager: true, import: 'default' }) as Record<string, unknown>;
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
  /** A hole's view, terrain and light mask, baked on first use (about 45 ms) and cached. */
  holeContent(index: number): HoleContent;
  /** True once hole `index` has been baked. */
  isBaked(index: number): boolean;
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

export function bakeHole(hole: Hole, manifest: Manifest): HoleContent {
  const view = viewFor(hole, BUF_W, BUF_H);
  const bake = bakeTerrain(hole, view, BUF_W, BUF_H);
  return { hole, view, terrain: bakeToCanvases(bake), light: bakeLightMask(bake, view, lampsOf(hole, manifest)) };
}

export async function loadContent(): Promise<Content> {
  const manifest = parseManifest(manifestJson);
  const palette = createPalette(paletteJson);
  const holes = parseCourse(HOLE_JSON, manifest);
  const baked = lazyList(holes.length, (i) => bakeHole(holes[i], manifest));
  const [sprites, golfer] = await Promise.all([loadSprites(manifest), loadGolfer()]);
  return { manifest, palette, holes, holeContent: baked.get, isBaked: baked.has, sprites, golfer };
}
