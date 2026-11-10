import './style.css';
import { createSfx, type Sfx } from './audio/sfx';
import { soundsFor } from './audio/sfx-math';
import { BUF_H, BUF_W, loadContent, type Content } from './content';
import { attachKeyboard, type Keyboard } from './core/input';
import { createStepper, startLoop } from './core/loop';
import { canvasScale, isUserActivation, mergeControls } from './core/touch';
import { loadBest, saveBest, type KeyValueStore } from './game/score';
import { clearEvents, initialState, reduce, type Action, type GameState } from './game/state';
import { bakeToCanvases } from './render/assets';
import { cameraTarget, followCamera, snapCamera, type Camera } from './render/camera';
import { createChunkCache, visibleChunks, type ChunkCache } from './render/chunks';
import { parseHex } from './render/palette';
import { buildTable, MORNING, postColor, postProcess } from './render/post';
import { BACKGROUND, renderFrame } from './render/renderer';
import { bakeChunk, chunkCount } from './render/street-bake';
import { windStep } from './render/wind';
import type { Controls } from './sim/bike';
import { STEP } from './sim/constants';
import { createHud, type Hud } from './ui/hud';
import { createTouchControls } from './ui/touch-controls';

const LOAD_ERROR = "Couldn't load Maple Lane — try refreshing";
const RUNTIME_ERROR = 'Something went wrong — try refreshing';

function safeStorage(): KeyValueStore | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const isTouchDevice = (): boolean => window.matchMedia?.('(pointer: coarse)').matches ?? false;

function fitCanvas(canvas: HTMLCanvasElement, touch: boolean): void {
  const scale = canvasScale(window.innerWidth, window.innerHeight, BUF_W, BUF_H, touch);
  canvas.style.width = `${BUF_W * scale}px`;
  canvas.style.height = `${BUF_H * scale}px`;
}

/** Paints the page in the canvas backdrop's exact on-screen colour, so the game sits on one seamless background. */
function matchPageToCanvas(content: Content, table: Uint8Array): void {
  const [r, g, b] = postColor(content.palette, table, parseHex(BACKGROUND));
  document.documentElement.style.setProperty('--page', `rgb(${r},${g},${b})`);
}

const UNLOCK_EVENTS = ['pointerdown', 'pointerup', 'touchend', 'keydown'] as const;

function wireAudio(): Sfx {
  const sfx = createSfx();
  // Stay attached until the context runs after a real activation: on a phone that is the finger lifting
  // (pointerup/touchend), not the press. Capture phase, so on-screen buttons can't swallow it.
  const unlock = (e: Event) => {
    const running = sfx.unlock();
    if (!running || !isUserActivation(e.type, (e as PointerEvent).pointerType)) return;
    for (const k of UNLOCK_EVENTS) window.removeEventListener(k, unlock, true);
  };
  for (const k of UNLOCK_EVENTS) window.addEventListener(k, unlock, true);
  return sfx;
}

interface FrameDeps {
  readonly ctx: CanvasRenderingContext2D;
  readonly content: Content;
  readonly hud: Hud;
  readonly sfx: Sfx;
  /** Steer and pedal for this frame (keyboard and touch merged). */
  readonly controls: () => Controls;
  /** Called with the state each frame after drawing (shows or hides the touch controls). */
  readonly afterFrame: (s: GameState) => void;
  readonly getState: () => GameState;
  readonly setState: (s: GameState) => void;
}

/** Runs `task` when the browser is idle (falling back to the next tick), never inside a frame. */
function whenIdle(task: () => void): void {
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(task);
  else window.setTimeout(task, 0);
}

/** Bakes chunks ahead of need, one idle slot at a time. Visible chunks still bake on demand. */
function createPrebaker(chunks: ChunkCache<HTMLCanvasElement[]>): (index: number) => void {
  // Mutated on purpose: at most one bake is scheduled, and an index is not rescheduled once requested.
  let pending = false;
  let last = -1;
  return (index) => {
    if (pending || index === last) return;
    pending = true;
    last = index;
    whenIdle(() => {
      pending = false;
      chunks.get(index);
    });
  };
}

