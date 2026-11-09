// Dev-only hole editor (editor.html): paint surfaces, shape heights, place tee, cup and props,
// preview with the game's renderer and post pass, check with parseHole, solve for par, export JSON.
import manifestJson from '../assets/manifest.json';
import paletteJson from '../assets/palette.json';
import { BUF_H, BUF_W, bakeHole, type HoleContent } from './content';
import type { Vec2 } from './core/geometry';
import { initialState, type GameState } from './game/state';
import { restingBall } from './physics/ball';
import { heightAt } from './physics/terrain';
import { loadSprites } from './render/assets';
import { project, unproject } from './render/iso';
import { createPalette } from './render/palette';
import { buildPhaseTables, postProcess } from './render/post';
import { renderFrame } from './render/renderer';
import { PHASES, PHASE_IDS, type PhaseId } from './render/time-of-day';
import { holeLabel, sortedHoleFiles } from './world/course';
import { parseHole, type Hole } from './world/hole';
import {
  addProp, blankHole, bumpCorner, formatHole, nearestCorner, paintSurface, removePropNear, resizeHole, setCup, setTee,
  toHoleJson, type HoleJson, type Letter,
} from './world/hole-edit';
import { parseManifest } from './world/manifest';

const manifest = parseManifest(manifestJson);
const palette = createPalette(paletteJson);
const FILES = sortedHoleFiles(import.meta.glob('./world/holes/*.json', { eager: true, import: 'default' }));
const LETTERS: readonly Letter[] = ['G', 'R', 'S', 'W', 'X'];
const TOOLS = [...LETTERS, 'raise', 'lower', 'tee', 'cup', 'prop', 'erase'] as const;
type Tool = (typeof TOOLS)[number];
const ERASE_REACH = 0.6;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>('view');
const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
const ui = {
  file: $<HTMLSelectElement>('file'), name: $<HTMLInputElement>('name'), par: $<HTMLInputElement>('par'),
  width: $<HTMLInputElement>('width'), depth: $<HTMLInputElement>('depth'), tools: $<HTMLFieldSetElement>('tools'),
  phase: $<HTMLSelectElement>('phase'), errors: $<HTMLDivElement>('errors'), result: $<HTMLDivElement>('solve-result'),
  json: $<HTMLTextAreaElement>('json'),
};

let raw: HoleJson = blankHole(12, 7);
let preview: HoleContent | null = null;
let tool: Tool = 'G';
let propSprite = Object.keys(manifest)[0];
let phase: PhaseId = 'day';
let sprites: ReadonlyMap<string, HTMLImageElement> = new Map();
let hover: Vec2 | null = null;

function option(select: HTMLSelectElement, value: string, label = value): void {
  const o = document.createElement('option');
  o.value = value;
  o.textContent = label;
  select.append(o);
}

/** The last valid hole is kept for the preview while the current edit doesn't parse. */
function validate(): Hole | null {
  try {
    const hole = parseHole(raw, manifest, 'editor');
    ui.errors.className = 'ok';
    ui.errors.textContent = `Valid · ${hole.width}×${hole.depth} · fits buffer: ${(hole.width + hole.depth) * 16 <= BUF_W ? 'yes' : 'NO (width + depth > 22)'}`;
    return hole;
  } catch (err) {
    ui.errors.className = '';
    ui.errors.textContent = err instanceof Error ? err.message : String(err);
    return null;
  }
}

function draw(): void {
  if (!preview) {
    ctx.fillStyle = '#14141c';
    ctx.fillRect(0, 0, BUF_W, BUF_H);
    return;
  }
  const { hole, view } = preview;
  const state: GameState = { ...initialState([hole]), phase: { kind: 'aiming' }, aim: 0, ball: restingBall(hole, hole.tee) };
  const look = PHASES[phase];
  renderFrame(ctx, {
    state, hole, view, terrain: preview.terrain[0], manifest, sprites, golfer: null, look, time: 0, wind: 0, width: BUF_W, height: BUF_H,
  });
  postProcess(ctx, BUF_W, BUF_H, palette.lut, buildPhaseTables(palette, look), look.lamps ? preview.light : null);
  drawHover(hole);
}

/** Outlines the tile (or marks the corner) the tool would act on. */
function drawHover(hole: Hole): void {
  if (!hover || !preview) return;
  const { view } = preview;
  ctx.strokeStyle = '#ffe14d';
  ctx.lineWidth = 1;
  if (tool === 'raise' || tool === 'lower') {
    const [cx, cy] = nearestCorner(raw, hover);
    const [sx, sy] = project(view, cx, cy, hole.heights[cy][cx]);
    ctx.strokeRect(Math.round(sx) - 2.5, Math.round(sy) - 2.5, 5, 5);
    return;
  }
  const tx = Math.floor(hover[0]), ty = Math.floor(hover[1]);
  if (tx < 0 || ty < 0 || tx >= hole.width || ty >= hole.depth) return;
  const corners: Vec2[] = [[tx, ty], [tx + 1, ty], [tx + 1, ty + 1], [tx, ty + 1]];
  ctx.beginPath();
  corners.forEach(([x, y], i) => {
    const [sx, sy] = project(view, x, y, hole.heights[y][x]);
    if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
  });
  ctx.closePath();
  ctx.stroke();
}

function refresh(): void {
  const hole = validate();
  if (hole) preview = bakeHole(hole, manifest);
  ui.json.value = formatHole(raw);
  ui.name.value = raw.name;
  ui.par.value = String(raw.par);
  ui.width.value = String(raw.size[0]);
  ui.depth.value = String(raw.size[1]);
  draw();
}

