import { describe, expect, it } from 'vitest';
import {
  HOLED_SECONDS, INTRO_SECONDS, chargePower, initialState, reduce, update, type GameState,
} from '../../src/game/state';
import { STEP } from '../../src/physics/constants';
import type { Hole } from '../../src/world/hole';
import { makeHole } from '../helpers/makeHole';

// Cup 2 tiles straight ahead of the tee: angle 0, power 0.45 drops in.
const HOLES: Hole[] = [
  makeHole({ width: 8, cup: [3.5, 2.5], par: 2 }),
  makeHole({ width: 8, cup: [3.5, 2.5], par: 3 }),
];
const SINK = { angle: 0, power: 0.45 };

function runUntil(s: GameState, pred: (s: GameState) => boolean, holes = HOLES, max = 10_000): GameState {
  let cur = s;
  for (let i = 0; i < max; i++) {
    if (pred(cur)) return cur;
    cur = update(cur, STEP, holes);
  }
  throw new Error('condition never reached');
}
const kind = (k: string) => (s: GameState) => s.phase.kind === k;
const aimingOn = (holes = HOLES) => runUntil(reduce(initialState(holes), { type: 'start' }, holes), kind('aiming'), holes);

describe('chargePower', () => {
  it('rises to full then falls back', () => {
    expect(chargePower(0)).toBe(0);
    expect(chargePower(0.5)).toBeCloseTo(0.5);
    expect(chargePower(1)).toBeCloseTo(1);
    expect(chargePower(1.5)).toBeCloseTo(0.5);
    expect(chargePower(2)).toBeCloseTo(0);
  });
});

describe('flow', () => {
  it('starts on the title', () => {
    const s = initialState(HOLES);
    expect(s.phase.kind).toBe('title');
    expect(s.strokes).toEqual([0]);
  });

  it('start shows the intro, then aiming after the intro time', () => {
    const s = reduce(initialState(HOLES), { type: 'start' }, HOLES);
    expect(s.phase.kind).toBe('intro');
    expect(update(s, INTRO_SECONDS / 2, HOLES).phase.kind).toBe('intro');
    expect(update(s, INTRO_SECONDS, HOLES).phase.kind).toBe('aiming');
  });

  it('press on the title also starts a game', () => {
    expect(reduce(initialState(HOLES), { type: 'press' }, HOLES).phase.kind).toBe('intro');
  });

  it('press charges, release putts with the charged power', () => {
    const aiming = reduce(aimingOn(), { type: 'aim', angle: 0 }, HOLES);
    const charging = reduce(aiming, { type: 'press' }, HOLES);
    expect(charging.phase.kind).toBe('charging');
    const later = update(charging, 0.5, HOLES);
    const rolling = reduce(later, { type: 'release' }, HOLES);
    expect(rolling.phase.kind).toBe('rolling');
    expect(rolling.strokes[0]).toBe(1);
    expect(rolling.lastRest).toEqual(HOLES[0].tee);
    expect(rolling.ball.vx).toBeGreaterThan(0);
  });

  it('release without charging does nothing', () => {
    const s = aimingOn();
    expect(reduce(s, { type: 'release' }, HOLES)).toBe(s);
  });

  it('a hole in one shows the label, then moves to the next hole', () => {
    const rolling = reduce(aimingOn(), { type: 'putt', ...SINK }, HOLES);
    const holed = runUntil(rolling, kind('holed'));
    expect(holed.phase.kind === 'holed' && holed.phase.label).toBe('Hole in one!');
    expect(holed.events).toContain('holed');
    expect(update(holed, HOLED_SECONDS / 2, HOLES).phase.kind).toBe('holed');
    const next = update(holed, HOLED_SECONDS, HOLES);
    expect(next.phase.kind).toBe('intro');
    expect(next.holeIndex).toBe(1);
    expect(next.strokes).toEqual([1, 0]);
    expect([next.ball.x, next.ball.y]).toEqual(HOLES[1].tee);
  });

  it('shows the scorecard after the last hole', () => {
    let s = reduce(aimingOn(), { type: 'putt', ...SINK }, HOLES);
    s = runUntil(s, (x) => x.holeIndex === 1 && x.phase.kind === 'aiming');
    s = reduce(s, { type: 'putt', ...SINK }, HOLES);
    s = runUntil(s, kind('scorecard'));
    expect(s.strokes).toEqual([1, 1]);
  });

  it('a short putt stops and returns to aiming', () => {
    const s = runUntil(reduce(aimingOn(), { type: 'putt', angle: 0, power: 0.1 }, HOLES), kind('aiming'));
    expect(s.strokes[0]).toBe(1);
    expect(s.ball.x).toBeGreaterThan(HOLES[0].tee[0]);
  });
});

