import { describe, expect, it } from 'vitest';
import manifestJson from '../../assets/manifest.json';
import { parseManifest } from '../../src/world/manifest';
import { COURSE_IDS, courseHoles, loadCourseDef, parseCourse } from '../../src/world/course';
import type { Hole } from '../../src/world/hole';
import { heightAt } from '../../src/physics/terrain';
import { restingBall } from '../../src/physics/ball';
import { simulateShot } from '../../src/physics/simulate';
import { COURSE_SOLUTIONS, SOLUTIONS } from '../fixtures/solutions';

const manifest = parseManifest(manifestJson);
const holes = parseCourse(import.meta.glob('../../src/world/holes/*.json', { eager: true, import: 'default' }), manifest);
const byName = (name: string): Hole => holes.find((h) => h.name === name)!;
const has = (h: Hole, letter: string) => h.surface.some((row) => row.includes(letter));
const lights = (h: Hole) => h.props.filter((p) => manifest[p.sprite].light).length;

/** Every outcome of shots from the tee within ±`spread`° of the straight line to the cup, at 2% power steps. */
function directOutcomes(hole: Hole, spread: number): string[] {
  const from = restingBall(hole, hole.tee);
  const toCup = (Math.atan2(hole.cup[1] - hole.tee[1], hole.cup[0] - hole.tee[0]) * 180) / Math.PI;
  const out: string[] = [];
  for (let deg = toCup - spread; deg <= toCup + spread + 1e-9; deg += 1) {
    for (let p = 0.1; p <= 1.0001; p += 0.02) out.push(simulateShot(hole, from, (deg * Math.PI) / 180, p).outcome);
  }
  return out;
}

describe('Backyard holes', () => {
  it('all load', () => {
    expect(holes.map((h) => h.name)).toEqual([
      'Gnome Alley', 'Picket Bank', 'Pool Hop', 'Bunker Guard', 'Tilted Green',
      'Plank Bridge', 'Upper Deck', 'Gnome Maze', 'Grand Finale',
    ]);
    expect(holes.map((h) => h.par)).toEqual([2, 3, 3, 3, 2, 3, 3, 4, 3]);
    expect(holes.every((h) => h.par >= 2 && h.par <= 4)).toBe(true);
  });

  it('fit in the 360×270 buffer at 32 px tiles', () => {
    for (const h of holes) {
      expect((h.width + h.depth) * 16).toBeLessThanOrEqual(360); // screen width of the diamond
      expect((h.width + h.depth) * 8).toBeLessThanOrEqual(200); // screen height, leaving room for props
    }
  });

  it('hole 3 has water between the tee and the cup', () => {
    expect(holes[2].surface.some((row) => row.includes('W'))).toBe(true);
  });

  it('light most holes so night looks good', () => {
    expect(holes.filter((h) => lights(h) >= 2).length).toBeGreaterThanOrEqual(8);
  });

  it('each new hole carries its idea', () => {
    const bunker = byName('Bunker Guard');
    // Sand on the straight line from the tee to the cup.
    expect([6, 7, 8, 9].some((x) => bunker.surface[Math.floor(bunker.cup[1])][x] === 'S')).toBe(true);
    const tilted = byName('Tilted Green');
    expect(heightAt(tilted, 6, 0.5)).toBeGreaterThan(heightAt(tilted, 6, 7.5));
    const bridge = byName('Plank Bridge');
    expect(has(bridge, 'W')).toBe(true);
    expect(bridge.surface.filter((row) => row[6] === 'G')).toHaveLength(1); // one plank wide
    const deck = byName('Upper Deck');
    expect(heightAt(deck, 11.5, 1.5) - heightAt(deck, 1.5, 1.5)).toBeGreaterThanOrEqual(1);
    expect(has(byName('Gnome Maze'), 'X')).toBe(true);
    const finale = byName('Grand Finale');
    expect(has(finale, 'W')).toBe(true);
    expect(heightAt(finale, finale.tee[0], finale.tee[1])).toBeGreaterThan(heightAt(finale, 5.5, 3.5));
  });

  it.each(holes.slice(3).map((h) => [h.name, h] as const))('%s has no hole-in-one aimed straight at the cup (±3°)', (_n, hole) => {
    expect(directOutcomes(hole, 3)).not.toContain('holed');
  });

  it('no tee shot near the straight line runs out the clock', () => {
    for (const h of holes) expect(directOutcomes(h, 1)).not.toContain('timeout');
  });

  it('Pool Hop has no hole-in-one straight down the lane (±6°)', () => {
    const hole = holes[2];
    const from = restingBall(hole, hole.tee);
    for (let deg = -6; deg <= 6; deg += 1) {
      for (let p = 0.5; p <= 1.0001; p += 0.02) {
        expect(simulateShot(hole, from, (deg * Math.PI) / 180, p).outcome).not.toBe('holed');
      }
    }
  });
});

