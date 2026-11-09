import { describe, expect, it } from 'vitest';
import { COURSE_IDS, loadCourseDef, type CourseDef } from '../../src/world/course';
import { parseManifest } from '../../src/world/manifest';
import { parseHole, type Hole } from '../../src/world/hole';
import { restingBall } from '../../src/physics/ball';
import { simulateShot } from '../../src/physics/simulate';
import { SOLUTIONS } from '../fixtures/solutions';

const courses = await Promise.all(COURSE_IDS.map(loadCourseDef));
const holesOf = (c: CourseDef): Hole[] => {
  const manifest = parseManifest(c.manifest);
  return c.holes.map(({ file, raw }) => parseHole(raw, manifest, `${c.id}/${file}`));
};
const byId = Object.fromEntries(courses.map((c) => [c.id, holesOf(c)]));
const allHoles = courses.flatMap((c) => byId[c.id].map((h) => [`${c.name}: ${h.name}`, h] as const));

/** True if no power from 0.5 to 1 sinks the ball from the tee at any angle in [from, to] degrees. */
function noAceBetween(hole: Hole, from: number, to: number): boolean {
  const tee = restingBall(hole, hole.tee);
  for (let deg = from; deg <= to; deg += 1) {
    for (let p = 0.5; p <= 1.0001; p += 0.02) {
      if (simulateShot(hole, tee, (deg * Math.PI) / 180, p).outcome === 'holed') return false;
    }
  }
  return true;
}

describe('Backyard holes', () => {
  const holes = byId.backyard;
  it('start with the original three', () => {
    expect(holes.slice(0, 3).map((h) => h.name)).toEqual(['Gnome Alley', 'Picket Bank', 'Pool Hop']);
    expect(holes.slice(0, 3).map((h) => h.par)).toEqual([2, 3, 3]);
  });

  it('hole 3 has water between the tee and the cup', () => {
    expect(holes[2].surface.some((row) => row.includes('W'))).toBe(true);
  });

  it('Pool Hop has no hole-in-one straight down the lane (±6°)', () => {
    expect(noAceBetween(holes[2], -6, 6)).toBe(true);
  });
});

describe('Boardwalk holes', () => {
  const holes = byId.boardwalk;
  it('all load, par 2–3', () => {
    expect(holes.map((h) => h.name)).toEqual(['Sandbar', 'Tide Pool Bridge', 'Castle Hop']);
    for (const h of holes) expect(h.par).toBeGreaterThanOrEqual(2);
    for (const h of holes) expect(h.par).toBeLessThanOrEqual(3);
  });

  it('Sandbar has a sand trap between the tee and the cup', () => {
    const h = holes[0];
    const row = h.surface[Math.floor(h.tee[1])];
    expect(row.slice(Math.ceil(h.tee[0]), Math.floor(h.cup[0]))).toContain('S');
  });

  it('Tide Pool Bridge crosses the pool on planks', () => {
    const h = holes[1];
    expect(h.surface.some((r) => r.includes('W'))).toBe(true);
    expect(h.surface.some((r) => r.includes('P'))).toBe(true);
  });

  it('Castle Hop ramps up to a drop before the moat', () => {
    const h = holes[2];
    const y = Math.floor(h.tee[1]);
    expect(Math.max(...h.heights[y])).toBeGreaterThan(h.heights[y][0]);
  });

  it.each(holes.map((h) => [h.name, h] as const))('%s has no hole-in-one straight at the cup (±6°)', (_n, h) => {
    const straight = (Math.atan2(h.cup[1] - h.tee[1], h.cup[0] - h.tee[0]) * 180) / Math.PI;
    expect(noAceBetween(h, Math.round(straight) - 6, Math.round(straight) + 6)).toBe(true);
  });
});

describe('every hole', () => {
  it.each(allHoles)('%s fits in the 360×270 buffer at 32 px tiles', (_n, h) => {
    expect((h.width + h.depth) * 16).toBeLessThanOrEqual(360); // screen width of the diamond
    expect((h.width + h.depth) * 8).toBeLessThanOrEqual(200); // screen height, leaving room for props
  });
});

describe('holes are solvable in par', () => {
  it('every hole has a known solution', () => {
    for (const [name] of allHoles) expect(SOLUTIONS[name.slice(name.indexOf(': ') + 2)], name).toBeDefined();
  });

  it.each(allHoles.filter(([n]) => SOLUTIONS[n.slice(n.indexOf(': ') + 2)]))('%s', (name, hole) => {
    const shots = SOLUTIONS[name.slice(name.indexOf(': ') + 2)];
    expect(shots.length).toBeLessThanOrEqual(hole.par);
    let ball = restingBall(hole, hole.tee);
    const outcomes = shots.map(([deg, power]) => {
      const r = simulateShot(hole, ball, (deg * Math.PI) / 180, power);
      ball = r.ball;
      return r.outcome;
    });
    // Every shot but the last must come to rest in play (a water shot can't silently continue).
    expect(outcomes.slice(0, -1).every((o) => o === 'stopped')).toBe(true);
    expect(outcomes.at(-1)).toBe('holed');
  });
});
