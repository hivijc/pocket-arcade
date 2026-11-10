import './style.css';
import { createSfx, type Sfx } from './audio/sfx';
import { cuesFor, swishFor } from './audio/sfx-math';
import { BUF_H, BUF_W, loadContent, type Content } from './content';
import { attachInput, type Input } from './core/input';
import { createStepper, startLoop } from './core/loop';
import { loadBest, loadMuted, saveBest, saveMuted, type KeyValueStore } from './game/score';
import { clearEvents, initialState, reduce, type Action, type GameState } from './game/state';
import { bakeToCanvases } from './render/assets';
import { cameraTarget, followCamera, snapCamera, type Camera } from './render/camera';
import { createChunkCache, visibleChunks, type ChunkCache } from './render/chunks';
import { parseHex } from './render/palette';
import { spawnFor, stepParticles, type Particle } from './render/particles';
import { buildTable, postColor, postProcess, SUNNY } from './render/post';
import { BACKGROUND, renderFrame } from './render/renderer';
import { bakeChunk, chunkCount } from './render/slope-bake';
import { pushTrack, trackPoint, type TrackPoint } from './render/tracks';
import { STEP } from './sim/constants';
import { createHud, type Hud } from './ui/hud';
import { canvasScale } from './ui/layout';

const LOAD_ERROR = "Couldn't load Pinecone Bowl — try refreshing";
const RUNTIME_ERROR = 'Something went wrong — try refreshing';
/** Carve spray is emitted every this many sim steps. */
const SPRAY_EVERY = 3;

const isTouchDevice = (): boolean => window.matchMedia?.('(pointer: coarse)').matches ?? false;

function safeStorage(): KeyValueStore | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function fitCanvas(canvas: HTMLCanvasElement): void {
  const scale = canvasScale(window.innerWidth, window.innerHeight, BUF_W, BUF_H, isTouchDevice());
  canvas.style.width = `${Math.floor(BUF_W * scale)}px`;
  canvas.style.height = `${Math.floor(BUF_H * scale)}px`;
}

/** Paints the page in the canvas backdrop's exact on-screen colour, so the game sits on one seamless background. */
function matchPageToCanvas(content: Content, table: Uint8Array): void {
  const [r, g, b] = postColor(content.palette, table, parseHex(BACKGROUND));
  document.documentElement.style.setProperty('--page', `rgb(${r},${g},${b})`);
}

function wireAudio(): Sfx {
  const sfx = createSfx();
  // Stay attached until the context is actually running: the first gesture can leave it suspended.
  const unlock = () => {
    if (!sfx.unlock()) return;
    window.removeEventListener('keydown', unlock);
    window.removeEventListener('pointerdown', unlock);
  };
  window.addEventListener('keydown', unlock);
  window.addEventListener('pointerdown', unlock);
  return sfx;
}

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

interface FrameDeps {
  readonly ctx: CanvasRenderingContext2D;
  readonly content: Content;
  readonly hud: Hud;
  readonly sfx: Sfx;
  readonly input: Input;
  readonly storage: KeyValueStore | null;
  readonly muted: () => boolean;
  readonly getState: () => GameState;
  readonly setState: (s: GameState) => void;
}