describe('penalties', () => {
  const WATER: Hole[] = [makeHole({ width: 12, rows: ['GGGGGGGGGGGG', 'GGGGGGGGGGGG', 'GGGGWWWGGGGG', 'GGGGGGGGGGGG', 'GGGGGGGGGGGG'], cup: [10.5, 2.5] })];

  it('water costs a stroke and puts the ball back where it was struck', () => {
    const s = runUntil(reduce(aimingOn(WATER), { type: 'putt', angle: 0, power: 0.6 }, WATER), kind('aiming'), WATER);
    expect(s.strokes[0]).toBe(2);
    expect([s.ball.x, s.ball.y]).toEqual(WATER[0].tee);
  });

  it('retry costs a stroke and returns the ball to the tee', () => {
    const moved = runUntil(reduce(aimingOn(), { type: 'putt', angle: 0, power: 0.1 }, HOLES), kind('aiming'));
    const retried = reduce(moved, { type: 'retry' }, HOLES);
    expect(retried.strokes[0]).toBe(2);
    expect([retried.ball.x, retried.ball.y]).toEqual(HOLES[0].tee);
    expect(retried.phase.kind).toBe('aiming');
  });

  it('retry is ignored while the ball rolls', () => {
    const rolling = reduce(aimingOn(), { type: 'putt', angle: 0, power: 0.5 }, HOLES);
    expect(reduce(rolling, { type: 'retry' }, HOLES)).toBe(rolling);
  });

  it('a hole ends at the stroke cap', () => {
    let s = aimingOn();
    for (let i = 0; i < 6; i++) s = reduce(s, { type: 'retry' }, HOLES);
    expect(s.phase.kind).toBe('holed');
    expect(s.strokes[0]).toBe(6);
    expect(s.phase.kind === 'holed' && s.phase.label).toBe('+4');
  });
});

describe('pause and cancel', () => {
  const charging = () => reduce(aimingOn(), { type: 'press' }, HOLES);

  it('starts unpaused', () => {
    expect(initialState(HOLES).paused).toBe(false);
  });

  it('togglePause pauses and unpauses during play', () => {
    const paused = reduce(aimingOn(), { type: 'togglePause' }, HOLES);
    expect(paused.paused).toBe(true);
    expect(reduce(paused, { type: 'togglePause' }, HOLES).paused).toBe(false);
  });

  it('pausing while charging drops the charge back to aiming', () => {
    const paused = reduce(charging(), { type: 'togglePause' }, HOLES);
    expect(paused.paused).toBe(true);
    expect(paused.phase.kind).toBe('aiming');
    const resumed = reduce(paused, { type: 'resume' }, HOLES);
    expect(resumed.paused).toBe(false);
    expect(resumed.phase.kind).toBe('aiming');
    expect(reduce(resumed, { type: 'release' }, HOLES)).toBe(resumed);
  });

  it('togglePause is ignored on the title and scorecard', () => {
    const title = initialState(HOLES);
    expect(reduce(title, { type: 'togglePause' }, HOLES)).toBe(title);
    const card: GameState = { ...title, phase: { kind: 'scorecard' } };
    expect(reduce(card, { type: 'togglePause' }, HOLES)).toBe(card);
  });

  it('while paused, update changes nothing and play actions are ignored', () => {
    const rolling = reduce(aimingOn(), { type: 'putt', angle: 0, power: 0.5 }, HOLES);
    const paused = reduce(rolling, { type: 'togglePause' }, HOLES);
    expect(update(paused, STEP, HOLES)).toBe(paused);
    const aimingPaused = reduce(aimingOn(), { type: 'togglePause' }, HOLES);
    for (const a of [{ type: 'press' }, { type: 'release' }, { type: 'retry' }, { type: 'cancel' }, { type: 'aim', angle: 1 }, { type: 'putt', angle: 0, power: 1 }] as const) {
      expect(reduce(aimingPaused, a, HOLES)).toBe(aimingPaused);
    }
  });

  it('resume is a no-op when not paused', () => {
    const s = aimingOn();
    expect(reduce(s, { type: 'resume' }, HOLES)).toBe(s);
  });

  it('start clears paused', () => {
    const paused = reduce(aimingOn(), { type: 'togglePause' }, HOLES);
    const s = reduce(paused, { type: 'start' }, HOLES);
    expect(s.paused).toBe(false);
    expect(s.phase.kind).toBe('intro');
  });

  it('cancel turns charging back into aiming and otherwise does nothing', () => {
    expect(reduce(charging(), { type: 'cancel' }, HOLES).phase.kind).toBe('aiming');
    const s = aimingOn();
    expect(reduce(s, { type: 'cancel' }, HOLES)).toBe(s);
  });
});
