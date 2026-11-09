import './style.css';
import { BUF_H, BUF_W, loadContent, type Content } from './content';
import { attachInput, type InputEvent } from './core/input';
import { createStepper, startLoop } from './core/loop';
import { loadBest, saveBest, totalStrokes, type KeyValueStore } from './game/score';
import { clearEvents, initialState, reduce, update, type Action, type GameState } from './game/state';
import { ambienceFor, soundsFor } from './audio/sfx-math';
import { createSfx } from './audio/sfx';
import { MAX_PUTT_SPEED, STEP } from './physics/constants';
import { unproject } from './render/iso';
import { buildPhaseTables, postProcess, type PhaseTables } from './render/post';
import { renderFrame } from './render/renderer';
import { PHASES, phaseFor, type PhaseId } from './render/time-of-day';
import { windStep } from './render/wind';
import { createHud, type Hud } from './ui/hud';

const LOAD_ERROR = "Couldn't load the Backyard — try refreshing";
const PHASE_CHECK_MS = 60_000;

function safeStorage(): KeyValueStore | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function fitCanvas(canvas: HTMLCanvasElement): void {
  const scale = Math.max(1, Math.floor(Math.min(window.innerWidth / BUF_W, window.innerHeight / BUF_H)));
  canvas.style.width = `${BUF_W * scale}px`;
  canvas.style.height = `${BUF_H * scale}px`;
}

const currentPhase = (): PhaseId => phaseFor(window.location.search, new Date().getHours());

function wireInput(canvas: HTMLCanvasElement, content: Content, getState: () => GameState | null, dispatch: (a: Action) => void): void {
  const onInput = (e: InputEvent) => {
    const state = getState();
    if (!state) return;
    if (e.type === 'escape') dispatch({ type: 'togglePause' });
    else if (e.type === 'aimAt') dispatch({ type: 'aimAt', point: unproject(content.perHole[state.holeIndex].view, e.sx, e.sy, state.ball.z) });
    else dispatch({ type: e.type });
  };
  attachInput(canvas, BUF_W, BUF_H, onInput);
  // A release that happens while the window is unfocused never arrives: drop the charge instead.
  window.addEventListener('blur', () => dispatch({ type: 'cancel' }));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) dispatch({ type: 'cancel' });
  });
}

function runGame(ctx: CanvasRenderingContext2D, content: Content, hud: Hud, canvas: HTMLCanvasElement): void {
  let state: GameState = initialState(content.holes);
  const dispatch = (a: Action) => {
    state = reduce(state, a, content.holes);
  };
  hud.setCallbacks({ onPlay: () => dispatch({ type: 'start' }), onResume: () => dispatch({ type: 'resume' }), onRestart: () => dispatch({ type: 'start' }) });
  wireInput(canvas, content, () => state, dispatch);

  const tables = new Map<PhaseId, PhaseTables>();
  const tablesFor = (id: PhaseId) => tables.get(id) ?? tables.set(id, buildPhaseTables(content.palette, PHASES[id])).get(id)!;
  let phase = currentPhase();
  document.body.dataset.phase = phase;

  const sfx = createSfx();
  const unlock = () => sfx.unlock();
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });
  sfx.setAmbience(ambienceFor(phase));

  window.setInterval(() => {
    phase = currentPhase();
    document.body.dataset.phase = phase;
    sfx.setAmbience(ambienceFor(phase));
  }, PHASE_CHECK_MS);

  const storage = safeStorage();
  let best = loadBest(storage);
  let prevKind = state.phase.kind;
  let time = 0;
  const steps = createStepper(STEP);

  const frame = (dt: number) => {
    // The first rAF timestamp can predate the loop's start, giving a slightly negative dt.
    time += Math.max(0, dt);
    const n = steps(dt);
    for (let i = 0; i < n; i++) state = update(state, STEP, content.holes);
    if (state.phase.kind === 'scorecard' && prevKind !== 'scorecard') best = saveBest(storage, totalStrokes(state.strokes));
    if (prevKind === 'charging' && state.phase.kind === 'rolling') {
      sfx.putt(Math.hypot(state.ball.vx, state.ball.vy) / MAX_PUTT_SPEED);
    }
    prevKind = state.phase.kind;
    for (const s of soundsFor(state.events)) sfx.play(s);
    sfx.setRoll(state.phase.kind === 'rolling' && !state.ball.airborne ? Math.hypot(state.ball.vx, state.ball.vy) : 0);
    const h = content.perHole[state.holeIndex];
    const look = PHASES[phase];
    const wind = windStep(time);
    renderFrame(ctx, {
      state, hole: h.hole, view: h.view, terrain: h.terrain[wind], manifest: content.manifest,
      sprites: content.sprites, golfer: content.golfer, look, time, wind, width: BUF_W, height: BUF_H,
    });
    postProcess(ctx, BUF_W, BUF_H, content.palette.lut, tablesFor(phase), look.lamps ? h.light : null);
    hud.update(state, content.holes, best);
    // Ball events accumulate across this frame's substeps; once read (audio, Task 19), drop them.
    state = clearEvents(state);
  };
  const stop = startLoop((dt) => {
    try {
      frame(dt);
    } catch (err) {
      console.error('Game loop stopped after an error:', err);
      hud.showError(LOAD_ERROR);
      stop();
    }
  });

  if (import.meta.env.DEV) {
    (window as unknown as { __minigolf: unknown }).__minigolf = {
      getState: () => state,
      putt: (angle: number, power: number) => dispatch({ type: 'putt', angle, power }),
    };
  }
}

async function boot(): Promise<void> {
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const hud = createHud(document.getElementById('hud') as HTMLElement);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    console.error('2D canvas is not available');
    hud.showError(LOAD_ERROR);
    return;
  }
  fitCanvas(canvas);
  window.addEventListener('resize', () => fitCanvas(canvas));
  try {
    runGame(ctx, await loadContent(), hud, canvas);
  } catch (err) {
    console.error('Failed to load course data:', err);
    hud.showError(LOAD_ERROR);
  }
}

void boot();