function createFrame(d: FrameDeps): (dt: number) => void {
  const { street } = d.content;
  const table = buildTable(d.content.palette, MORNING);
  matchPageToCanvas(d.content, table);
  const chunks = createChunkCache((i) => bakeToCanvases(bakeChunk(street.length, i)));
  const prebake = createPrebaker(chunks);
  const count = chunkCount(street.length);
  const storage = safeStorage();
  const steps = createStepper(STEP);
  let best = loadBest(storage);
  let cam: Camera = cameraTarget(street.length, d.getState().bike.s);
  let prev = d.getState();
  let time = 0;

  return (dt: number) => {
    time += Math.max(0, dt);
    let state = d.getState();
    for (let n = steps(dt); n > 0; n--) state = reduce(state, { type: 'tick', dt: STEP, controls: d.controls() }, street);
    if (state.phase === 'over' && prev.phase !== 'over') best = saveBest(storage, state.score);
    // A new run starts back at the start line: jump the camera instead of sweeping down the street.
    if (state.bike.s + 1 < prev.bike.s) cam = cameraTarget(street.length, state.bike.s);
    prev = state;
    cam = followCamera(cam, cameraTarget(street.length, state.bike.s), dt);
    const snapped = snapCamera(cam);
    const visible = visibleChunks(street.length, snapped, BUF_W, BUF_H);
    const wind = windStep(time);
    renderFrame(d.ctx, { content: d.content, state, cam: snapped, visible, chunk: (i) => chunks.get(i)[wind], time, width: BUF_W, height: BUF_H });
    postProcess(d.ctx, BUF_W, BUF_H, d.content.palette.lut, table);
    // Keep what is on screen plus the next chunk ahead, baked before it scrolls into view.
    const ahead = (visible[0] ?? 0) + 1;
    chunks.keepOnly(ahead < count ? [...visible, ahead] : visible);
    if (ahead < count) prebake(ahead);
    for (const sound of soundsFor(state.events)) d.sfx.play(sound);
    d.hud.update(state, street, best, time);
    d.afterFrame(state);
    d.setState(clearEvents(state));
  };
}

interface Play {
  readonly content: Content;
  readonly hud: Hud;
  readonly touch: boolean;
  /** Receives the game's dispatch, so HUD taps made before the run existed can reach it. */
  readonly bindDispatch: (dispatch: (a: Action) => void) => void;
}

function runGame(ctx: CanvasRenderingContext2D, { content, hud, touch, bindDispatch }: Play): void {
  let state: GameState = initialState(content.street);
  const dispatch = (a: Action) => {
    state = reduce(state, a, content.street);
  };
  bindDispatch(dispatch);
  const keys: Keyboard = attachKeyboard(window, dispatch);
  const pad = touch
    ? createTouchControls(document.getElementById('hud') as HTMLElement, {
      onToss: (side) => dispatch({ type: 'toss', side }),
      onPause: () => dispatch({ type: 'togglePause' }),
    })
    : null;
  const controls = (): Controls => (pad ? mergeControls(keys.controls(), pad.controls()) : keys.controls());
  const afterFrame = (s: GameState) => pad?.setActive(s.phase === 'riding' && !s.paused);
  // Leaving the tab mid-run pauses it rather than riding on unattended.
  window.addEventListener('blur', () => {
    if (state.phase === 'riding' && !state.paused) dispatch({ type: 'togglePause' });
  });
  const frame = createFrame({ ctx, content, hud, sfx: wireAudio(), controls, afterFrame, getState: () => state, setState: (s) => { state = s; } });
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
    (window as unknown as { __paperRoute: unknown }).__paperRoute = { getState: () => state, dispatch };
  }
}

async function boot(): Promise<void> {
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const touch = isTouchDevice();
  // Late-bound: the HUD exists before the run does (it also shows load errors).
  let dispatch: ((a: Action) => void) | null = null;
  const hud = createHud(document.getElementById('hud') as HTMLElement, {
    touch,
    onStart: () => dispatch?.({ type: 'start' }),
    onResume: () => dispatch?.({ type: 'togglePause' }),
  });
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    console.error('2D canvas is not available');
    hud.showError(LOAD_ERROR);
    return;
  }
  ctx.imageSmoothingEnabled = false;
  document.documentElement.classList.toggle('touch', touch);
  const fit = () => fitCanvas(canvas, touch);
  fit();
  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', fit);
  try {
    runGame(ctx, { content: await loadContent(), hud, touch, bindDispatch: (d) => { dispatch = d; } });
  } catch (err) {
    console.error('Failed to load Paper Route:', err);
    hud.showError(LOAD_ERROR);
  }
}

void boot();
