import type { Content } from '../content';
import type { GameState } from '../game/state';
import { sprinklerOn } from '../sim/hazards';
import { paperPos } from '../sim/paper';
import { riderDir } from '../world/rider';
import { LAWN_WIDTH, LOT_LENGTH, lotOriginC, type Lot } from '../world/street';
import { viewOf, type Camera } from './camera';
import { depthOf, sortByDepth, streetPx, type View } from './iso';
import { chunkBounds } from './street-bake';

/** The sky behind the floating street. The page is painted the same colour after the post pass. */
export const BACKGROUND = '#9fd8ee';
const OUTLINE = '#14141c';
const SHADOW = 'rgba(20, 20, 28, 0.35)';
const MISSING = { color: '#ff00ff', w: 6, h: 6 };
/** Sprite names already warned about. An intentional mutable cache: each unknown name warns once, not every frame. */
const warnedMissing = new Set<string>();
/** How far from the lawn's outer edge a house stands, tiles, so its porch sits between it and the street. */
const HOUSE_INSET = 1;

export interface Scene {
  readonly content: Content;
  readonly state: GameState;
  /** Snapped (whole-pixel) camera. */
  readonly cam: Camera;
  /** Visible chunk indices, far first. */
  readonly visible: readonly number[];
  readonly chunk: (index: number) => CanvasImageSource;
  readonly time: number;
  readonly width: number;
  readonly height: number;
}

interface Drawable {
  readonly depth: number;
  readonly draw: () => void;
}

export function houseSpot(lot: Lot): [number, number] {
  const c = lot.side === 'L' ? lotOriginC('L') + HOUSE_INSET : lotOriginC('R') + LAWN_WIDTH - HOUSE_INSET;
  return [c, lot.s + LOT_LENGTH / 2];
}

export const houseSprite = (lot: Lot): string => `${lot.house}-${lot.side === 'L' ? 'l' : 'r'}`;

function screen(scene: Scene, view: View, c: number, s: number, z = 0): [number, number] {
  const [x, y] = streetPx(view, scene.content.street.length, c, s, z);
  return [Math.round(x), Math.round(y)];
}

function drawSprite(ctx: CanvasRenderingContext2D, scene: Scene, view: View, name: string, c: number, s: number, z = 0, frame?: number): void {
  const def = scene.content.manifest[name];
  const img = scene.content.sprites.get(name);
  const [px, py] = screen(scene, view, c, s, z);
  if (def?.image && img) {
    const { anchor, frames, fps } = def.image;
    const cw = Math.floor(img.width / frames);
    const f = (frame ?? Math.floor(scene.time * fps)) % frames;
    ctx.drawImage(img, f * cw, 0, cw, img.height, px - anchor[0], py - anchor[1], cw, img.height);
    return;
  }
  if (!def && !warnedMissing.has(name)) {
    warnedMissing.add(name);
    console.warn(`renderer: no manifest entry for sprite "${name}"; drawing the MISSING box`);
  }
  const ph = def?.placeholder ?? MISSING;
  const x = Math.round(px - ph.w / 2);
  ctx.fillStyle = OUTLINE;
  ctx.fillRect(x - 1, py - ph.h - 1, ph.w + 2, ph.h + 2);
  ctx.fillStyle = ph.color;
  ctx.fillRect(x, py - ph.h, ph.w, ph.h);
}

