import titlePanelUrl from '../../assets/ui/title-panel.png';
import { isCelebration, totalStrokes } from '../game/score';
import { chargePower, type GameState } from '../game/state';
import { courseSubtitle } from '../world/course';
import type { Hole } from '../world/hole';

export interface HudCallbacks {
  onPlay(): void;
  onResume(): void;
  onRestart(): void;
}

export interface Hud {
  /** `newBest` is true when the course just finished beat (or set) the best total. */
  update(state: GameState, holes: readonly Hole[], best: number | null, newBest?: boolean): void;
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

function row(cells: readonly string[], tag: 'td' | 'th', order?: number): HTMLTableRowElement {
  const r = el('tr');
  r.append(...cells.map((c) => el(tag, undefined, c)));
  if (order !== undefined) {
    r.classList.add('reveal');
    r.style.setProperty('--i', String(order));
  }
  return r;
}

function fillScorecard(table: HTMLTableElement, strokes: readonly number[], holes: readonly Hole[], newBest: boolean): void {
  const parTotal = holes.reduce((sum, h) => sum + h.par, 0);
  const total = row(['Total', String(parTotal), String(totalStrokes(strokes))], 'th', holes.length);
  total.classList.add('total');
  total.classList.toggle('best', newBest);
  table.replaceChildren(
    row(['Hole', 'Par', 'Strokes'], 'th'),
    ...holes.map((h, i) => row([`${i + 1} ${h.name}`, String(h.par), String(strokes[i] ?? '-')], 'td', i)),
    total,
  );
}

/** Restarts the popup's CSS pop-in by re-adding its class (a reflow in between replays the animation). */
function pop(popup: HTMLElement, big: boolean): void {
  popup.classList.remove('pop', 'big');
  void popup.offsetWidth;
  popup.classList.add('pop');
  popup.classList.toggle('big', big);
}

export function createHud(root: HTMLElement): Hud {
  let cb: HudCallbacks = { onPlay: () => {}, onResume: () => {}, onRestart: () => {} };
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
  const hint = el('div', 'hint', 'Mouse: aim · Hold click or Space: power · R: retry (+1) · Esc: menu');

  const title = overlay();
  title.card.classList.add('title-card');
  title.card.style.backgroundImage = `url(${titlePanelUrl})`;
  const subtitle = el('p');
  title.card.append(el('h1', undefined, 'Backyard'), subtitle, button('Play', () => cb.onPlay()));
  const menu = overlay();
  menu.card.append(el('h1', undefined, 'Paused'), button('Resume', () => cb.onResume()), button('Restart course', () => cb.onRestart()));
  const score = overlay();
  const table = el('table');
  const bestLine = el('p');
  score.card.append(el('h1', undefined, 'Scorecard'), table, bestLine, button('Play again', () => cb.onPlay()));
  const error = overlay();
  const errorText = el('p');
  error.card.append(errorText);

  root.append(bar, power, popup, hint, title.root, menu.root, score.root, error.root);
  let shownScorecard = '';
  let shownPopup = '';

  return {
    update(state, holes, best, newBest = false) {
      const h = holes[state.holeIndex];
      const p = state.phase;
      const sub = courseSubtitle(holes.length);
      if (subtitle.textContent !== sub) subtitle.textContent = sub;
      hole.value.textContent = `${state.holeIndex + 1} · ${h.name}`;
      par.value.textContent = String(h.par);
      strokes.value.textContent = String(state.strokes[state.holeIndex] ?? 0);
      power.classList.toggle('on', p.kind === 'charging');
      fill.style.width = p.kind === 'charging' ? `${Math.round(chargePower(p.t) * 100)}%` : '0';
      const message = p.kind === 'holed' ? p.label : p.kind === 'intro' ? `${h.name} · Par ${h.par}` : '';
      const popupKey = `${state.holeIndex}|${p.kind}|${message}`;
      if (popupKey !== shownPopup) {
        shownPopup = popupKey;
        popup.textContent = message;
        if (message !== '') pop(popup, p.kind === 'holed' && isCelebration(state.strokes[state.holeIndex], h.par));
      }
      popup.classList.toggle('on', message !== '');
      title.root.classList.toggle('on', p.kind === 'title');
      menu.root.classList.toggle('on', state.paused);
      score.root.classList.toggle('on', p.kind === 'scorecard');
      if (p.kind === 'scorecard') {
        const key = `${state.strokes.join(',')}|${best}|${newBest}`;
        if (key !== shownScorecard) {
          shownScorecard = key;
          fillScorecard(table, state.strokes, holes, newBest);
          bestLine.textContent = best === null ? '' : newBest ? `New best! ${best}` : `Best total: ${best}`;
          bestLine.className = newBest ? 'reveal new-best' : 'reveal';
          bestLine.style.setProperty('--i', String(holes.length + 1));
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
