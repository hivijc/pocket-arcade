import './style.css';
import { BUF_H, BUF_W, loadContent, type Content } from './content';
import { attachInput, isUserActivation, type InputEvent } from './core/input';
import { dragShot } from './game/drag';
import { createStepper, startLoop } from './core/loop';
import { loadBest, saveBest, totalStrokes, type KeyValueStore } from './game/score';
import { clearEvents, initialState, reduce, update, type Action, type GameState } from './game/state';
import { audioTransition, rollSpeedOf, shouldPlayAudio, soundsFor } from './audio/sfx-math';
import { createSfx, type Sfx } from './audio/sfx';
import { MAX_PUTT_SPEED, STEP } from './physics/constants';
import { NO_EFFECTS, prune, spawnEffects, trackTrail, type Effects } from './render/effects';
import { unproject } from './render/iso';
import { parseHex } from './render/palette';
import { buildPhaseTables, postColor, postProcess, type PhaseTables } from './render/post';
import { BACKGROUND, renderFrame } from './render/renderer';
import { PHASES, phaseFor, type PhaseId } from './render/time-of-day';
import { windStep } from './render/wind';
import { createHud, type Hud } from './ui/hud';
import { canvasScale } from './ui/layout';

const LOAD_ERROR = "Couldn't load the Backyard — try refreshing";
const RUNTIME_ERROR = 'Something went wrong — try refreshing';
const PHASE_CHECK_MS = 60_000;

function safeStorage(): KeyValueStore | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Touch-first device (phone or tablet): slingshot hints, on-screen buttons, fractional fit on small screens. */
const isTouchDevice = (): boolean => window.matchMedia?.('(pointer: coarse)').matches ?? false;

function fitCanvas(canvas: HTMLCanvasElement): void {
  const scale = canvasScale(window.innerWidth, window.innerHeight, BUF_W, BUF_H, isTouchDevice());
  canvas.style.width = `${Math.floor(BUF_W * scale)}px`;
  canvas.style.height = `${Math.floor(BUF_H * scale)}px`;
}

const currentPhase = (): PhaseId => phaseFor(window.location.search, new Date().getHours());

/** Touch slingshot: preview the shot while dragging, drop it inside the dead zone, putt on release. */
function slingshotAction(e: Extract<InputEvent, { type: 'drag' | 'dragEnd' | 'dragCancel' }>, state: GameState, content: Content): Action | null {
  const dragging = state.phase.kind === 'dragging';
  if (e.type !== 'drag') return dragging ? { type: e.type === 'dragEnd' ? 'release' : 'cancel' } : null;
  const shot = dragShot(e.start, e.current, content.holeContent(state.holeIndex).view, state.ball);
  if (shot) return { type: 'drag', ...shot };
  return dragging ? { type: 'cancel' } : null;
}

function toAction(e: InputEvent, state: GameState, content: Content): Action | null {
  switch (e.type) {
    case 'escape':
      return { type: 'togglePause' };
    case 'aimAt':
      return { type: 'aimAt', point: unproject(content.holeContent(state.holeIndex).view, e.sx, e.sy, state.ball.z) };
    case 'drag':
    case 'dragEnd':
    case 'dragCancel':
      return slingshotAction(e, state, content);
    default:
      return { type: e.type };
  }
}

function wireInput(canvas: HTMLCanvasElement, stage: HTMLElement, content: Content, getState: () => GameState | null, dispatch: (a: Action) => void): void {
  const onInput = (e: InputEvent) => {
    const state = getState();
    const action = state && toAction(e, state, content);
    if (action) dispatch(action);
  };
  attachInput(canvas, BUF_W, BUF_H, onInput, stage);
  // A release that happens while the window is unfocused never arrives: drop the charge instead.
  window.addEventListener('blur', () => dispatch({ type: 'cancel' }));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) dispatch({ type: 'cancel' });
  });
}

interface GameAudio {
  readonly sfx: Sfx;
  /** Suspend or resume audio when the paused/hidden state has changed since the last call. */
  sync(): void;
}

function wireAudio(isPaused: () => boolean): GameAudio {
  const sfx = createSfx();
  let playing = true;
  const sync = () => {
    const now = shouldPlayAudio(isPaused(), document.hidden);
    const change = audioTransition(playing, now);
    playing = now;
    if (change === 'suspend') sfx.suspend();
    else if (change === 'resume') sfx.resume();
  };
  document.addEventListener('visibilitychange', sync);
  // Build the audio graph on the first press, and keep resuming it until an event the browser counts as user
  // activation arrives: on touch that is the pointerup/touchend, not the pointerdown.
  const kinds = ['pointerdown', 'pointerup', 'touchend', 'keydown'] as const;
  const unlock = (e: Event) => {
    sfx.unlock();
    if (playing) sfx.resume();
    else sfx.suspend();
    if (isUserActivation(e.type, (e as PointerEvent).pointerType)) {
      for (const k of kinds) window.removeEventListener(k, unlock, true);
    }
  };
  for (const k of kinds) window.addEventListener(k, unlock, true);
  return { sfx, sync };
}

/** Paints the page in the canvas backdrop's exact on-screen colour, so the game sits on one seamless background. */
function matchPageToCanvas(content: Content, phase: PhaseId): void {
  const [r, g, b] = postColor(content.palette, buildPhaseTables(content.palette, PHASES[phase]), parseHex(BACKGROUND));
  document.body.style.setProperty('--page', `rgb(${r},${g},${b})`);
}

