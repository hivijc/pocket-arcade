import { describe, expect, it } from 'vitest';
import { NO_CONTROLS, type Controls } from '../../src/sim/bike';
import { STEP } from '../../src/sim/constants';
import { clearEvents, initialState, newRun, reduce, type GameEvent, type GameState } from '../../src/game/state';
import { parseStreet, type Street } from '../../src/world/street';
import { rawStreet } from '../helpers/make-street';

const plain = parseStreet(rawStreet());
const withHazards = (hazards: unknown[]) => parseStreet(rawStreet({ hazards: [...hazards, { kind: 'dog', home: [12, 30] }] }));

function ride(s: GameState, street: Street, seconds: number, controls: Controls = NO_CONTROLS): GameState {
  let out = s;
  for (let i = 0; i < Math.round(seconds / STEP); i++) out = reduce(out, { type: 'tick', dt: STEP, controls }, street);
  return out;
}
const at = (s: GameState, c: number, pos: number): GameState => ({ ...s, bike: { ...s.bike, c, s: pos } });
const count = (s: GameState, type: GameEvent['type']) => s.events.filter((e) => e.type === type).length;

describe('flow', () => {
  it('starts on the title and begins a run on start', () => {
    const t = initialState(plain);
    expect(t.phase).toBe('title');
    const r = reduce(t, { type: 'start' }, plain);
    expect(r.phase).toBe('riding');
    expect(reduce(r, { type: 'start' }, plain)).toBe(r);
    expect(reduce(t, { type: 'restart' }, plain)).toBe(t);
  });
  it('does nothing while on the title or paused', () => {
    const t = initialState(plain);
    expect(ride(t, plain, 0.5)).toBe(t);
    const p = reduce(newRun(plain), { type: 'togglePause' }, plain);
    expect(p.paused).toBe(true);
    expect(ride(p, plain, 0.5)).toBe(p);
    expect(reduce(p, { type: 'toss', side: 'L' }, plain)).toBe(p);
    expect(reduce(p, { type: 'togglePause' }, plain).paused).toBe(false);
  });
  it('restarts a finished or running game fresh', () => {
    const r = ride(newRun(plain), plain, 1);
    const fresh = reduce({ ...r, score: 999 }, { type: 'restart' }, plain);
    expect(fresh.phase).toBe('riding');
    expect(fresh.score).toBe(0);
    expect(fresh.bike.s).toBe(2);
  });
});

describe('tossing', () => {
  it('throws a paper with a cooldown', () => {
    const r = reduce(newRun(plain), { type: 'toss', side: 'L' }, plain);
    expect(r.papers).toBe(9);
    expect(r.throws).toBe(1);
    expect(r.flying).toHaveLength(1);
    expect(count(r, 'toss')).toBe(1);
    expect(reduce(r, { type: 'toss', side: 'R' }, plain)).toBe(r);
    const later = ride(r, plain, 0.4);
    expect(reduce(later, { type: 'toss', side: 'R' }, plain).papers).toBe(8);
  });
  it('makes a dry sound with no papers left', () => {
    const r = reduce({ ...newRun(plain), papers: 0 }, { type: 'toss', side: 'L' }, plain);
    expect(r.flying).toHaveLength(0);
    expect(count(r, 'dry')).toBe(1);
  });
  it('delivers to a subscriber porch', () => {
    const r = ride(reduce(at(newRun(plain), 6, 10), { type: 'toss', side: 'L' }, plain), plain, 0.7);
    expect(r.score).toBe(250);
    expect(r.delivered).toBe(1);
    expect(r.hitLots).toEqual([0]);
    expect(r.landed).toHaveLength(1);
    expect(r.events).toContainEqual({ type: 'deliver', hit: 'porch', lot: 0, points: 250 });
  });
  it('delivers into a subscriber mailbox mid-flight', () => {
    const r = ride(reduce(at(newRun(plain), 6, 10 - 1.23), { type: 'toss', side: 'L' }, plain), plain, 0.7);
    expect(r.score).toBe(500);
    expect(r.landed).toHaveLength(0);
    expect(r.events).toContainEqual({ type: 'deliver', hit: 'mailbox', lot: 0, points: 500 });
  });
  it('charges for a non-subscriber and counts each house once', () => {
    const r = ride(reduce(at(newRun(plain), 8, 10), { type: 'toss', side: 'R' }, plain), plain, 0.7);
    expect(r.score).toBe(-100);
    expect(r.delivered).toBe(0);
    expect(count(r, 'wrong')).toBe(1);
    const again = ride(reduce(at({ ...newRun(plain), hitLots: [0], score: 250 }, 6, 10), { type: 'toss', side: 'L' }, plain), plain, 0.7);
    expect(again.score).toBe(250);
    expect(count(again, 'thunk')).toBe(1);
  });
  it('gives the dog a treat', () => {
    const s = { ...at(newRun(plain), 8, 20), dog: { c: 11.5, s: 21.8, mode: 'home' as const, timer: 0 } };
    const r = ride(reduce(s, { type: 'toss', side: 'R' }, plain), plain, 0.7);
    expect(r.dog.mode).toBe('sit');
    expect(r.score).toBe(50);
    expect(count(r, 'treat')).toBe(1);
  });
});

