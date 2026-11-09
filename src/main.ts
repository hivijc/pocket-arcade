import './style.css';
import { BUF_H, BUF_W, loadContent, type Content } from './content';
import { attachInput, type InputEvent } from './core/input';
import { createStepper, startLoop } from './core/loop';
import { bestKey, loadBest, saveBest, totalStrokes, type KeyValueStore } from './game/score';
import { clearEvents, initialState, reduce, update, type Action, type GameState } from './game/state';
import { audioTransition, rollSpeedOf, shouldPlayAudio, soundsFor } from './audio/sfx-math';
import { createSfx, type Sfx } from './audio/sfx';
import { MAX_PUTT_SPEED, STEP } from './physics/constants';
import { unproject } from './render/iso';
import { parseHex } from './render/palette';
import { buildPhaseTables, postColor, postProcess, type PhaseTables } from './render/post';
import { renderFrame } from './render/renderer';
import { PHASES, phaseFor, type PhaseId } from './render/time-of-day';
import { windStep } from './render/wind';
import { createHud, type Hud } from './ui/hud';
import { COURSE_IDS, COURSE_NAMES, courseFromSearch, isCourseId, loadCourseDef, type CourseId } from './world/course';

const LOAD_ERROR = "Couldn't load the course — try refreshing";
const RUNTIME_ERROR = 'Something went wrong — try refreshing';
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

function wireInput(canvas: HTMLCanvasElement, getContent: () => Content, getState: () => GameState | null, dispatch: (a: Action) => void): void {
  const onInput = (e: InputEvent) => {
    const state = getState();
    if (!state) return;
    if (e.type === 'escape') dispatch({ type: 'togglePause' });
    else if (e.type === 'aimAt') dispatch({ type: 'aimAt', point: unproject(getContent().perHole[state.holeIndex].view, e.sx, e.sy, state.ball.z) });
    else dispatch({ type: e.type });
  };
  attachInput(canvas, BUF_W, BUF_H, onInput);
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
  const unlock = () => {
    sfx.unlock();
    if (!playing) sfx.suspend();
  };
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });
  return { sfx, sync };
}

/** Paints the page in the canvas backdrop's exact on-screen colour, so the game sits on one seamless background. */
function matchPageToCanvas(content: Content, phase: PhaseId): void {
  const [r, g, b] = postColor(content.palette, buildPhaseTables(content.palette, PHASES[phase]), parseHex(content.background));
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
  if (prevKind === 'charging' && state.phase.kind === 'rolling') {
    audio.sfx.putt(Math.hypot(state.ball.vx, state.ball.vy) / MAX_PUTT_SPEED);
  }
  for (const s of soundsFor(state.events)) audio.sfx.play(s);
  audio.sfx.setRoll(rollSpeedOf(state));
  audio.sync();
}

interface FrameDeps {
  readonly ctx: CanvasRenderingContext2D;
  readonly content: () => Content;
  readonly hud: Hud;
  readonly storage: KeyValueStore | null;
  readonly audio: GameAudio;
  readonly phase: () => PhaseId;
  readonly getState: () => GameState;
  readonly setState: (s: GameState) => void;
}

function drawFrame(d: FrameDeps, tables: PhaseTables, state: GameState, time: number): void {
  const { ctx } = d;
  const content = d.content();
  const h = content.perHole[state.holeIndex];
  const look = PHASES[d.phase()];
  const wind = windStep(time);
  renderFrame(ctx, {
    state, hole: h.hole, view: h.view, terrain: h.terrain[wind], manifest: content.manifest,
    sprites: content.sprites, golfer: content.golfer, look, time, wind, width: BUF_W, height: BUF_H,
    background: content.background, fence: content.fence,
  });
  postProcess(ctx, BUF_W, BUF_H, content.palette.lut, tables, look.lamps ? h.light : null);
}

