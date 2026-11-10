import { describe, expect, it } from 'vitest';
import { clearEvents, initialState, newRun, reduce, type GameState } from '../../src/game/state';
import type { Controls } from '../../src/sim/board';
import { STEP } from '../../src/sim/constants';
import type { Slope } from '../../src/world/slope';
import { makeSlope } from '../helpers/make-slope';

const NONE: Controls = { turn: 0, jump: false };
const tickFor = (s: GameState, slope: Slope, seconds: number, controls: Controls = NONE): GameState => {
  let out = s;
  for (let i = 0; i < Math.round(seconds / STEP); i++) out = reduce(out, { type: 'tick', dt: STEP, controls }, slope);
  return out;
};
const riding = (slope: Slope, over: Partial<GameState> = {}): GameState => ({ ...newRun(slope), phase: 'riding', clock: 0, events: [], ...over });
const types = (s: GameState) => s.events.map((e) => e.type);

describe('run flow', () => {
  const slope = makeSlope();
  it('starts on the title card and ignores ticks there', () => {
    const s = initialState(slope);
    expect(s.phase).toBe('title');
    expect(tickFor(s, slope, 1)).toEqual(s);
  });
  it('counts down 3, 2, 1, then goes', () => {
    const s = reduce(initialState(slope), { type: 'start' }, slope);
    expect(s.phase).toBe('countdown');
    expect(s.events).toEqual([{ type: 'beep', n: 3 }]);
    const later = tickFor(clearEvents(s), slope, 3.05);
    expect(later.events).toEqual([{ type: 'beep', n: 2 }, { type: 'beep', n: 1 }, { type: 'go' }]);
    expect(later.phase).toBe('riding');
    expect(later.board.d).toBeCloseTo(4, 1); // only a tick or two of riding after "go"
  });
  it('rides downhill and runs the clock', () => {
    const s = tickFor(riding(slope), slope, 2);
    expect(s.board.d).toBeGreaterThan(8);
    expect(s.time).toBeCloseTo(2);
  });
  it('pauses and resumes', () => {
    const p = reduce(riding(slope), { type: 'togglePause' }, slope);
    expect(p.paused).toBe(true);
    expect(tickFor(p, slope, 1)).toEqual(p);
    expect(reduce(p, { type: 'togglePause' }, slope).paused).toBe(false);
  });
  it('jumps on the title card to start, and ollies while riding', () => {
    expect(reduce(initialState(slope), { type: 'jump' }, slope).phase).toBe('countdown');
    const up = reduce(riding(slope), { type: 'jump' }, slope);
    expect(up.board.air?.kind).toBe('ollie');
    expect(types(up)).toEqual(['ollie']);
    expect(reduce(up, { type: 'jump' }, slope).events).toHaveLength(1);
  });
  it('restarts from anything but the title', () => {
    const s = tickFor(riding(slope), slope, 1);
    expect(reduce(s, { type: 'restart' }, slope).phase).toBe('countdown');
    expect(reduce(initialState(slope), { type: 'restart' }, slope).phase).toBe('title');
  });
});

describe('riding', () => {
  it('passes a gate and scores it', () => {
    const slope = makeSlope({ gates: [{ d: 12, c: [6, 10], color: 'blue' }] });
    const s = tickFor(riding(slope), slope, 3);
    expect(s.events).toContainEqual({ type: 'gate', points: 100, streak: 1 });
    expect(s.score).toBe(100);
    expect(s.gates.passed).toBe(1);
  });
  it('collects a snowflake once', () => {
    const slope = makeSlope({ flakes: [[8, 10]] });
    const s = tickFor(riding(slope), slope, 3);
    expect(s.flakes).toEqual([0]);
    expect(s.score).toBe(25);
    expect(types(s).filter((t) => t === 'flake')).toHaveLength(1);
  });
  it('crashes into a tree, tumbles and carries on', () => {
    const slope = makeSlope({ hazards: [{ kind: 'pine', at: [8, 10] }] });
    const s = tickFor(riding(slope), slope, 3);
    expect(s.events).toContainEqual({ type: 'crash', what: 'pine' });
    expect(s.crashes).toBe(1);
    expect(s.phase).toBe('riding');
  });
  it('bursts a snowman it hits, and the snowman is gone afterwards', () => {
    const slope = makeSlope({ hazards: [{ kind: 'snowman', at: [8, 10] }] });
    const s = tickFor(riding(slope), slope, 6);
    expect(s.burst).toEqual([0]);
    expect(types(s)).toContain('burst');
    expect(s.crashes).toBe(1);
  });
  it('launches off a kicker and lands clean', () => {
    const slope = makeSlope({ ramps: [{ d: 10, c: 8 }] });
    const s = tickFor(riding(slope), slope, 4);
    expect(types(s)).toContain('launch');
    expect(s.events).toContainEqual({ type: 'land', trick: null });
    expect(s.crashes).toBe(0);
  });
  it('scores a spin landed clean and remembers the best trick', () => {
    const slope = makeSlope({ ramps: [{ d: 10, c: 8 }] });
    let s = riding(slope);
    for (let i = 0; i < 600 && !s.board.air; i++) s = reduce(s, { type: 'tick', dt: STEP, controls: NONE }, slope);
    expect(s.board.air?.kind).toBe('ramp');
    // Spin until 360° (540°/s), then stop turning and let it land.
    while (s.board.air && Math.abs(s.board.air.spin) < 357) s = reduce(s, { type: 'tick', dt: STEP, controls: { turn: 1, jump: false } }, slope);
    s = tickFor(s, slope, 2);
    expect(s.bestTrick?.name).toBe('360');
    expect(s.score).toBe(300);
  });
  it('wipes out on a sideways landing', () => {
    const slope = makeSlope();
    const air = { kind: 'ollie' as const, t: 0.44, duration: 0.45, peak: 0.5, base: 0, spin: 90, grab: 0, grabbing: false };
    const s = tickFor(riding(slope, { board: { ...newRun(slope).board, speed: 5, air } }), slope, 0.05);
    expect(types(s)).toContain('wipeout');
    expect(s.board.tumble).toBeGreaterThan(0);
  });
  it('crashes into another rider once it wakes', () => {
    const slope = makeSlope({ riders: [{ look: 'skier-red', speed: 0.5, path: [[8, 12], [8, 30]] }] });
    const s = tickFor(riding(slope), slope, 4);
    expect(s.events).toContainEqual({ type: 'crash', what: 'rider' });
  });
});

describe('finish', () => {
  it('stops the clock at the line, pays the time bonus, runs out, then shows the end card', () => {
    const slope = makeSlope({ length: 60, finish: 20, par: 30 });
    let s = riding(slope);
    while (s.phase === 'riding') s = reduce(s, { type: 'tick', dt: STEP, controls: NONE }, slope);
    expect(s.phase).toBe('runout');
    const fin = s.events.find((e) => e.type === 'finish');
    expect(fin).toBeDefined();
    expect(s.finishTime).toBeCloseTo(s.time);
    expect(s.score).toBe(s.bonus);
    expect(s.bonus).toBeGreaterThan(0);
    const end = tickFor(s, slope, 1.6);
    expect(end.phase).toBe('over');
    expect(end.time).toBe(s.time);
    expect(reduce(end, { type: 'jump' }, slope).phase).toBe('countdown');
  });
});