function createFrame(d: FrameDeps): (dt: number) => void {
  const { slope } = d.content;
  const table = buildTable(d.content.palette, SUNNY);
  matchPageToCanvas(d.content, table);
  const chunks = createChunkCache((i) => bakeToCanvases(bakeChunk(slope, i)));
  const prebake = createPrebaker(chunks);
  const count = chunkCount(slope.length);
  const steps = createStepper(STEP);
  // Frame-loop locals, replaced (never mutated) each frame.
  let best = loadBest(d.storage);
  let cam: Camera = cameraTarget(d.getState().board.c, d.getState().board.d);
  let prev = d.getState();
  let track: TrackPoint[] = [];
  let particles: Particle[] = [];
  let tickNo = 0;
  let time = 0;

  return (dt: number) => {
    time += Math.max(0, dt);
    let state = d.getState();
    for (let n = steps(dt); n > 0; n--) {
      state = reduce(state, { type: 'tick', dt: STEP, controls: d.input.controls() }, slope);
      if (state.phase === 'riding' && !state.paused) {
        track = pushTrack(track, trackPoint(state.board));
        if (tickNo % SPRAY_EVERY === 0) particles = spawnFor(particles, state.board, [], tickNo);
      }
      tickNo++;
    }
    particles = stepParticles(spawnFor(particles, state.board, state.events, tickNo, false), dt);
    if (state.phase === 'over' && prev.phase !== 'over') best = saveBest(d.storage, state.score);
    // A new run starts back at the hut: jump the camera and clear the snow trail instead of sweeping back up.
    if (state.board.d + 1 < prev.board.d) {
      cam = cameraTarget(state.board.c, state.board.d);
      track = [];
      particles = [];
    }
    prev = state;
    cam = followCamera(cam, cameraTarget(state.board.c, state.board.d), dt);
    const snapped = snapCamera(cam);
    const visible = visibleChunks(slope.length, snapped, BUF_W, BUF_H);
    renderFrame(d.ctx, {
      content: d.content, state, cam: snapped, visible, chunk: (i) => chunks.get(i)[0], time, width: BUF_W, height: BUF_H, track, particles,
    });
    postProcess(d.ctx, BUF_W, BUF_H, d.content.palette.lut, table);
    // Keep what is on screen plus the next chunk downhill, baked before it scrolls into view.
    const ahead = (visible[0] ?? 0) + 1;
    chunks.keepOnly(ahead < count ? [...visible, ahead] : visible);
    if (ahead < count) prebake(ahead);
    for (const cue of cuesFor(state.events)) d.sfx.play(cue);
    d.sfx.swish(swishFor(state));
    d.hud.update(state, slope, best, time, d.muted());
    d.setState(clearEvents(state));
  };
}

/** HUD button callbacks, bound once the game is running. Late-bound on purpose: mutated exactly once in runGame. */
interface HudBindings {
  dispatch: (a: Action) => void;
  toggleMute: () => void;
}

function runGame(ctx: CanvasRenderingContext2D, content: Content, hud: Hud, bindings: HudBindings): void {
  const storage = safeStorage();
  const sfx = wireAudio();
  let state: GameState = initialState(content.slope);
  let muted = loadMuted(storage);
  sfx.setMuted(muted);
  const dispatch = (a: Action) => {
    state = reduce(state, a, content.slope);
  };
  bindings.dispatch = dispatch;
  bindings.toggleMute = () => {
    muted = !muted;
    saveMuted(storage, muted);
    sfx.setMuted(muted);
  };
  const input = attachInput(window, dispatch);
  // Leaving the tab mid-run pauses it rather than riding on unattended.
  window.addEventListener('blur', () => {
    if ((state.phase === 'riding' || state.phase === 'countdown') && !state.paused) dispatch({ type: 'togglePause' });
  });
  // A hidden tab keeps its audio context alive: cut the looping swish so it doesn't hiss in the background.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) sfx.silence();
  });
  window.addEventListener('pagehide', () => sfx.silence());
  const frame = createFrame({
    ctx, content, hud, sfx, input, storage, muted: () => muted, getState: () => state, setState: (s) => { state = s; },
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
    (window as unknown as { __bluebird: unknown }).__bluebird = { getState: () => state, dispatch };
  }
}

async function boot(): Promise<void> {
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const bindings: HudBindings = { dispatch: () => undefined, toggleMute: () => undefined };
  const hud = createHud(document.getElementById('hud') as HTMLElement, isTouchDevice(), {
    onPause: () => bindings.dispatch({ type: 'togglePause' }),
    onRetry: () => bindings.dispatch({ type: 'restart' }),
    onMute: () => bindings.toggleMute(),
  });
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    console.error('2D canvas is not available');
    hud.showError(LOAD_ERROR);
    return;
  }
  ctx.imageSmoothingEnabled = false;
  fitCanvas(canvas);
  window.addEventListener('resize', () => fitCanvas(canvas));
  try {
    runGame(ctx, await loadContent(), hud, bindings);
  } catch (err) {
    console.error('Failed to load Bluebird Run:', err);
    hud.showError(LOAD_ERROR);
  }
}

void boot();
