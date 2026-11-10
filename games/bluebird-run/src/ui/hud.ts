import type { GameState } from '../game/state';
import type { Slope } from '../world/slope';
import { clockText, countdownText, endRows, popupText, streakText } from './hud-text';

export interface HudCallbacks {
  onPause(): void;
  onRetry(): void;
  onMute(): void;
}

export interface Hud {
  update(state: GameState, slope: Slope, best: number, time: number, muted: boolean): void;
  showError(message: string): void;
}

const POPUP_SECONDS = 0.9;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, parent: HTMLElement, text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = className;
  e.textContent = text;
  parent.append(e);
  return e;
}

function stat(bar: HTMLElement, label: string): HTMLElement {
  const box = el('div', 'stat', bar);
  const value = el('b', '', box);
  value.dataset.stat = label;
  el('span', '', box, label);
  return value;
}

function overlay(root: HTMLElement, name: string): [HTMLElement, HTMLElement] {
  const o = el('div', `overlay ${name}`, root);
  return [o, el('div', 'card', o)];
}

function button(parent: HTMLElement, text: string, onTap: () => void): HTMLButtonElement {
  const b = el('button', '', parent, text);
  b.type = 'button';
  // A mouse click must not leave focus on the button, or core/input ignores the game keys.
  b.addEventListener('mousedown', (e) => e.preventDefault());
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    b.blur();
    onTap();
  });
  return b;
}

const setText = (e: HTMLElement, text: string) => {
  if (e.textContent !== text) e.textContent = text;
};

const setAttr = (e: HTMLElement, name: string, value: string) => {
  if (e.getAttribute(name) !== value) e.setAttribute(name, value);
};

const KEYS_DESKTOP = '←/→ or A/D carve · Space jump · press Space again in the air to grab · Esc pause';
const KEYS_TOUCH = 'Drag left/right to carve · tap to jump · hold a finger still in the air to grab';

export function createHud(root: HTMLElement, touch: boolean, cb: HudCallbacks): Hud {
  const bar = el('div', 'bar', root);
  const stats = { score: stat(bar, 'score'), time: stat(bar, 'time'), streak: stat(bar, 'streak') };
  const popup = el('div', 'popup', root);
  const count = el('div', 'count', root);
  if (!touch) el('div', 'hint', root, KEYS_DESKTOP);

  const buttons = el('div', 'buttons', root);
  const pauseBtn = button(buttons, 'Pause', cb.onPause);
  const retryBtn = button(buttons, 'Retry', cb.onRetry);
  const muteBtn = button(buttons, 'Mute', cb.onMute);
  pauseBtn.hidden = !touch;
  retryBtn.hidden = !touch;

  const [title, titleCard] = overlay(root, 'title');
  el('h1', '', titleCard, 'Bluebird Run');
  el('p', '', titleCard, 'Carve Pinecone Bowl on a bluebird day. Gates, kickers and a clean landing.');
  el('p', 'keys', titleCard, touch ? KEYS_TOUCH : KEYS_DESKTOP);
  const titleBest = el('p', 'best', titleCard);
  el('p', 'cta', titleCard, touch ? 'Tap to ride' : 'Press Enter to ride');

  const [pause, pauseCard] = overlay(root, 'pause');
  el('h1', '', pauseCard, 'Paused');
  el('p', '', pauseCard, touch ? 'Tap Resume to keep riding · Retry to restart' : 'Esc to keep riding · R to restart');

  const [end, endCard] = overlay(root, 'end');
  el('h1', '', endCard, 'Run complete!');
  const table = el('table', '', endCard);
  el('p', 'cta', endCard, touch ? 'Tap to ride again' : 'Press Enter or R to ride again');

  const [error, errorCard] = overlay(root, 'error');
  const errorText = el('p', '', errorCard);
  let popupUntil = -1;
  let endKey = '';

  return {
    update(s, slope, best, time, muted) {
      setText(stats.score, String(s.score));
      setText(stats.time, clockText(s.time));
      setText(stats.streak, streakText(s.gates.streak) || '–');
      const msg = popupText(s.events);
      if (msg) {
        popup.textContent = msg;
        popupUntil = time + POPUP_SECONDS;
      }
      popup.classList.toggle('on', (s.phase === 'riding' || s.phase === 'runout') && time < popupUntil);
      count.classList.toggle('on', s.phase === 'countdown' || (s.phase === 'riding' && s.time < 0.6));
      setText(count, countdownText(s.phase === 'countdown' ? s.clock : 0));
      bar.classList.toggle('on', s.phase !== 'title');
      buttons.classList.toggle('on', s.phase !== 'title');
      setText(muteBtn, muted ? 'Unmute' : 'Mute');
      setAttr(muteBtn, 'aria-pressed', String(muted));
      setText(pauseBtn, s.paused ? 'Resume' : 'Pause');
      if (s.paused) setAttr(pauseBtn, 'aria-label', 'Resume');
      else if (pauseBtn.hasAttribute('aria-label')) pauseBtn.removeAttribute('aria-label');
      title.classList.toggle('on', s.phase === 'title');
      setText(titleBest, `Best: ${best}`);
      pause.classList.toggle('on', s.paused);
      end.classList.toggle('on', s.phase === 'over');
      if (s.phase === 'over') {
        const rows = endRows(s, slope, best);
        const key = rows.flat().join('|');
        if (key !== endKey) {
          endKey = key;
          table.replaceChildren(...rows.map(([k, v]) => {
            const tr = document.createElement('tr');
            const th = document.createElement('th');
            const td = document.createElement('td');
            th.textContent = k;
            td.textContent = v;
            tr.append(th, td);
            return tr;
          }));
        }
      }
    },
    showError(message) {
      for (const o of [title, pause, end]) o.classList.remove('on');
      errorText.textContent = message;
      error.classList.add('on');
    },
  };
}
