import { BUF_H, BUF_W, loadContent } from './content';
import { initialState, type GameState } from './game/state';
import { restingBall } from './physics/ball';
import { buildPhaseTables, postProcess } from './render/post';
import { renderFrame } from './render/renderer';
import { PHASES, PHASE_IDS } from './render/time-of-day';

/** `?holes=4,5` shows only those hole numbers; no parameter shows every hole. */
function wantedHoles(search: string, count: number): number[] {
  const all = Array.from({ length: count }, (_, i) => i);
  const param = new URLSearchParams(search).get('holes');
  if (!param) return all;
  const wanted = new Set(param.split(',').map((n) => Number(n) - 1));
  return all.filter((i) => wanted.has(i));
}

async function main(): Promise<void> {
  const content = await loadContent();
  const grid = document.getElementById('grid') as HTMLElement;
  wantedHoles(window.location.search, content.holes.length).forEach((i) => {
    const h = content.holeContent(i);
    const atTee: GameState = {
      ...initialState(content.holes), holeIndex: i, phase: { kind: 'aiming' }, aim: 0,
      ball: restingBall(h.hole, h.hole.tee),
    };
    for (const id of PHASE_IDS) {
      const canvas = document.createElement('canvas');
      canvas.width = BUF_W;
      canvas.height = BUF_H;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('2D canvas is not available');
      const look = PHASES[id];
      renderFrame(ctx, {
        state: atTee, hole: h.hole, view: h.view, terrain: h.terrain[0], manifest: content.manifest,
        sprites: content.sprites, golfer: content.golfer, look, time: 0, wind: 0, width: BUF_W, height: BUF_H,
      });
      postProcess(ctx, BUF_W, BUF_H, content.palette.lut, buildPhaseTables(content.palette, look), look.lamps ? h.light : null);
      const fig = document.createElement('figure');
      fig.style.margin = '0';
      const label = document.createElement('figcaption');
      label.textContent = `${i + 1} ${h.hole.name} · ${id}`;
      fig.append(label, canvas);
      grid.append(fig);
    }
  });
}

main().catch((err) => {
  console.error(err);
  document.body.textContent = `Debug page failed: ${String(err)}`;
});
