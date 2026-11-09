import titlePanelUrl from '../../assets/ui/title-panel.png';
import { totalStrokes } from '../game/score';
import { chargePower, type GameState } from '../game/state';
import type { Hole } from '../world/hole';

export interface HudCallbacks {
  onPlay(): void;
  onResume(): void;
  onRestart(): void;
  /** A course was picked on the title card. */
  onPickCourse(id: string): void;
  /** Back to the title card to pick another course. */
  onChangeCourse(): void;
}

export interface CourseChoice {
  readonly id: string;
  readonly name: string;
  readonly best: number | null;
}

export interface CourseInfo {
  readonly name: string;
  readonly tagline: string;
  readonly holes: number;
}

export interface Hud {
  update(state: GameState, holes: readonly Hole[], best: number | null): void;
  showError(message: string): void;
  setCallbacks(cb: HudCallbacks): void;
  /** The course being played: its name goes on the title card and in the HUD bar. */
  setCourse(info: CourseInfo): void;
  /** The title card's course picker. */
  setPicker(choices: readonly CourseChoice[], selected: string): void;
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

function pickerButton(c: CourseChoice, selected: boolean, onPick: (id: string) => void): HTMLButtonElement {
  const b = el('button', 'course');
  b.type = 'button';
  b.setAttribute('aria-pressed', String(selected));
  b.dataset.testid = `course-${c.id}`;
  b.append(el('b', undefined, c.name), el('small', undefined, c.best === null ? 'no best yet' : `best ${c.best}`));
  b.addEventListener('click', () => onPick(c.id));
  return b;
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

export function createHud(root: HTMLElement): Hud {
  let cb: HudCallbacks = { onPlay: () => {}, onResume: () => {}, onRestart: () => {}, onPickCourse: () => {}, onChangeCourse: () => {} };
  const course = stat('Course', 'course');
  const hole = stat('Hole', 'hole');
  const par = stat('Par', 'par');
  const strokes = stat('Strokes', 'strokes');
  const bar = el('div', 'bar');
  bar.append(course.box, hole.box, par.box, strokes.box);

  const power = el('div', 'power');
  const fill = el('i');
  power.append(fill);

  const popup = el('div', 'popup');
  popup.dataset.testid = 'popup';
  const hint = el('div', 'hint', 'Mouse: aim · Hold click or Space: power · R: retry (+1) · Esc: menu');

  const title = overlay();
  title.card.classList.add('title-card');
  title.card.style.backgroundImage = `url(${titlePanelUrl})`;
  const titleName = el('h1', undefined, 'Backyard');
  const titleLine = el('p', undefined, 'mini-golf');
  const picker = el('div', 'picker');
  picker.setAttribute('role', 'group');
  picker.setAttribute('aria-label', 'Course');
  title.card.append(titleName, titleLine, picker, button('Play', () => cb.onPlay()));
  const menu = overlay();
  menu.card.append(
    el('h1', undefined, 'Paused'), button('Resume', () => cb.onResume()), button('Restart course', () => cb.onRestart()),
    button('Change course', () => cb.onChangeCourse()),
  );
  const score = overlay();
  const table = el('table');
  const bestLine = el('p');
  score.card.append(
    el('h1', undefined, 'Scorecard'), table, bestLine, button('Play again', () => cb.onPlay()),
    button('Change course', () => cb.onChangeCourse()),
  );
  const error = overlay();
  const errorText = el('p');
  error.card.append(errorText);

  root.append(bar, power, popup, hint, title.root, menu.root, score.root, error.root);
  let shownScorecard = '';

  return {
    update(state, holes, best) {
      const h = holes[state.holeIndex];
      const p = state.phase;
      hole.value.textContent = `${state.holeIndex + 1} · ${h.name}`;
      par.value.textContent = String(h.par);
      strokes.value.textContent = String(state.strokes[state.holeIndex] ?? 0);
      power.classList.toggle('on', p.kind === 'charging');
      fill.style.width = p.kind === 'charging' ? `${Math.round(chargePower(p.t) * 100)}%` : '0';
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
    setCourse(info) {
      titleName.textContent = info.name;
      titleLine.textContent = `${info.holes} holes · ${info.tagline}`;
      course.value.textContent = info.name;
    },
    setPicker(choices, selected) {
      picker.replaceChildren(...choices.map((c) => pickerButton(c, c.id === selected, (id) => cb.onPickCourse(id))));
    },
  };
}
