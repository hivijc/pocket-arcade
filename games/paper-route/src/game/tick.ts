import { distance } from '../core/geometry';
import { canCrash, crash, slowDown, stepBike, type Controls } from '../sim/bike';
import { BIKE_R, BUNDLE_R, FINISH_MARGIN, PAPERS, POINTS, PUDDLE, SPRINKLER } from '../sim/constants';
import { carHits, dogBites, dogTakesTreat, inPuddle, inSpray, sitDog, stepDog } from '../sim/hazards';
import { hasLanded, mailboxHit, paperPos, porchHit, stepPaper, type PaperPos } from '../sim/paper';
import type { Lot, Street } from '../world/street';
import { deliveryPoints, finishBonus, type Delivery } from './score';
import { emit, type GameState } from './state';

type Step = (s: GameState, street: Street, dt: number) => GameState;

function deliver(s: GameState, lot: Lot, hit: Delivery): GameState {
  if (s.hitLots.includes(lot.index)) return emit(s, { type: 'thunk' });
  const points = deliveryPoints(lot, hit);
  const base = { ...s, hitLots: [...s.hitLots, lot.index], score: s.score + points };
  return lot.subscriber
    ? emit({ ...base, delivered: s.delivered + 1 }, { type: 'deliver', hit, lot: lot.index, points })
    : emit(base, { type: 'wrong', lot: lot.index, points });
}

function landPaper(s: GameState, street: Street, pos: PaperPos): GameState {
  const landed = { ...s, landed: [...s.landed, [pos.c, pos.s] as const] };
  const porch = porchHit(street.lots, pos);
  if (porch) return deliver(landed, porch, 'porch');
  if (dogTakesTreat(s.dog, pos)) return emit({ ...landed, dog: sitDog(s.dog), score: s.score + POINTS.dog }, { type: 'treat', points: POINTS.dog });
  return emit(landed, { type: 'land' });
}

const stepPapers: Step = (s, street, dt) =>
  s.flying.reduce<GameState>((acc, p0) => {
    const p = stepPaper(p0, dt);
    const pos = paperPos(p);
    const box = mailboxHit(street.lots, pos);
    if (box) return deliver(acc, box, 'mailbox');
    return hasLanded(p) ? landPaper(acc, street, pos) : { ...acc, flying: [...acc.flying, p] };
  }, { ...s, flying: [] });

const stepPickups: Step = (s, street) =>
  street.bundles.reduce<GameState>((acc, at, i) => {
    if (acc.bundlesTaken.includes(i) || distance(at, [acc.bike.c, acc.bike.s]) > BUNDLE_R + BIKE_R) return acc;
    return emit({ ...acc, bundlesTaken: [...acc.bundlesTaken, i], papers: Math.min(PAPERS.max, acc.papers + PAPERS.bundle) }, { type: 'pickup' });
  }, s);

const stepPuddles: Step = (s, street) => {
  const wet = street.hazards.some((h) => h.kind === 'puddle' && inPuddle(h.at, s.bike));
  if (!wet) return s.inPuddle ? { ...s, inPuddle: false } : s;
  const next = { ...s, inPuddle: true, bike: slowDown(s.bike, PUDDLE.slowTime) };
  return s.inPuddle ? next : emit(next, { type: 'splash' });
};

const stepSprinklers: Step = (s, street) => {
  const sprayed = street.hazards.some((h) => h.kind === 'sprinkler' && inSpray(h.spray, s.bike, s.time));
  if (!sprayed) return s.inSpray ? { ...s, inSpray: false } : s;
  const next = { ...s, inSpray: true, bike: slowDown(s.bike, SPRINKLER.slowTime) };
  return s.inSpray ? next : emit(next, { type: 'spray' });
};

function crashed(s: GameState): GameState {
  const helmets = s.helmets - 1;
  const hurt = emit({ ...s, helmets, bike: crash(s.bike) }, { type: 'crash' });
  return helmets > 0 ? hurt : emit({ ...hurt, phase: 'over', outcome: 'wiped' }, { type: 'wiped' });
}

const stepDogStep: Step = (s, street, dt) => {
  const dog = stepDog(s.dog, street.dogHome, s.bike, dt);
  const next = s.dog.mode === 'home' && dog.mode === 'chase' ? emit({ ...s, dog }, { type: 'bark' }) : { ...s, dog };
  if (!dogBites(dog, next.bike) || !canCrash(next.bike)) return next;
  // The dog is done after a bite; it heads home instead of re-biting the slowed bike.
  return crashed({ ...next, dog: { ...next.dog, mode: 'return' } });
};

const stepCars: Step = (s, street) =>
  canCrash(s.bike) && street.hazards.some((h) => h.kind === 'car' && carHits(h.at, s.bike)) ? crashed(s) : s;

const checkFinish: Step = (s, street) => {
  if (s.bike.s < street.length - FINISH_MARGIN) return s;
  const bonus = finishBonus(s.delivered, street.lots.filter((l) => l.subscriber).length, s.papers + s.flying.length);
  return emit({ ...s, phase: 'over', outcome: 'finished', score: s.score + bonus }, { type: 'finish', bonus });
};

const STEPS: readonly Step[] = [stepPapers, stepPickups, stepPuddles, stepSprinklers, stepDogStep, stepCars, checkFinish];

/** One fixed sim step of a running game. Later steps are skipped once the run is over. */
export function tick(s: GameState, street: Street, dt: number, controls: Controls): GameState {
  const moved = { ...s, time: s.time + dt, cooldown: Math.max(0, s.cooldown - dt), bike: stepBike(s.bike, controls, dt) };
  return STEPS.reduce((acc, step) => (acc.phase === 'riding' ? step(acc, street, dt) : acc), moved);
}