/** Sets the current time-of-day phase now and on every check, reporting each to `onPhase`. */
function watchPhase(onPhase: (p: PhaseId) => void): void {
  const check = () => {
    const phase = currentPhase();
    document.body.dataset.phase = phase;
    onPhase(phase);
  };
  check();
  window.setInterval(check, PHASE_CHECK_MS);
}

function frameAudio(audio: GameAudio, prevKind: GameState['phase']['kind'], state: GameState): void {
  if ((prevKind === 'charging' || prevKind === 'dragging') && state.phase.kind === 'rolling') {
    audio.sfx.putt(Math.hypot(state.ball.vx, state.ball.vy) / MAX_PUTT_SPEED);
  }
  for (const s of soundsFor(state.events)) audio.sfx.play(s);
  audio.sfx.setRoll(rollSpeedOf(state));
  audio.sync();
}

/** Bakes the hole after `index` while the current hole's intro plays, so the next entry doesn't hitch. */
function prebakeNext(content: Content, index: number): void {
  const next = index + 1;
  if (next >= content.holes.length || content.isBaked(next)) return;
  window.setTimeout(() => {
    try {
      content.holeContent(next);
    } catch (err) {
      console.error(`Pre-baking hole ${next + 1} failed (it will retry on entry):`, err);
    }
  }, 0);
}

interface FrameDeps {
  readonly ctx: CanvasRenderingContext2D;
  readonly content: Content;
  readonly hud: Hud;
  readonly audio: GameAudio;
  readonly phase: () => PhaseId;
  readonly getState: () => GameState;
  readonly setState: (s: GameState) => void;
}

function drawFrame(d: FrameDeps, tables: PhaseTables, state: GameState, time: number, effects: Effects): void {
  const { ctx, content } = d;
  const h = content.holeContent(state.holeIndex);
  const look = PHASES[d.phase()];
  const wind = windStep(time);
  renderFrame(ctx, {
    state, hole: h.hole, view: h.view, terrain: h.terrain[wind], manifest: content.manifest,
    sprites: content.sprites, golfer: content.golfer, look, time, wind, width: BUF_W, height: BUF_H, effects,
  });
  postProcess(ctx, BUF_W, BUF_H, content.palette.lut, tables, look.lamps ? h.light : null);
}

function createFrame(d: FrameDeps): (dt: number) => void {
  const tables = new Map<PhaseId, PhaseTables>();
  const tablesFor = (id: PhaseId) => tables.get(id) ?? tables.set(id, buildPhaseTables(d.content.palette, PHASES[id])).get(id)!;
  const storage = safeStorage();
  let best = loadBest(storage);
  let newBest = false;
  let prevKind = d.getState().phase.kind;
  let time = 0;
  let effects = NO_EFFECTS;
  const steps = createStepper(STEP);

  return (dt: number) => {
    // The first rAF timestamp can predate the loop's start, giving a slightly negative dt.
    time += Math.max(0, dt);
    const n = steps(dt);
    let state = d.getState();
    for (let i = 0; i < n; i++) {
      const prev = state;
      state = update(prev, STEP, d.content.holes);
      effects = spawnEffects(effects, prev, state, d.content.holes[prev.holeIndex].cup, time);
    }
    effects = trackTrail(prune(effects, time), state.ball, state.phase.kind === 'rolling');
    d.setState(state);
    if (state.phase.kind === 'scorecard' && prevKind !== 'scorecard') {
      const total = totalStrokes(state.strokes);
      newBest = best === null || total < best;
      best = saveBest(storage, total);
    }
    if (state.phase.kind === 'intro' && prevKind !== 'intro') prebakeNext(d.content, state.holeIndex);
    frameAudio(d.audio, prevKind, state);
    prevKind = state.phase.kind;
    drawFrame(d, tablesFor(d.phase()), state, time, effects);
    d.hud.update(state, d.content.holes, best, newBest);
    // Ball events accumulate across this frame's substeps; once read (audio, Task 19), drop them.
    d.setState(clearEvents(state));
  };
}

function runGame(ctx: CanvasRenderingContext2D, content: Content, hud: Hud, canvas: HTMLCanvasElement, stage: HTMLElement): void {
  let state: GameState = initialState(content.holes);
  const dispatch = (a: Action) => {
    state = reduce(state, a, content.holes);
  };
  hud.setCallbacks({
    onPlay: () => dispatch({ type: 'start' }),
    onResume: () => dispatch({ type: 'resume' }),
    onRestart: () => dispatch({ type: 'start' }),
    onRetry: () => dispatch({ type: 'retry' }),
    onPause: () => dispatch({ type: 'togglePause' }),
  });
  wireInput(canvas, stage, content, () => state, dispatch);

  const audio = wireAudio(() => state.paused);
  let phase: PhaseId = currentPhase();
  watchPhase((p) => {
    phase = p;
    matchPageToCanvas(content, p);
  });

  const frame = createFrame({
    ctx, content, hud, audio, phase: () => phase, getState: () => state, setState: (s) => { state = s; },
  });
  const stop = startLoop((dt) => {
    try {
      frame(dt);
    } catch (err) {
      console.error('Game loop stopped after an error:', err);
      hud.showError(RUNTIME_ERROR);
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
  const stage = document.getElementById('stage') as HTMLElement;
  const hud = createHud(document.getElementById('hud') as HTMLElement, isTouchDevice());
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    console.error('2D canvas is not available');
    hud.showError(LOAD_ERROR);
    return;
  }
  fitCanvas(canvas);
  window.addEventListener('resize', () => fitCanvas(canvas));
  try {
    runGame(ctx, await loadContent(), hud, canvas, stage);
  } catch (err) {
    console.error('Failed to load course data:', err);
    hud.showError(LOAD_ERROR);
  }
}

void boot();
