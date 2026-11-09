import { parseHole, type Hole } from '../../src/world/hole';
import { parseManifest } from '../../src/world/manifest';

export const TEST_MANIFEST = parseManifest({
  post: { footprint: { kind: 'circle', r: 0.3 }, placeholder: { color: '#ffffff', w: 4, h: 8 } },
  crate: { footprint: { kind: 'box', w: 1, d: 1 }, placeholder: { color: '#aa5522', w: 8, h: 8 } },
  flower: { placeholder: { color: '#ff00ff', w: 4, h: 4 } },
});

export interface HoleOpts {
  width?: number;
  depth?: number;
  rows?: string[];
  heightOf?: (x: number, y: number) => number; // quarter-tile steps at corner (x, y)
  tee?: [number, number];
  cup?: [number, number];
  props?: { sprite: string; at: [number, number] }[];
  walls?: [[number, number], [number, number]][];
  par?: number;
}

export function rawHole(o: HoleOpts = {}): Record<string, unknown> {
  const width = o.width ?? 20;
  const depth = o.depth ?? 5;
  const surface = o.rows ?? Array.from({ length: depth }, () => 'G'.repeat(width));
  const height = Array.from({ length: depth + 1 }, (_, y) =>
    Array.from({ length: width + 1 }, (_, x) => (o.heightOf ? o.heightOf(x, y) : 0)),
  );
  return {
    name: 'Test',
    par: o.par ?? 3,
    size: [width, depth],
    height,
    surface,
    walls: o.walls ?? [],
    tee: o.tee ?? [1.5, 2.5],
    cup: o.cup ?? [width - 1.5, 0.5],
    props: o.props ?? [],
  };
}

export function makeHole(o: HoleOpts = {}): Hole {
  return parseHole(rawHole(o), TEST_MANIFEST, 'test.json');
}