describe('toss edge cases', () => {
  it('refuses a toss during the crash wobble', () => {
    const wobbling = { ...newRun(plain), bike: { ...newRun(plain).bike, wobble: 0.5 } };
    expect(reduce(wobbling, { type: 'toss', side: 'L' }, plain)).toBe(wobbling);
  });
  it('gives a thunk and no score for a mailbox on an already-hit lot', () => {
    const s = { ...at(newRun(plain), 6, 10 - 1.23), hitLots: [0], score: 250 };
    const r = ride(reduce(s, { type: 'toss', side: 'L' }, plain), plain, 0.7);
    expect(r.score).toBe(250);
    expect(count(r, 'thunk')).toBe(1);
    expect(r.delivered).toBe(0);
  });
  it.each(['L', 'R'] as const)('lands a paper on plain ground (%s side)', (side) => {
    const r = ride(reduce(at(newRun(plain), 6, 20), { type: 'toss', side }, plain), plain, 0.7);
    expect(count(r, 'land')).toBe(1);
    expect(r.landed).toHaveLength(1);
    expect(r.score).toBe(0);
  });
});

describe('events', () => {
  it('clearEvents keeps the same object when empty and empties otherwise', () => {
    const empty = newRun(plain);
    expect(clearEvents(empty)).toBe(empty);
    const noisy = reduce(empty, { type: 'toss', side: 'L' }, plain);
    expect(noisy.events).not.toHaveLength(0);
    const cleared = clearEvents(noisy);
    expect(cleared.events).toEqual([]);
    expect(cleared.papers).toBe(noisy.papers);
  });
  it('ignores togglePause on the title', () => {
    const t = initialState(plain);
    expect(reduce(t, { type: 'togglePause' }, plain)).toBe(t);
  });
});