describe('Backyard holes are solvable in par', () => {
  it.each(holes.map((h) => [h.name, h] as const))('%s', (_name, hole) => {
    const shots = SOLUTIONS[hole.name];
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

describe('Boardwalk holes', async () => {
  const course = await loadCourseDef('boardwalk');
  const bwManifest = parseManifest(course.manifest);
  const bw = courseHoles(course, bwManifest);

  it('all load, par 2–3, lit for night', () => {
    expect(bw.map((h) => h.name)).toEqual(['Sandbar', 'Tide Pool Bridge', 'Castle Hop']);
    expect(bw.every((h) => h.par >= 2 && h.par <= 3)).toBe(true);
    for (const h of bw) expect(h.props.filter((p) => bwManifest[p.sprite].light).length).toBeGreaterThanOrEqual(2);
  });

  it('fit in the 360×270 buffer at 32 px tiles', () => {
    for (const h of bw) {
      expect((h.width + h.depth) * 16).toBeLessThanOrEqual(360);
      expect((h.width + h.depth) * 8).toBeLessThanOrEqual(200);
    }
  });

  it('each hole carries its idea', () => {
    const [sandbar, bridge, castle] = bw;
    const row = sandbar.surface[Math.floor(sandbar.tee[1])];
    expect(row.slice(Math.ceil(sandbar.tee[0]), Math.floor(sandbar.cup[0]))).toContain('S');
    expect(has(bridge, 'W') && has(bridge, 'P')).toBe(true);
    const y = Math.floor(castle.tee[1]);
    expect(Math.max(...castle.heights[y])).toBeGreaterThan(castle.heights[y][0]);
  });

  it.each(bw.map((h) => [h.name, h] as const))('%s has no hole-in-one aimed straight at the cup (±6°)', (_n, hole) => {
    expect(directOutcomes(hole, 6)).not.toContain('holed');
  });

  it.each(bw.map((h) => [h.name, h] as const))('%s is solvable in par', (_name, hole) => {
    const shots = SOLUTIONS[hole.name];
    expect(shots.length).toBeLessThanOrEqual(hole.par);
    let ball = restingBall(hole, hole.tee);
    const outcomes = shots.map(([deg, power]) => {
      const r = simulateShot(hole, ball, (deg * Math.PI) / 180, power);
      ball = r.ball;
      return r.outcome;
    });
    expect(outcomes.slice(0, -1).every((o) => o === 'stopped')).toBe(true);
    expect(outcomes.at(-1)).toBe('holed');
  });
});

describe('fixtures', () => {
  it('list every course hole once, in play order', async () => {
    const names = await Promise.all(COURSE_IDS.map(async (id) => {
      const c = await loadCourseDef(id);
      return courseHoles(c, parseManifest(c.manifest)).map((h) => h.name);
    }));
    expect(COURSE_SOLUTIONS).toEqual(Object.fromEntries(COURSE_IDS.map((id, i) => [id, names[i]])));
    for (const n of names.flat()) expect(SOLUTIONS[n], n).toBeDefined();
  });
});