function createFrame(d: FrameDeps): (dt: number) => void {
  // Phase tables belong to a palette, so they're cached per course.
  const tables = new Map<string, PhaseTables>();
  const tablesFor = (c: Content, id: PhaseId) => {
    const key = `${c.course.id}:${id}`;
    return tables.get(key) ?? tables.set(key, buildPhaseTables(c.palette, PHASES[id])).get(key)!;
  };
  // Best totals per storage key, read once and updated when a scorecard is saved.
  const bests = new Map<string, number | null>();
  const bestFor = (key: string) => (bests.has(key) ? bests.get(key)! : bests.set(key, loadBest(d.storage, key)).get(key)!);
  let prevKind = d.getState().phase.kind;
  let time = 0;
  const steps = createStepper(STEP);

  return (dt: number) => {
    // The first rAF timestamp can predate the loop's start, giving a slightly negative dt.
    time += Math.max(0, dt);
    const content = d.content();
    const key = bestKey(content.course.id);
    const n = steps(dt);
    let state = d.getState();
    for (let i = 0; i < n; i++) state = update(state, STEP, content.holes);
    d.setState(state);
    if (state.phase.kind === 'scorecard' && prevKind !== 'scorecard') bests.set(key, saveBest(d.storage, totalStrokes(state.strokes), key));
    const best = bestFor(key);
    frameAudio(d.audio, prevKind, state);
    prevKind = state.phase.kind;
    drawFrame(d, tablesFor(content, d.phase()), state, time);
    d.hud.update(state, content.holes, best);
    // Ball events accumulate across this frame's substeps; once read (audio, Task 19), drop them.
    d.setState(clearEvents(state));
  };
}

/** Loads (once) and caches each course's content. */
function courseLoader(): (id: CourseId) => Promise<Content> {
  const cache = new Map<CourseId, Promise<Content>>();
  return (id) => {
    const hit = cache.get(id);
    if (hit) return hit;
    const p = loadCourseDef(id).then(loadContent);
    p.catch(() => cache.delete(id)); // a failed load can be retried
    cache.set(id, p);
    return p;
  };
}

interface Game {
  readonly content: () => Content;
  readonly state: () => GameState;
  readonly setState: (s: GameState) => void;
  readonly dispatch: (a: Action) => void;
}

/** The title card's course picker: picking a course loads it and shows its first hole behind the card. */
function wirePicker(hud: Hud, game: Game, storage: KeyValueStore | null, load: (id: CourseId) => Promise<Content>, use: (c: Content) => void): void {
  let selected: CourseId = game.content().course.id;
  const refresh = () => hud.setPicker(
    COURSE_IDS.map((id) => ({ id, name: COURSE_NAMES[id], best: loadBest(storage, bestKey(id)) })),
    selected,
  );
  hud.setCallbacks({
    onPlay: () => game.dispatch({ type: 'start' }),
    onResume: () => game.dispatch({ type: 'resume' }),
    onRestart: () => game.dispatch({ type: 'start' }),
    onChangeCourse: () => {
      game.setState(initialState(game.content().holes));
      refresh();
    },
    onPickCourse: (id) => {
      if (!isCourseId(id) || game.state().phase.kind !== 'title') return;
      selected = id;
      refresh();
      load(id).then((c) => {
        if (selected === id && game.state().phase.kind === 'title') use(c);
      }).catch((err: unknown) => {
        console.error(`Failed to load course ${id}:`, err);
        hud.showError(LOAD_ERROR);
      });
    },
  });
  refresh();
}

function runGame(ctx: CanvasRenderingContext2D, first: Content, hud: Hud, canvas: HTMLCanvasElement, load: (id: CourseId) => Promise<Content>): void {
  let content = first;
  let state: GameState = initialState(content.holes);
  const storage = safeStorage();
  const game: Game = {
    content: () => content,
    state: () => state,
    setState: (s) => { state = s; },
    dispatch: (a) => { state = reduce(state, a, content.holes); },
  };
  wireInput(canvas, game.content, game.state, game.dispatch);

  const audio = wireAudio(() => state.paused);
  let phase: PhaseId = currentPhase();
  const use = (c: Content) => {
    content = c;
    state = initialState(c.holes);
    hud.setCourse({ name: c.course.name, tagline: c.course.tagline, holes: c.holes.length });
    matchPageToCanvas(c, phase);
    document.body.dataset.course = c.course.id;
  };
  use(first);
  wirePicker(hud, game, storage, load, use);
  watchPhase((p) => {
    phase = p;
    matchPageToCanvas(content, p);
  });

  const frame = createFrame({
    ctx, content: game.content, hud, storage, audio, phase: () => phase, getState: game.state, setState: game.setState,
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
      getCourse: () => content.course.id,
      putt: (angle: number, power: number) => game.dispatch({ type: 'putt', angle, power }),
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
    const load = courseLoader();
    runGame(ctx, await load(courseFromSearch(window.location.search)), hud, canvas, load);
  } catch (err) {
    console.error('Failed to load course data:', err);
    hud.showError(LOAD_ERROR);
  }
}

void boot();
