import { distance } from '../core/geometry';
import { crossedLip, groundZ, hasLanded, launch, stepAir, touchDown } from '../sim/air';
import { canCrash, crash, stepGround, stepTumble, type Board, type Controls } from '../sim/board';
import { BOARD, FLAKE, RUN } from '../sim/constants';
import { crossGates } from '../sim/gates';
import { hitHazard, hitsRider, riderPos, wakes } from '../sim/hazards';
import { isCleanLanding, trickOf } from '../sim/tricks';
import type { Slope } from '../world/slope';
import { emit, type GameEvent } from './events';
import { timeBonus } from './score';
import type { GameState } from './state';

type Step = (s: GameState, slope: Slope, prev: Board) => GameState;

function moveBoard(s: GameState, slope: Slope, controls: Controls, dt: number): GameState {
  const b = s.board;
  if (b.tumble > 0) return { ...s, board: stepTumble(b, dt) };
  if (b.air) return { ...s, board: stepAir(b, controls, dt) };
  const g = stepGround(b, controls, dt);
  return { ...s, board: { ...g, z: groundZ(slope.ramps, g.c, g.d) } };
}

const crashed = (s: GameState, event: GameEvent): GameState =>
  emit({ ...s, board: crash(s.board), crashes: s.crashes + 1 }, event);

const ramps: Step = (s, slope, prev) => {
  if (s.board.air || s.board.tumble > 0) return s;
  return slope.ramps.some((r) => crossedLip(r, prev.d, s.board)) ? emit({ ...s, board: launch(s.board) }, { type: 'launch' }) : s;
};

/** Settles an airborne board onto the snow: scores a clean landing; a dirty one wipes out (tumbling only when `tumbles`). */
function settle(s: GameState, tumbles: boolean): GameState {
  const b = s.board;
  if (!b.air) return s;
  if (!isCleanLanding(b.air.spin)) {
    return tumbles
      ? crashed(s, { type: 'wipeout' })
      : emit({ ...s, board: touchDown(b), crashes: s.crashes + 1 }, { type: 'wipeout' });
  }
  const trick = trickOf(b.air.spin, b.air.grab);
  const bestTrick = trick && (!s.bestTrick || trick.points > s.bestTrick.points) ? trick : s.bestTrick;
  return emit(
    { ...s, board: touchDown(b), score: s.score + (trick?.points ?? 0), tricks: s.tricks + (trick ? 1 : 0), bestTrick },
    { type: 'land', trick },
  );
}

const landing: Step = (s) => (hasLanded(s.board) ? settle(s, true) : s);

const hazards: Step = (s, slope) => {
  const b = s.board;
  if (!canCrash(b)) return s;
  const i = hitHazard(slope.hazards, b.c, b.d, b.z, s.burst);
  if (i < 0) return s;
  const h = slope.hazards[i];
  const hit = crashed(s, { type: 'crash', what: h.kind });
  return h.kind === 'snowman' ? emit({ ...hit, burst: [...hit.burst, i] }, { type: 'burst', at: h.at }) : hit;
};

const riders: Step = (s, slope) => {
  const started = slope.riders.map((r, i) => s.riders[i] ?? (wakes(r, s.board.d) ? s.time : null));
  const next = started.every((v, i) => v === s.riders[i]) ? s : { ...s, riders: started };
  const b = next.board;
  if (!canCrash(b)) return next;
  const at = slope.riders.map((r, i) => riderPos(r, started[i], next.time));
  return hitsRider(at, b.c, b.d, b.z) ? crashed(next, { type: 'crash', what: 'rider' }) : next;
};

const gates: Step = (s, slope) => {
  const { progress, results } = crossGates(slope.gates, s.gates, s.board.d, s.board.c);
  if (results.length === 0) return s;
  const points = results.reduce((n, r) => n + (r.kind === 'pass' ? r.points : 0), 0);
  const events = results.map((r): GameEvent => (r.kind === 'pass' ? { type: 'gate', points: r.points, streak: r.streak } : { type: 'miss' }));
  return emit({ ...s, gates: progress, score: s.score + points }, ...events);
};

const flakes: Step = (s, slope) => {
  const b = s.board;
  const got = slope.flakes.flatMap((f, i) => (!s.flakes.includes(i) && distance(f, [b.c, b.d]) <= FLAKE.radius + BOARD.radius ? [i] : []));
  if (got.length === 0) return s;
  return emit({ ...s, flakes: [...s.flakes, ...got], score: s.score + got.length * FLAKE.points }, ...got.map((): GameEvent => ({ type: 'flake' })));
};

const finish: Step = (s, slope) => {
  if (s.board.d < slope.finish) return s;
  const bonus = timeBonus(s.time, slope.par);
  const landed = settle(s, false);
  return emit(
    { ...landed, phase: 'runout', clock: RUN.runout, finishTime: s.time, bonus, score: landed.score + bonus },
    { type: 'finish', time: s.time, bonus },
  );
};

const STEPS: readonly Step[] = [ramps, landing, hazards, riders, gates, flakes, finish];

/** One fixed sim step of a run in progress. Later steps are skipped once the phase changes. */
export function tick(s: GameState, slope: Slope, controls: Controls, dt: number): GameState {
  const prev = s.board;
  const moved = moveBoard({ ...s, time: s.time + dt }, slope, controls, dt);
  return STEPS.reduce((acc, step) => (acc.phase === 'riding' ? step(acc, slope, prev) : acc), moved);
}
