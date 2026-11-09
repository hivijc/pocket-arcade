import { bakeToCanvases, loadImage, loadSprites, spriteUrl } from './render/assets';
import type { FenceColors } from './render/fences';
import { viewFor, type View } from './render/iso';
import { bakeLightMask, lampsOf } from './render/lights';
import { createPalette, type Palette } from './render/palette';
import { bakeTerrain } from './render/terrain-bake';
import type { CourseDef } from './world/course';
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
  readonly course: CourseDef;
  readonly manifest: Manifest;
  readonly palette: Palette;
  readonly holes: readonly Hole[];
  readonly perHole: readonly HoleContent[];
  readonly sprites: ReadonlyMap<string, HTMLImageElement>;
  readonly golfer: GolferArt | null;
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

/** Parses, bakes and loads everything one course needs. The golfer is shared by every course. */
export async function loadContent(course: CourseDef): Promise<Content> {
  const manifest = parseManifest(course.manifest);
  const palette = createPalette(course.palette);
  const holes = course.holes.map(({ file, raw }) => parseHole(raw, manifest, `${course.id}/${file}`));
  const perHole = holes.map((hole) => {
    const view = viewFor(hole, BUF_W, BUF_H);
    const bake = bakeTerrain(hole, view, BUF_W, BUF_H, course.terrain);
    return { hole, view, terrain: bakeToCanvases(bake), light: bakeLightMask(bake, view, lampsOf(hole, manifest)) };
  });
  const [sprites, golfer] = await Promise.all([loadSprites(manifest, course.spriteDir), loadGolfer()]);
  return {
    course, manifest, palette, holes, perHole, sprites, golfer,
    background: course.background, fence: course.terrain.fence,
  };
}