function shadow(ctx: CanvasRenderingContext2D, scene: Scene, view: View, c: number, s: number, rx: number): void {
  const [px, py] = screen(scene, view, c, s);
  ctx.fillStyle = SHADOW;
  ctx.beginPath();
  ctx.ellipse(px, py, rx, rx / 2, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawBike(ctx: CanvasRenderingContext2D, scene: Scene, view: View): void {
  const { bike } = scene.state;
  if (bike.wobble <= 0 && bike.invuln > 0 && Math.floor(scene.time * 10) % 2 === 1) return; // blink while invulnerable
  const shake = bike.wobble > 0 || scene.state.inSpray ? Math.round(Math.sin(scene.time * 40)) : 0;
  shadow(ctx, scene, view, bike.c, bike.s, 6);
  const [x, py] = screen(scene, view, bike.c, bike.s);
  const px = x + shake;
  const rider = scene.content.rider;
  if (!rider) {
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(px - 5, py - 21, 10, 22);
    ctx.fillStyle = '#c8463c';
    ctx.fillRect(px - 4, py - 20, 8, 20);
    return;
  }
  const { layout, image } = rider;
  const row = layout.rows[riderDir(bike.lean)];
  const f = Math.floor(scene.time * layout.fps) % layout.frames;
  const [cw, ch] = layout.cell;
  ctx.drawImage(image, f * cw, row * ch, cw, ch, px - layout.anchor[0], py - layout.anchor[1], cw, ch);
}

/** Flat things on the ground, drawn under every standing sprite. */
function drawDecals(ctx: CanvasRenderingContext2D, scene: Scene, view: View): void {
  for (const h of scene.content.street.hazards) if (h.kind === 'puddle') drawSprite(ctx, scene, view, 'puddle', h.at[0], h.at[1]);
  for (const [c, s] of scene.state.landed) drawSprite(ctx, scene, view, 'paper', c, s, 0, 0);
}

function standing(ctx: CanvasRenderingContext2D, scene: Scene, view: View): Drawable[] {
  const { street } = scene.content;
  const st = scene.state;
  const at = (name: string, c: number, s: number): Drawable => ({ depth: depthOf(street.length, c, s), draw: () => drawSprite(ctx, scene, view, name, c, s) });
  const lots = street.lots.flatMap((lot) => {
    const [hc, hs] = houseSpot(lot);
    return [at(houseSprite(lot), hc, hs), at(lot.subscriber ? 'mailbox-sub' : 'mailbox-plain', lot.mailbox[0], lot.mailbox[1])];
  });
  const hazards = street.hazards.flatMap((h) => {
    if (h.kind === 'car') return [at('car', h.at[0], h.at[1])];
    if (h.kind !== 'sprinkler') return [];
    const head = at('sprinkler', h.at[0], h.at[1]);
    return sprinklerOn(st.time) ? [head, at('spray', (h.spray.c0 + h.spray.c1) / 2, (h.spray.s0 + h.spray.s1) / 2)] : [head];
  });
  const bundles = street.bundles.flatMap((b, i) => (st.bundlesTaken.includes(i) ? [] : [at('bundle', b[0], b[1])]));
  const dog = at(st.dog.mode === 'chase' || st.dog.mode === 'return' ? 'dog-run' : 'dog-sit', st.dog.c, st.dog.s);
  const papers = st.flying.map((p): Drawable => {
    const pos = paperPos(p);
    return {
      depth: depthOf(street.length, pos.c, pos.s),
      draw: () => {
        shadow(ctx, scene, view, pos.c, pos.s, 3);
        drawSprite(ctx, scene, view, 'paper', pos.c, pos.s, pos.z);
      },
    };
  });
  const bike: Drawable = { depth: depthOf(street.length, st.bike.c, st.bike.s), draw: () => drawBike(ctx, scene, view) };
  return [...lots, ...street.props.map((p) => at(p.kind, p.at[0], p.at[1])), ...hazards, ...bundles, dog, ...papers, bike];
}

export function renderFrame(ctx: CanvasRenderingContext2D, scene: Scene): void {
  const view = viewOf(scene.cam);
  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, scene.width, scene.height);
  for (const i of scene.visible) {
    const b = chunkBounds(scene.content.street.length, i);
    ctx.drawImage(scene.chunk(i), b.x - scene.cam.x, b.y - scene.cam.y);
  }
  drawDecals(ctx, scene, view);
  for (const d of sortByDepth(standing(ctx, scene, view))) d.draw();
}
