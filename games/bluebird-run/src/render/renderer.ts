import type { Content } from '../content';
import type { GameState } from '../game/state';
import { groundZ } from '../sim/air';
import { facing } from '../sim/board';
import { AIR, SLOPE } from '../sim/constants';
import { riderPos } from '../sim/hazards';
import { animFor, dirFor, rowsFor } from '../world/rider';
import { viewOf, type Camera } from './camera';
import { depthOf, slopePx, sortByDepth, type View } from './iso';
import type { Particle } from './particles';
import { chunkBounds } from './slope-bake';
import { trackSegments, type TrackPoint } from './tracks';

/** The sky behind the floating slope. The page is painted the same colour after the post pass. */
export const BACKGROUND = '#9fd8ee';
const OUTLINE = '#14141c';
const SHADOW = 'rgba(77, 95, 154, 0.4)';
const TRACK_LIGHT = '#a9c2e2';
const TRACK_DEEP = '#8aa6d4';
const FINISH_RED = '#c8463c';
const SNOW = '#ffffff';
const JACKET = '#c8463c';
const MISSING = { color: '#ff00ff', w: 6, h: 6 };
/** Where the start hut stands, [c, d]: off to the screen-left of the start line. */
export const HUT_AT = [4, 2] as const;
/** Sprite names already warned about. An intentional mutable cache: each unknown name warns once, not every frame. */
const warnedMissing = new Set<string>();

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
  readonly track: readonly TrackPoint[];
  readonly particles: readonly Particle[];
}

interface Drawable {
  readonly depth: number;
  readonly draw: () => void;
}

function screen(view: View, c: number, d: number, z = 0): [number, number] {
  const [x, y] = slopePx(view, c, d, z);
  return [Math.round(x), Math.round(y)];
}

function drawSprite(ctx: CanvasRenderingContext2D, scene: Scene, view: View, name: string, c: number, d: number, z = 0): void {
  const def = scene.content.manifest[name];
  const img = scene.content.sprites.get(name);
  const [px, py] = screen(view, c, d, z);
  if (def?.image && img) {
    const { anchor, frames, fps } = def.image;
    const cw = Math.floor(img.width / frames);
    const f = Math.floor(scene.time * fps) % frames;
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

function shadow(ctx: CanvasRenderingContext2D, view: View, c: number, d: number, z: number, rx: number): void {
  const [px, py] = screen(view, c, d, z);
  ctx.fillStyle = SHADOW;
  ctx.beginPath();
  ctx.ellipse(px, py, rx, rx / 2, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawTracks(ctx: CanvasRenderingContext2D, view: View, track: readonly TrackPoint[]): void {
  ctx.lineWidth = 1;
  for (const [a, b] of trackSegments(track)) {
    const [x0, y0] = screen(view, a[0], a[1]);
    const [x1, y1] = screen(view, b[0], b[1]);
    ctx.strokeStyle = b[2] > 0.5 ? TRACK_DEEP : TRACK_LIGHT;
    ctx.beginPath();
    ctx.moveTo(x0 + 0.5, y0 + 0.5);
    ctx.lineTo(x1 + 0.5, y1 + 0.5);
    ctx.stroke();
  }
}

/** A red-and-white dashed line across the piste at d. */
function drawFinishLine(ctx: CanvasRenderingContext2D, view: View, d: number): void {
  ctx.lineWidth = 2;
  for (let c = SLOPE.powder, i = 0; c < SLOPE.width - SLOPE.powder; c += 1, i++) {
    const [x0, y0] = screen(view, c, d);
    const [x1, y1] = screen(view, c + 1, d);
    ctx.strokeStyle = i % 2 === 0 ? FINISH_RED : SNOW;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }
}

function drawPlayer(ctx: CanvasRenderingContext2D, scene: Scene, view: View): void {
  const b = scene.state.board;
  if (b.tumble <= 0 && b.invuln > 0 && Math.floor(scene.time * 10) % 2 === 1) return; // blink while invulnerable
  shadow(ctx, view, b.c, b.d, groundZ(scene.content.slope.ramps, b.c, b.d), 6);
  const [px, py] = screen(view, b.c, b.d, b.z);
  const rider = scene.content.rider;
  if (!rider) {
    const [w, h] = b.tumble > 0 ? [16, 8] : [10, 22];
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(px - w / 2 - 1, py - h - 1, w + 2, h + 2);
    ctx.fillStyle = JACKET;
    ctx.fillRect(px - w / 2, py - h, w, h);
    return;
  }
  const { layout, image } = rider;
  const anim = rowsFor(layout, animFor(b));
  const row = anim.rows[dirFor(facing(b))];
  const f = Math.floor(scene.time * layout.fps) % anim.frames;
  const [cw, ch] = layout.cell;
  ctx.drawImage(image, f * cw, row * ch, cw, ch, px - layout.anchor[0], py - layout.anchor[1], cw, ch);
}

/** Low, flat things drawn under every standing sprite: kicker ramps and the finish line. */
function drawDecals(ctx: CanvasRenderingContext2D, scene: Scene, view: View): void {
  for (const r of scene.content.slope.ramps) drawSprite(ctx, scene, view, 'ramp', r.c, r.d + AIR.rampLen / 2);
  drawFinishLine(ctx, view, scene.content.slope.finish);
}

function standing(ctx: CanvasRenderingContext2D, scene: Scene, view: View): Drawable[] {
  const { slope } = scene.content;
  const st = scene.state;
  const at = (name: string, c: number, d: number, z = 0): Drawable => ({ depth: depthOf(c, d), draw: () => drawSprite(ctx, scene, view, name, c, d, z) });
  const hazards = slope.hazards.flatMap((h, i) => (st.burst.includes(i) ? [] : [at(h.kind, h.at[0], h.at[1])]));
  const flags = slope.gates.flatMap((g) => [at(`flag-${g.color}`, g.c[0], g.d), at(`flag-${g.color}`, g.c[1], g.d)]);
  const flakes = slope.flakes.flatMap((f, i) => (st.flakes.includes(i) ? [] : [at('flake', f[0], f[1], 0.3)]));
  const riders = slope.riders.flatMap((r, i) => {
    const p = riderPos(r, st.riders[i] ?? null, st.time);
    return p ? [at(r.look, p.c, p.d)] : [];
  });
  const player: Drawable = { depth: depthOf(st.board.c, st.board.d), draw: () => drawPlayer(ctx, scene, view) };
  return [...hazards, ...flags, ...flakes, ...riders, at('hut', HUT_AT[0], HUT_AT[1]), at('banner', SLOPE.width / 2, slope.finish), player];
}

function drawParticles(ctx: CanvasRenderingContext2D, view: View, ps: readonly Particle[]): void {
  ctx.fillStyle = SNOW;
  for (const p of ps) {
    const [x, y] = screen(view, p.c, p.d, p.z);
    const size = p.life > p.max / 2 ? 2 : 1;
    ctx.fillRect(x, y, size, size);
  }
}

export function renderFrame(ctx: CanvasRenderingContext2D, scene: Scene): void {
  const view = viewOf(scene.cam);
  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, scene.width, scene.height);
  for (const i of scene.visible) {
    const b = chunkBounds(scene.content.slope.length, i);
    ctx.drawImage(scene.chunk(i), b.x - scene.cam.x, b.y - scene.cam.y);
  }
  drawTracks(ctx, view, scene.track);
  drawDecals(ctx, scene, view);
  for (const d of sortByDepth(standing(ctx, scene, view))) d.draw();
  drawParticles(ctx, view, scene.particles);
}
