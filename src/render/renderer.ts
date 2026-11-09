import type { Vec2 } from '../core/geometry';
import { aimAngle, type GameState } from '../game/state';
import { heightAt } from '../physics/terrain';
import { PLACEHOLDER_ANIMS, type GolferLayout } from '../world/golfer';
import type { Hole } from '../world/hole';
import type { Manifest, SpriteImage } from '../world/manifest';
import { classifyWall, picketPixels, wallDepth, type Px } from './fences';
import { golferPose, type GolferPose } from './golfer-pose';
import { depthOf, project, sortByDepth, type View } from './iso';
import type { PhaseLook } from './time-of-day';
import { swayOffset } from './wind';

export interface Frame {
  readonly state: GameState;
  readonly hole: Hole;
  readonly view: View;
  readonly terrain: CanvasImageSource;
  readonly manifest: Manifest;
  readonly sprites: ReadonlyMap<string, HTMLImageElement>;
  readonly golfer: { readonly layout: GolferLayout; readonly image: HTMLImageElement } | null;
  readonly look: PhaseLook;
  readonly time: number;
  /** Current wind step (0 or 1). */
  readonly wind: number;
  readonly width: number;
  readonly height: number;
}

interface Drawable {
  readonly depth: number;
  draw(ctx: CanvasRenderingContext2D): void;
}

/** The canvas backdrop behind the island; the page background is set to its post-processed colour. */
export const BACKGROUND = '#2c2c3a';

const COLORS = {
  bg: BACKGROUND, ball: '#fffaf0', cup: '#14141c', shadow: 'rgba(20,20,28,0.35)',
  pole: '#efe6d2', flag: '#c8463c', aim: '#fffaf0', aimShadow: 'rgba(20,20,28,0.6)', pull: '#f0a64a',
  shirt: '#2f6f9a', legs: '#4a3b2e', skin: '#e7b98f', propSide: 'rgba(20,20,28,0.25)',
} as const;
const AIM_DOTS = 6;
const AIM_SPACING = 0.3;
/** Slingshot pull band behind the ball at full power. */
const PULL_DOTS = 7;
const PULL_SPACING = 0.28;

function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

const ground = (f: Frame, x: number, y: number, lift = 0): Vec2 => project(f.view, x, y, heightAt(f.hole, x, y) + lift);