describe('hazards and pickups', () => {
  it('picks up a bundle once, capped at 15 papers', () => {
    const r = ride({ ...at(newRun(plain), 7, 24.5), papers: 12 }, plain, 0.5);
    expect(r.papers).toBe(15);
    expect(r.bundlesTaken).toEqual([0]);
    expect(count(r, 'pickup')).toBe(1);
  });
  it('crashes into a car once, then is briefly invulnerable', () => {
    const street = withHazards([{ kind: 'car', at: [7, 15] }]);
    const r = ride(at(newRun(street), 7, 13), street, 2);
    expect(r.helmets).toBe(2);
    expect(count(r, 'crash')).toBe(1);
  });
  it('wipes out on the last helmet', () => {
    const street = withHazards([{ kind: 'car', at: [7, 15] }]);
    const r = ride({ ...at(newRun(street), 7, 13), helmets: 1 }, street, 1);
    expect(r.phase).toBe('over');
    expect(r.outcome).toBe('wiped');
    expect(count(r, 'wiped')).toBe(1);
  });
  it('splashes through a puddle once and slows down', () => {
    const street = withHazards([{ kind: 'puddle', at: [7, 15] }]);
    const r = ride(at(newRun(street), 7, 14), street, 0.4);
    expect(count(r, 'splash')).toBe(1);
    expect(r.bike.slow).toBeGreaterThan(0);
  });
  it('gets sprayed by a running sprinkler', () => {
    const street = withHazards([{ kind: 'sprinkler', at: [2, 15], spray: [4, 14, 6, 18] }]);
    const r = ride(at(newRun(street), 5, 14), street, 0.4);
    expect(count(r, 'spray')).toBe(1);
    expect(r.inSpray).toBe(true);
  });
  it('barks when the dog starts a chase and crashes when it bites', () => {
    const near = ride(at(newRun(plain), 7, 25), plain, STEP);
    expect(near.dog.mode).toBe('chase');
    expect(count(near, 'bark')).toBe(1);
    const bitten = ride({ ...at(newRun(plain), 7, 25), dog: { c: 7.2, s: 25.2, mode: 'chase', timer: 0 } }, plain, STEP);
    expect(bitten.helmets).toBe(2);
    expect(count(bitten, 'crash')).toBe(1);
    expect(bitten.bike.wobble).toBeGreaterThan(0);
  });
  it('costs only one helmet per dog chase', () => {
    const chasing = { ...at(newRun(plain), 7, 25), dog: { c: 7.2, s: 25.2, mode: 'chase' as const, timer: 0 } };
    const r = ride(chasing, plain, 4);
    expect(r.helmets).toBe(2);
    expect(count(r, 'crash')).toBe(1);
    expect(r.dog.mode).not.toBe('chase');
  });
});

describe('crash and finish together', () => {
  const car = (s: number) => withHazards([{ kind: 'car', at: [7, s] }]);
  it('still finishes after a non-fatal crash', () => {
    const street = car(plain.length - 4.5);
    const r = ride(at(newRun(street), 7, street.length - 5.5), street, 1.5);
    expect(count(r, 'crash')).toBe(1);
    expect(r.helmets).toBe(2);
    expect(r.outcome).toBe('finished');
  });
  it('is wiped, not finished, when a fatal crash lands on the finish tick', () => {
    const street = car(plain.length - 4);
    const r = ride({ ...at(newRun(street), 7, street.length - 4.01), helmets: 1 }, street, STEP);
    expect(r.outcome).toBe('wiped');
    expect(count(r, 'finish')).toBe(0);
    expect(count(r, 'wiped')).toBe(1);
  });
});

describe('finish', () => {
  it('counts papers still in the air toward the bonus', () => {
    const s = { ...at(newRun(plain), 7, plain.length - 4.1), papers: 3, delivered: 1, hitLots: [0] };
    const thrown = reduce(s, { type: 'toss', side: 'L' }, plain);
    const r = ride(thrown, plain, 0.1);
    expect(r.outcome).toBe('finished');
    expect(r.flying.length).toBeGreaterThan(0);
    expect(r.score).toBe(2000 + 3 * 25);
  });
  it('ends the run near the end of the street with the finish bonus', () => {
    const s = { ...at(newRun(plain), 7, plain.length - 4.1), delivered: 1, hitLots: [0], score: 250 };
    const r = ride(s, plain, 0.2);
    expect(r.phase).toBe('over');
    expect(r.outcome).toBe('finished');
    expect(r.score).toBe(250 + 2000 + 10 * 25);
    expect(r.events).toContainEqual({ type: 'finish', bonus: 2250 });
  });
});
