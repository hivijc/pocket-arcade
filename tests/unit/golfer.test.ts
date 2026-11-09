import { describe, expect, it } from 'vitest';
import { STROKE_SECONDS, golferPose, screenDir } from '../../src/render/golfer-pose';
import { DIRS, PLACEHOLDER_ANIMS, parseGolfer } from '../../src/world/golfer';
import { initialState, type GameState } from '../../src/game/state';
import { makeHole } from '../helpers/makeHole';

const rows = Object.fromEntries(DIRS.map((d, i) => [d, i]));
const layoutRaw = {
  src: 'golfer.png', cell: [40, 44], anchor: [20, 43],
  anims: {
    idle: { frames: 4, fps: 6, rows },
    backswing: { frames: 6, fps: 1, rows },
    stroke: { frames: 6, fps: 12, rows },
    celebrate: { frames: 8, fps: 8, rows },
  },
};

describe('parseGolfer', () => {
  it('accepts a full layout', () => {
    const g = parseGolfer(layoutRaw);
    expect(g.cell).toEqual([40, 44]);
    expect(g.anims.stroke.rows.east).toBe(DIRS.indexOf('east'));
  });
  it('rejects a missing animation or direction', () => {
    const { celebrate: _c, ...noCelebrate } = layoutRaw.anims;
    expect(() => parseGolfer({ ...layoutRaw, anims: noCelebrate })).toThrow(/golfer: anims\.celebrate/);
    const { east: _e, ...noEast } = rows;
    expect(() => parseGolfer({ ...layoutRaw, anims: { ...layoutRaw.anims, idle: { frames: 4, fps: 6, rows: noEast } } }))
      .toThrow(/golfer: anims\.idle\.rows\.east/);
  });
  it('rejects bad numbers', () => {
    expect(() => parseGolfer({ ...layoutRaw, cell: [0, 44] })).toThrow(/golfer: cell/);
    expect(() => parseGolfer({ ...layoutRaw, src: 5 })).toThrow(/golfer: src/);
  });
});

describe('screenDir', () => {
  it.each([
    [0, 'south-east'], [Math.PI / 4, 'south'], [Math.PI / 2, 'south-west'], [(3 * Math.PI) / 4, 'west'],
    [Math.PI, 'north-west'], [-(3 * Math.PI) / 4, 'north'], [-Math.PI / 2, 'north-east'], [-Math.PI / 4, 'east'],
  ])('grid angle %f faces %s on screen', (angle, dir) => {
    expect(screenDir(angle)).toBe(dir);
  });
});

describe('golferPose', () => {
  const hole = makeHole({ width: 8, cup: [6.5, 0.5] });
  const anims = parseGolfer(layoutRaw).anims;
  const base = initialState([hole]);
  const at = (s: Partial<GameState>): GameState => ({ ...base, ...s });

  it('idles behind the ball while aiming, looping over time', () => {
    const p = golferPose(at({ phase: { kind: 'aiming' }, aim: 0 }), hole, anims, 0.5);
    expect(p?.anim).toBe('idle');
    expect(p?.frame).toBe(3); // floor(0.5 * 6) % 4
    expect(p?.at[0]).toBeLessThan(base.ball.x);
    expect(p?.facing).toBe('south-east');
  });
  it('scrubs the backswing with the charged power', () => {
    expect(golferPose(at({ phase: { kind: 'charging', t: 1 } }), hole, anims, 0)).toMatchObject({ anim: 'backswing', frame: 5 });
    expect(golferPose(at({ phase: { kind: 'charging', t: 0 } }), hole, anims, 0)).toMatchObject({ anim: 'backswing', frame: 0 });
    expect(golferPose(at({ phase: { kind: 'dragging', power: 1 } }), hole, anims, 0)).toMatchObject({ anim: 'backswing', frame: 5 });
    expect(golferPose(at({ phase: { kind: 'dragging', power: 0 } }), hole, anims, 0)).toMatchObject({ anim: 'backswing', frame: 0 });
  });
  it('plays the stroke right after release, then idles while the ball rolls', () => {
    expect(golferPose(at({ phase: { kind: 'rolling', t: 0 } }), hole, anims, 0)?.anim).toBe('stroke');
    expect(golferPose(at({ phase: { kind: 'rolling', t: STROKE_SECONDS * 0.99 } }), hole, anims, 0)?.frame).toBe(5);
    const s = at({ phase: { kind: 'rolling', t: STROKE_SECONDS }, aim: 0, lastRest: [3, 2.5], ball: { ...base.ball, x: 5, y: 2.5 } });
    const p = golferPose(s, hole, anims, 0.5);
    expect(p).toMatchObject({ anim: 'idle', frame: 3, facing: 'south-east' });
    expect(p?.at[0]).toBeCloseTo(2.7);
    expect(p?.at[1]).toBeCloseTo(2.5);
  });
  it('celebrates when holed and is absent on menus', () => {
    expect(golferPose(at({ phase: { kind: 'holed', t: 0.3, label: 'Par' } }), hole, anims, 0)?.anim).toBe('celebrate');
    expect(golferPose(at({ phase: { kind: 'title' } }), hole, anims, 0)).toBeNull();
  });
  it('stands behind the ball mid-hole', () => {
    const p = golferPose(at({ phase: { kind: 'aiming' }, aim: -Math.PI / 2, ball: { ...base.ball, x: 3, y: 2.5 } }), hole, anims, 0);
    expect(p?.at[0]).toBeCloseTo(3);
    expect(p?.at[1]).toBeCloseTo(2.8);
  });
  it('steps in front of the ball rather than off the island at a fence', () => {
    const p = golferPose(at({ phase: { kind: 'aiming' }, aim: -Math.PI / 2, ball: { ...base.ball, x: 3, y: 4.9 } }), hole, anims, 0);
    expect(p?.at[0]).toBeCloseTo(3);
    expect(p?.at[1]).toBeCloseTo(4.6);
    expect(p?.at[1]).toBeLessThan(hole.depth);
  });
  it('falls back to the ball position when neither side is on the course', () => {
    const p = golferPose(at({ phase: { kind: 'aiming' }, aim: 0, ball: { ...base.ball, x: -5, y: 2.5 } }), hole, anims, 0);
    expect(p?.at).toEqual([-5, 2.5]);
  });
  it('works with the placeholder layout', () => {
    expect(golferPose(at({ phase: { kind: 'charging', t: 0.7 } }), hole, PLACEHOLDER_ANIMS, 0)?.frame).toBe(0);
  });
});
