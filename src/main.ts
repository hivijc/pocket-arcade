import './style.css';
import manifestJson from '../assets/manifest.json';
import hole1 from './world/holes/01.json';
import hole2 from './world/holes/02.json';
import hole3 from './world/holes/03.json';
import { attachInput, type InputEvent } from './core/input';
import { createStepper, startLoop } from './core/loop';
import { loadBest, saveBest, totalStrokes, type KeyValueStore } from './game/score';
import { clearEvents, initialState, reduce, update, type Action, type GameState } from './game/state';
import { STEP } from './physics/constants';
import { unproject, viewFor, type View } from './render/iso';
import { renderFrame } from './render/renderer';
import { drawTerrain } from './render/terrain-draw';
import { createHud } from './ui/hud';
import { parseHole, type Hole } from './world/hole';
import { parseManifest, type Manifest } from './world/manifest';

const BUF_W = 360;
const BUF_H = 270;
const LOAD_ERROR = "Couldn't load the Backyard — try refreshing";

interface Content {
  readonly manifest: Manifest;
  readonly holes: readonly Hole[];
  readonly views: readonly View[];
  /** Pre-drawn terrain per hole, built up front so a drawing failure surfaces at boot. */
  readonly terrains: readonly HTMLCanvasElement[];
}

function loadContent(): Content {
  const manifest = parseManifest(manifestJson);
  const holes = [hole1, hole2, hole3].map((raw, i) => parseHole(raw, manifest, `holes/0${i + 1}.json`));
  const views = holes.map((h) => viewFor(h, BUF_W, BUF_H));
  const terrains = holes.map((h, i) => drawTerrain(h, views[i], BUF_W, BUF_H));
  return { manifest, holes, views, terrains };
}

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

function boot(): void {
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const hudRoot = document.getElementById('hud') as HTMLElement;
  let content: Content | null = null;
  let state: GameState | null = null;

  const dispatch = (a: Action) => {
    if (content && state) state = reduce(state, a, content.holes);
  };
  const hud = createHud(hudRoot, {
    onPlay: () => dispatch({ type: 'start' }),
    onResume: () => dispatch({ type: 'resume' }),
    onRestart: () => dispatch({ type: 'start' }),
  });

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    console.error('2D canvas is not available');
    hud.showError(LOAD_ERROR);
    return;
  }
  try {
    content = loadContent();
  } catch (err) {
    console.error('Failed to load course data:', err);
    hud.showError(LOAD_ERROR);
    return;
  }
  const { holes, manifest, views, terrains } = content;
  state = initialState(holes);

  const onInput = (e: InputEvent) => {
    if (!state) return;
    if (e.type === 'escape') {
      dispatch({ type: 'togglePause' });
    } else if (e.type === 'aimAt') {
      const b = state.ball;
      const [gx, gy] = unproject(views[state.holeIndex], e.sx, e.sy, b.z);
      dispatch({ type: 'aim', angle: Math.atan2(gy - b.y, gx - b.x) });
    } else {
      dispatch({ type: e.type });
    }
  };

  fitCanvas(canvas);
  window.addEventListener('resize', () => fitCanvas(canvas));
  attachInput(canvas, BUF_W, BUF_H, onInput);
  // A release that happens while the window is unfocused never arrives: drop the charge instead.
  window.addEventListener('blur', () => dispatch({ type: 'cancel' }));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) dispatch({ type: 'cancel' });
  });

  const storage = safeStorage();
  let best = loadBest(storage);
  let prevKind = state.phase.kind;
  const steps = createStepper(STEP);

  const frame = (dt: number) => {
    if (!state) return;
    const n = steps(dt);
    for (let i = 0; i < n; i++) state = update(state, STEP, holes);
    if (state.phase.kind === 'scorecard' && prevKind !== 'scorecard') best = saveBest(storage, totalStrokes(state.strokes));
    prevKind = state.phase.kind;
    const i = state.holeIndex;
    renderFrame(ctx, { state, hole: holes[i], view: views[i], terrain: terrains[i], manifest, width: BUF_W, height: BUF_H });
    hud.update(state, holes, best);
    // Ball events accumulate across this frame's substeps; once they've been read (Plan 2: audio), drop them.
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

boot();
