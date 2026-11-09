import type { Vec2 } from '../core/geometry';
import { aimAngle, type GameState } from '../game/state';
import { heightAt } from '../physics/terrain';
import type { Hole } from '../world/hole';
import type { Manifest } from '../world/manifest';
import { depthOf, project, sortByDepth, type View } from './iso';

export interface Frame {
  readonly state: GameState;
  readonly hole: Hole;
  readonly view: View;
  readonly terrain: CanvasImageSource;
  readonly manifest: Manifest;
  readonly width: number;
  readonly height: number;
}

interface Drawable {
  readonly depth: number;
  draw(ctx: CanvasRenderingContext2D): void;
}

const COLORS = {
  bg: '#1b2a2f', ball: '#ffffff', shadow: 'rgba(0,0,0,0.35)', cup: '#151515',
  fence: '#efe6d2', fenceSide: '#b8ad96', shirt: '#3d6fb6', legs: '#2f3b52', skin: '#e7b98f',
  pole: '#dddddd', flag: '#e5483b', aim: '#ffffff', aimShadow: 'rgba(0,0,0,0.5)', propSide: 'rgba(0,0,0,0.25)',
} as const;
const FENCE_H = 0.3;
const AIM_DOTS = 6;
const AIM_SPACING = 0.3;

function poly(ctx: CanvasRenderingContext2D, pts: readonly Vec2[], color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
  ctx.fill();
}

function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

function ground(f: Frame, x: number, y: number, lift = 0): Vec2 {
  return project(f.view, x, y, heightAt(f.hole, x, y) + lift);
}

function walls(f: Frame): Drawable[] {
  return f.hole.walls.map((w) => {
    const [ax, ay] = w.a;
    const [bx, by] = w.b;
    const pts = [ground(f, ax, ay), ground(f, bx, by), ground(f, bx, by, FENCE_H), ground(f, ax, ay, FENCE_H)];
    const color = ax === bx ? COLORS.fenceSide : COLORS.fence;
    return { depth: depthOf((ax + bx) / 2, (ay + by) / 2), draw: (ctx) => poly(ctx, pts, color) };
  });
}

function props(f: Frame): Drawable[] {
  return f.hole.props.flatMap((p): Drawable[] => {
    const placeholder = f.manifest[p.sprite].placeholder;
    if (!placeholder) return [];
    const { color, w, h } = placeholder;
    const [sx, sy] = ground(f, p.at[0], p.at[1]);
    return [{
      depth: depthOf(p.at[0], p.at[1]),
      draw: (ctx) => {
        rect(ctx, sx - w / 2, sy - h, w, h, color);
        rect(ctx, sx, sy - h, Math.ceil(w / 2), h, COLORS.propSide);
      },
    }];
  });
}

function flag(f: Frame): Drawable {
  const [cx, cy] = f.hole.cup;
  const [sx, sy] = ground(f, cx, cy);
  return {
    depth: depthOf(cx, cy) + 0.01,
    draw: (ctx) => {
      rect(ctx, sx, sy - 16, 1, 16, COLORS.pole);
      rect(ctx, sx + 1, sy - 16, 6, 4, COLORS.flag);
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

function golfer(f: Frame): Drawable[] {
  const k = f.state.phase.kind;
  if (k !== 'aiming' && k !== 'charging') return [];
  const b = f.state.ball;
  const aim = aimAngle(f.state);
  const x = b.x + Math.cos(aim + Math.PI / 2) * 0.35 - Math.cos(aim) * 0.15;
  const y = b.y + Math.sin(aim + Math.PI / 2) * 0.35 - Math.sin(aim) * 0.15;
  const [sx, sy] = ground(f, x, y);
  return [{
    depth: depthOf(x, y),
    draw: (ctx) => {
      rect(ctx, sx - 2, sy - 6, 4, 6, COLORS.legs);
      rect(ctx, sx - 3, sy - 13, 6, 7, COLORS.shirt);
      rect(ctx, sx - 2, sy - 17, 4, 4, COLORS.skin);
    },
  }];
}

function drawCup(ctx: CanvasRenderingContext2D, f: Frame): void {
  const [sx, sy] = ground(f, f.hole.cup[0], f.hole.cup[1]);
  ctx.fillStyle = COLORS.cup;
  ctx.beginPath();
  ctx.ellipse(Math.round(sx), Math.round(sy), 3, 1.5, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawAim(ctx: CanvasRenderingContext2D, f: Frame): void {
  const k = f.state.phase.kind;
  if (k !== 'aiming' && k !== 'charging') return;
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
  drawAim(ctx, f);
}
