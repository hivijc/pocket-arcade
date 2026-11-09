import titlePanelUrl from '../../assets/ui/title-panel.png';
import { totalStrokes } from '../game/score';
import { chargePower, type GameState } from '../game/state';
import type { Hole } from '../world/hole';

export interface HudCallbacks {
  onPlay(): void;
  onResume(): void;
  onRestart(): void;
  /** On-screen Retry (touch devices). */
  onRetry(): void;
  /** On-screen Pause (touch devices). */
  onPause(): void;
}

export interface Hud {
  update(state: GameState, holes: readonly Hole[], best: number | null): void;
  showError(message: string): void;
  setCallbacks(cb: HudCallbacks): void;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function stat(label: string, testId: string): { box: HTMLDivElement; value: HTMLElement } {
  const box = el('div', 'stat');
  const value = el('b');
  value.dataset.testid = testId;
  box.append(value, el('span', undefined, label));
  return { box, value };
}

function overlay(): { root: HTMLDivElement; card: HTMLDivElement } {
  const root = el('div', 'overlay');
  const card = el('div', 'card');
  root.append(card);
  return { root, card };
}

function button(label: string, onClick: () => void): HTMLButtonElement {
  const b = el('button', undefined, label);
  b.addEventListener('click', onClick);
  return b;
}

/** 0..1 power while charging (ping-pong meter) or dragging (slingshot), else null. */
function powerOf(p: GameState['phase']): number | null {
  if (p.kind === 'charging') return chargePower(p.t);
  if (p.kind === 'dragging') return p.power;
  return null;
}

const MOUSE_HINT = 'Mouse: aim · Hold click or Space: power · R: retry (+1) · Esc: menu';
const TOUCH_HINT = 'Drag back to aim and set power · Release to putt · Drag back in to cancel';

function touchControls(cb: () => HudCallbacks): HTMLDivElement {
  const box = el('div', 'touch-controls');
  const retry = button('Retry', () => cb().onRetry());
  retry.setAttribute('aria-label', 'Retry from the tee (+1 stroke)');
  const pause = button('Pause', () => cb().onPause());
  box.append(retry, pause);
  return box;
}

function row(cells: readonly string[], tag: 'td' | 'th'): HTMLTableRowElement {
  const r = el('tr');
  r.append(...cells.map((c) => el(tag, undefined, c)));
  return r;
}

function fillScorecard(table: HTMLTableElement, strokes: readonly number[], holes: readonly Hole[]): void {
  const parTotal = holes.reduce((sum, h) => sum + h.par, 0);
  table.replaceChildren(
    row(['Hole', 'Par', 'Strokes'], 'th'),
    ...holes.map((h, i) => row([`${i + 1} ${h.name}`, String(h.par), String(strokes[i] ?? '-')], 'td')),
    row(['Total', String(parTotal), String(totalStrokes(strokes))], 'th'),
  );
}

export function createHud(root: HTMLElement, touch = false): Hud {
  const noop = () => {};
  let cb: HudCallbacks = { onPlay: noop, onResume: noop, onRestart: noop, onRetry: noop, onPause: noop };
  const hole = stat('Hole', 'hole');
  const par = stat('Par', 'par');
  const strokes = stat('Strokes', 'strokes');
  const bar = el('div', 'bar');
  bar.append(hole.box, par.box, strokes.box);

  const power = el('div', 'power');
  const fill = el('i');
  power.append(fill);

  const popup = el('div', 'popup');
  popup.dataset.testid = 'popup';
  const hint = el('div', 'hint', touch ? TOUCH_HINT : MOUSE_HINT);
  const controls = touchControls(() => cb);

  const title = overlay();
  title.card.classList.add('title-card');
  title.card.style.backgroundImage = `url(${titlePanelUrl})`;
  title.card.append(el('h1', undefined, 'Backyard'), el('p', undefined, '3 holes of mini-golf'), button('Play', () => cb.onPlay()));
  const menu = overlay();
  menu.card.append(el('h1', undefined, 'Paused'), button('Resume', () => cb.onResume()), button('Restart course', () => cb.onRestart()));
  const score = overlay();
  const table = el('table');
  const bestLine = el('p');
  score.card.append(el('h1', undefined, 'Scorecard'), table, bestLine, button('Play again', () => cb.onPlay()));
  const error = overlay();
  const errorText = el('p');
  error.card.append(errorText);

  root.classList.toggle('touch', touch);
  root.append(bar, power, popup, hint, ...(touch ? [controls] : []), title.root, menu.root, score.root, error.root);
  let shownScorecard = '';

  return {
    update(state, holes, best) {
      const h = holes[state.holeIndex];
      const p = state.phase;
      hole.value.textContent = `${state.holeIndex + 1} · ${h.name}`;
      par.value.textContent = String(h.par);
      strokes.value.textContent = String(state.strokes[state.holeIndex] ?? 0);
      const pw = powerOf(p);
      power.classList.toggle('on', pw !== null);
      fill.style.width = pw === null ? '0' : `${Math.round(pw * 100)}%`;
      controls.classList.toggle('on', p.kind === 'aiming' || p.kind === 'dragging' || p.kind === 'charging' || p.kind === 'rolling');
      const message = p.kind === 'holed' ? p.label : p.kind === 'intro' ? `${h.name} · Par ${h.par}` : '';
      popup.textContent = message;
      popup.classList.toggle('on', message !== '');
      title.root.classList.toggle('on', p.kind === 'title');
      menu.root.classList.toggle('on', state.paused);
      score.root.classList.toggle('on', p.kind === 'scorecard');
      if (p.kind === 'scorecard') {
        const key = `${state.strokes.join(',')}|${best}`;
        if (key !== shownScorecard) {
          shownScorecard = key;
          fillScorecard(table, state.strokes, holes);
          bestLine.textContent = best === null ? '' : `Best total: ${best}`;
        }
      }
    },
    showError(message) {
      errorText.textContent = message;
      error.root.classList.add('on');
    },
    setCallbacks(next) {
      cb = next;
    },
  };
}