/** Grid point under a canvas pixel, settled onto the terrain's height. */
function gridPointAt(e: MouseEvent): Vec2 {
  const rect = canvas.getBoundingClientRect();
  const sx = ((e.clientX - rect.left) * BUF_W) / rect.width;
  const sy = ((e.clientY - rect.top) * BUF_H) / rect.height;
  if (!preview) return [0, 0];
  let p = unproject(preview.view, sx, sy, 0);
  for (let i = 0; i < 4; i++) p = unproject(preview.view, sx, sy, heightAt(preview.hole, p[0], p[1]));
  return p;
}

function apply(p: Vec2, shift: boolean): HoleJson {
  const [cx, cy] = nearestCorner(raw, p);
  switch (tool) {
    case 'raise': return bumpCorner(raw, cx, cy, shift ? -1 : 1);
    case 'lower': return bumpCorner(raw, cx, cy, -1);
    case 'tee': return setTee(raw, p);
    case 'cup': return setCup(raw, p);
    case 'prop': return addProp(raw, propSprite, p);
    case 'erase': return removePropNear(raw, p, ERASE_REACH);
    default: return paintSurface(raw, Math.floor(p[0]), Math.floor(p[1]), tool);
  }
}

function edit(next: HoleJson): void {
  if (next === raw) return;
  raw = next;
  refresh();
}

function wireCanvas(): void {
  let painting = false;
  const paints = () => (LETTERS as readonly string[]).includes(tool);
  canvas.addEventListener('mousedown', (e) => {
    painting = paints();
    edit(apply(gridPointAt(e), e.shiftKey));
  });
  canvas.addEventListener('mousemove', (e) => {
    hover = gridPointAt(e);
    if (painting && e.buttons === 1) edit(apply(hover, e.shiftKey));
    else draw();
  });
  window.addEventListener('mouseup', () => { painting = false; });
  canvas.addEventListener('mouseleave', () => { hover = null; draw(); });
}

function wireTools(): void {
  for (const t of TOOLS) {
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'tool';
    input.checked = t === tool;
    input.addEventListener('change', () => { tool = t; draw(); });
    label.append(input, t);
    ui.tools.append(label);
  }
  const select = document.createElement('select');
  for (const name of Object.keys(manifest)) option(select, name);
  select.addEventListener('change', () => { propSprite = select.value; });
  ui.tools.append(select);
}

function load(next: HoleJson): void {
  raw = next;
  ui.result.textContent = '';
  refresh();
}

function wireHoleFields(): void {
  option(ui.file, 'blank', 'New blank hole');
  FILES.forEach((f, i) => option(ui.file, String(i), holeLabel(f.path)));
  ui.file.addEventListener('change', () => {
    const f = FILES[Number(ui.file.value)];
    load(f ? toHoleJson(f.raw) : blankHole(12, 7));
  });
  ui.name.addEventListener('change', () => edit({ ...raw, name: ui.name.value }));
  ui.par.addEventListener('change', () => edit({ ...raw, par: Number(ui.par.value) }));
  $('resize').addEventListener('click', () => {
    const w = Math.max(1, Math.floor(Number(ui.width.value))), d = Math.max(1, Math.floor(Number(ui.depth.value)));
    edit(resizeHole(raw, w, d));
  });
}

function wireSolver(): void {
  const button = $<HTMLButtonElement>('solve');
  button.addEventListener('click', () => {
    if (!validate()) return;
    button.disabled = true;
    ui.result.textContent = 'Solving… (can take a few seconds per stroke)';
    const worker = new Worker(new URL('./editor-solver.worker.ts', import.meta.url), { type: 'module' });
    const done = (text: string) => { ui.result.textContent = text; button.disabled = false; worker.terminate(); };
    worker.onmessage = (e: MessageEvent<{ ok: boolean; error?: string; par?: number; holed?: boolean; shots?: unknown[] }>) => {
      const r = e.data;
      if (!r.ok) return done(`Solver failed: ${r.error}`);
      const verdict = r.holed ? `Holed in ${r.shots!.length} (par ${r.par})` : `Not holed within par ${r.par}`;
      done(`${verdict}\nshots [angle°, power]: ${JSON.stringify(r.shots)}`);
    };
    worker.onerror = (e) => done(`Solver failed: ${e.message}`);
    worker.postMessage(raw);
  });
}

function wireExport(): void {
  $('load').addEventListener('click', () => {
    try {
      load(toHoleJson(JSON.parse(ui.json.value)));
    } catch (err) {
      ui.errors.className = '';
      ui.errors.textContent = `Couldn't load the text: ${err instanceof Error ? err.message : String(err)}`;
    }
  });
  $('copy').addEventListener('click', () => {
    navigator.clipboard.writeText(formatHole(raw)).catch((err) => { ui.errors.textContent = `Copy failed: ${String(err)}`; });
  });
  $('download').addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([formatHole(raw)], { type: 'application/json' }));
    a.download = `${raw.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });
}

async function main(): Promise<void> {
  for (const id of PHASE_IDS) option(ui.phase, id);
  ui.phase.value = phase;
  ui.phase.addEventListener('change', () => { phase = ui.phase.value as PhaseId; draw(); });
  wireTools();
  wireHoleFields();
  wireCanvas();
  wireSolver();
  wireExport();
  sprites = await loadSprites(manifest);
  const first = FILES[0];
  if (first) ui.file.value = '0';
  load(first ? toHoleJson(first.raw) : blankHole(12, 7));
}

main().catch((err) => {
  console.error(err);
  document.body.textContent = `Editor failed: ${String(err)}`;
});
