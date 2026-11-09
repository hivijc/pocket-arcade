import type { Vec2 } from '../core/geometry';
import { heightAt } from '../physics/terrain';
import type { Hole, Segment } from '../world/hole';
import { depthOf, project, type View } from './iso';

export type WallSide = 'back' | 'front' | 'inner';

export interface FenceColors {
  readonly post: string;
  readonly postFoot: string;
  readonly rail: string;
  /** Posts per tile (default 8: a picket fence). Fewer, with `sag`, makes a rope-and-post fence. */
  readonly postsPerTile?: number;
  /** The rail dips a pixel between posts, like a slack rope. */
  readonly sag?: boolean;
}

export const FENCE_COLORS: FenceColors = { post: '#efe6d2', postFoot: '#b08a62', rail: '#d9c08c' };
const POST_H = 6;
const RAIL_LIFT = 4;
const POSTS_PER_TILE = 8;

export interface Px {
  readonly x: number;
  readonly y: number;
  /** #rrggbb */
  readonly color: string;
}

const isPlay = (hole: Hole, x: number, y: number) =>
  x >= 0 && y >= 0 && x < hole.width && y < hole.depth && hole.surface[y][x] !== 'X';

/** Back walls sit behind the play area, front walls in front of it; anything else is inner. */
export function classifyWall(hole: Hole, seg: Segment): WallSide {
  const [ax, ay] = seg.a;
  const [bx, by] = seg.b;
  if (ay === by && Number.isInteger(ay)) {
    const mx = Math.floor((ax + bx) / 2);
    const below = isPlay(hole, mx, ay), above = isPlay(hole, mx, ay - 1);
    if (below && !above) return 'back';
    if (above && !below) return 'front';
  } else if (ax === bx && Number.isInteger(ax)) {
    const my = Math.floor((ay + by) / 2);
    const right = isPlay(hole, ax, my), left = isPlay(hole, ax - 1, my);
    if (right && !left) return 'back';
    if (left && !right) return 'front';
  }
  return 'inner';
}

export function wallDepth(seg: Segment, side: WallSide): number {
  if (side === 'front') return Math.max(depthOf(seg.a[0], seg.a[1]), depthOf(seg.b[0], seg.b[1]));
  return depthOf((seg.a[0] + seg.b[0]) / 2, (seg.a[1] + seg.b[1]) / 2);
}

/** Pixels of a little picket fence standing on a wall segment. */
export function picketPixels(hole: Hole, view: View, seg: Segment, colors: FenceColors = FENCE_COLORS): Px[] {
  const [ax, ay] = seg.a;
  const [bx, by] = seg.b;
  const n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) * (colors.postsPerTile ?? POSTS_PER_TILE)));
  const posts: Vec2[] = Array.from({ length: n + 1 }, (_, i) => {
    const gx = ax + ((bx - ax) * i) / n, gy = ay + ((by - ay) * i) / n;
    const [sx, sy] = project(view, gx, gy, heightAt(hole, gx, gy));
    return [Math.round(sx), Math.round(sy)];
  });
  const out: Px[] = [];
  for (const [x, y] of posts) {
    out.push({ x, y, color: colors.postFoot });
    for (let k = 1; k < POST_H; k++) out.push({ x, y: y - k, color: colors.post });
  }
  for (let i = 1; i < posts.length; i++) {
    const [x0, y0] = posts[i - 1];
    const [x1, y1] = posts[i];
    const steps = Math.max(1, Math.abs(x1 - x0));
    for (let j = 1; j < steps; j++) {
      const dip = colors.sag && j > steps / 4 && j < (steps * 3) / 4 ? 1 : 0;
      out.push({ x: x0 + Math.sign(x1 - x0) * j, y: Math.round(y0 + ((y1 - y0) * j) / steps) - RAIL_LIFT + dip, color: colors.rail });
    }
  }
  return out;
}