/** A soft drop shadow at a sprite's foot, thrown the way the phase's light falls. */
function shadow(ctx: CanvasRenderingContext2D, f: Frame, sx: number, sy: number, w: number, h: number): void {
  const dx = f.look.shadow[0] * h * 0.5, dy = f.look.shadow[1] * h * 0.5;
  ctx.fillStyle = COLORS.shadow;
  ctx.beginPath();
  ctx.ellipse(Math.round(sx + dx / 2), Math.round(sy + dy / 2), Math.max(2, w * 0.35), Math.max(1, w * 0.15), 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Draws a sprite with its anchor on (sx, sy); the top half shifts by `sway` pixels. */
function drawImageSprite(ctx: CanvasRenderingContext2D, img: HTMLImageElement, image: SpriteImage, sx: number, sy: number, sway: number): void {
  const x = Math.round(sx - image.anchor[0]), y = Math.round(sy - image.anchor[1]);
  const split = Math.floor(img.height / 2);
  ctx.drawImage(img, 0, split, img.width, img.height - split, x, y + split, img.width, img.height - split);
  ctx.drawImage(img, 0, 0, img.width, split, x + sway, y, img.width, split);
}

const fenceCache = new WeakMap<Hole, Drawable[]>();

function plotPx(ctx: CanvasRenderingContext2D, px: readonly Px[]): void {
  for (const p of px) {
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, 1, 1);
  }
}

function walls(f: Frame): Drawable[] {
  const cached = fenceCache.get(f.hole);
  if (cached) return cached;
  const items = f.hole.walls.flatMap((seg): Drawable[] => {
    const side = classifyWall(f.hole, seg);
    if (side === 'back') return [];
    const px = picketPixels(f.hole, f.view, seg);
    return [{ depth: wallDepth(seg, side), draw: (ctx) => plotPx(ctx, px) }];
  });
  fenceCache.set(f.hole, items);
  return items;
}

function props(f: Frame): Drawable[] {
  return f.hole.props.map((p) => {
    const def = f.manifest[p.sprite];
    const img = f.sprites.get(p.sprite);
    const [sx, sy] = ground(f, p.at[0], p.at[1]);
    const sway = def.sway ? swayOffset(f.wind, p.at) : 0;
    return {
      depth: depthOf(p.at[0], p.at[1]),
      draw: (ctx) => {
        if (img && def.image) {
          shadow(ctx, f, sx, sy, img.width, img.height);
          drawImageSprite(ctx, img, def.image, sx, sy, sway);
        } else if (def.placeholder) {
          const { color, w, h } = def.placeholder;
          shadow(ctx, f, sx, sy, w, h);
          rect(ctx, sx - w / 2, sy - h, w, h, color);
          rect(ctx, sx, sy - h, Math.ceil(w / 2), h, COLORS.propSide);
        }
      },
    };
  });
}

function flag(f: Frame): Drawable {
  const [cx, cy] = f.hole.cup;
  const [sx, sy] = ground(f, cx, cy);
  return {
    depth: depthOf(cx, cy) + 0.01,
    draw: (ctx) => {
      rect(ctx, sx, sy - 16, 1, 16, COLORS.pole);
      rect(ctx, sx + 1, sy - 16 + (f.wind ? 1 : 0), 6, 4, COLORS.flag);
    },
  };
}

function ball(f: Frame): Drawable[] {
  if (f.state.phase.kind === 'holed') return [];
  const b = f.state.ball;
  const [gx, gy] = ground(f, b.x, b.y);
  const [bx, by] = project(f.view, b.x, b.y, b.z);
  return [{
    depth: depthOf(b.x, b.y, b.z),
    draw: (ctx) => {
      rect(ctx, gx - 1, gy, 3, 1, COLORS.shadow);
      rect(ctx, bx - 1, by - 2, 2, 2, COLORS.ball);
    },
  }];
}

function drawGolfer(ctx: CanvasRenderingContext2D, f: Frame, pose: GolferPose, sx: number, sy: number): void {
  if (!f.golfer) {
    shadow(ctx, f, sx, sy, 6, 17);
    rect(ctx, sx - 2, sy - 6, 4, 6, COLORS.legs);
    rect(ctx, sx - 3, sy - 13, 6, 7, COLORS.shirt);
    rect(ctx, sx - 2, sy - 17, 4, 4, COLORS.skin);
    return;
  }
  const { cell: [cw, ch], anchor: [ax, ay], anims } = f.golfer.layout;
  const row = anims[pose.anim].rows[pose.facing];
  shadow(ctx, f, sx, sy, cw * 0.5, ch * 0.6);
  ctx.drawImage(f.golfer.image, pose.frame * cw, row * ch, cw, ch, Math.round(sx - ax), Math.round(sy - ay), cw, ch);
}

function golfer(f: Frame): Drawable[] {
  const pose = golferPose(f.state, f.hole, f.golfer?.layout.anims ?? PLACEHOLDER_ANIMS, f.time);
  if (!pose) return [];
  const [sx, sy] = ground(f, pose.at[0], pose.at[1]);
  return [{ depth: depthOf(pose.at[0], pose.at[1]), draw: (ctx) => drawGolfer(ctx, f, pose, sx, sy) }];
}

function drawCup(ctx: CanvasRenderingContext2D, f: Frame): void {
  const [sx, sy] = ground(f, f.hole.cup[0], f.hole.cup[1]);
  ctx.fillStyle = COLORS.cup;
  ctx.beginPath();
  ctx.ellipse(Math.round(sx), Math.round(sy), 3, 1.5, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Touch slingshot: a band of dots pulled back behind the ball, longer with more power. */
function drawPull(ctx: CanvasRenderingContext2D, f: Frame): void {
  const p = f.state.phase;
  if (p.kind !== 'dragging') return;
  const b = f.state.ball;
  const aim = f.state.aim;
  const dots = Math.max(1, Math.round(p.power * PULL_DOTS));
  for (let i = 1; i <= dots; i++) {
    const d = i * PULL_SPACING;
    const [sx, sy] = ground(f, b.x - Math.cos(aim) * d, b.y - Math.sin(aim) * d);
    rect(ctx, sx - 1, sy, 2, 2, COLORS.aimShadow);
    rect(ctx, sx - 1, sy - 1, 2, 2, COLORS.pull);
  }
}

function drawAim(ctx: CanvasRenderingContext2D, f: Frame): void {
  const k = f.state.phase.kind;
  if (k !== 'aiming' && k !== 'charging' && k !== 'dragging') return;
  const b = f.state.ball;
  const aim = aimAngle(f.state);
  for (let i = 1; i <= AIM_DOTS; i++) {
    const d = i * AIM_SPACING;
    const [sx, sy] = ground(f, b.x + Math.cos(aim) * d, b.y + Math.sin(aim) * d);
    rect(ctx, sx, sy + 1, 1, 1, COLORS.aimShadow);
    rect(ctx, sx, sy, 1, 1, COLORS.aim);
  }
}

export function renderFrame(ctx: CanvasRenderingContext2D, f: Frame): void {
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, f.width, f.height);
  ctx.drawImage(f.terrain, 0, 0);
  drawCup(ctx, f);
  for (const d of sortByDepth([...walls(f), ...props(f), flag(f), ...ball(f), ...golfer(f)])) d.draw(ctx);
  drawPull(ctx, f);
  drawAim(ctx, f);
}
