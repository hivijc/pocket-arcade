import { bakeToCanvases, loadImage, loadSprites, spriteUrl } from './render/assets';
import type { FenceColors } from './render/fences';
import { viewFor, type View } from './render/iso';
import { bakeLightMask, lampsOf } from './render/lights';
import { createPalette, type Palette } from './render/palette';
import { BACKYARD_TERRAIN, bakeTerrain, type TerrainStyle } from './render/terrain-bake';
import { parseGolfer, type GolferLayout } from './world/golfer';
import { courseHoles, lazyList, type CourseDef } from './world/course';
import type { Hole } from './world/hole';
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
  readonly course: CourseDef;
  readonly manifest: Manifest;
  readonly palette: Palette;
  readonly holes: readonly Hole[];
  /** A hole's view, terrain and light mask, baked on first use (about 45 ms) and cached. */
  holeContent(index: number): HoleContent;
  /** True once hole `index` has been baked. */
  isBaked(index: number): boolean;
  readonly sprites: ReadonlyMap<string, HTMLImageElement>;
  readonly golfer: GolferArt | null;
  /** The course's canvas backdrop and fence colours. */
  readonly background: string;
  readonly fence: FenceColors;
}

async function loadGolfer(): Promise<GolferArt | null> {
  const raw = Object.values(GOLFER_JSON)[0];
  if (raw === undefined) return null; // no golfer art ingested yet: placeholder golfer
  const layout = parseGolfer(raw);
  const url = spriteUrl(layout.src);
  if (!url) throw new Error(`golfer: assets/sprites/${layout.src} is missing`);
  return { layout, image: await loadImage(url) };
}

/** Bakes one hole in a course's terrain style (Backyard's by default, e.g. for the hole editor). */
export function bakeHole(hole: Hole, manifest: Manifest, style: TerrainStyle = BACKYARD_TERRAIN): HoleContent {
  const view = viewFor(hole, BUF_W, BUF_H);
  const bake = bakeTerrain(hole, view, BUF_W, BUF_H, style);
  return { hole, view, terrain: bakeToCanvases(bake), light: bakeLightMask(bake, view, lampsOf(hole, manifest)) };
}

/** Parses one course and loads its sprites; holes bake lazily. The golfer is shared by every course. */
export async function loadContent(course: CourseDef): Promise<Content> {
  const manifest = parseManifest(course.manifest);
  const palette = createPalette(course.palette);
  const holes = courseHoles(course, manifest);
  const baked = lazyList(holes.length, (i) => bakeHole(holes[i], manifest, course.terrain));
  const [sprites, golfer] = await Promise.all([loadSprites(manifest, course.spriteDir), loadGolfer()]);
  return {
    course, manifest, palette, holes, holeContent: baked.get, isBaked: baked.has, sprites, golfer,
    background: course.background, fence: course.terrain.fence,
  };
}
