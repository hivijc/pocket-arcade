import { accuracy } from '../game/score';
import type { GameState } from '../game/state';
import type { Street } from '../world/street';
import { endTitle, helmetsText, hudCopy, percent, popupText } from './hud-text';

export interface Hud {
  update(state: GameState, street: Street, best: number, time: number): void;
  showError(message: string): void;
}

const POPUP_SECONDS = 0.8;

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

/** A centred overlay with a card; returns [overlay, card]. */
function overlay(root: HTMLElement, name: string): [HTMLElement, HTMLElement] {
  const o = el('div', `overlay ${name}`, root);
  return [o, el('div', 'card', o)];
}

const setText = (e: HTMLElement, text: string) => {
  if (e.textContent !== text) e.textContent = text;
};

function row(table: HTMLElement, label: string): HTMLElement {
  const tr = el('tr', '', table);
  el('th', '', tr, label);
  return el('td', '', tr);
}

const subscriberCounts = new WeakMap<Street, number>(); // a cache keyed by street: mutated on purpose

function subscribersOf(street: Street): number {
  const hit = subscriberCounts.get(street);
  if (hit !== undefined) return hit;
  const n = street.lots.filter((l) => l.subscriber).length;
  subscriberCounts.set(street, n);
  return n;
}

export interface HudOptions {
  /** Touch screen: tap wording, no key hint, and the cards take taps. */
  readonly touch?: boolean;
  /** A tap on the title or end card. */
  readonly onStart?: () => void;
  /** A tap on the pause card. */
  readonly onResume?: () => void;
}

/** Makes a card's overlay answer taps (touch play has no Enter or Esc key). */
function onTap(o: HTMLElement, act: (() => void) | undefined): void {
  if (!act) return;
  o.classList.add('tappable');
  o.addEventListener('pointerup', (e) => {
    e.preventDefault();
    act();
  });
}

export function createHud(root: HTMLElement, opts: HudOptions = {}): Hud {
  const copy = hudCopy(opts.touch === true);
  root.classList.toggle('touch', opts.touch === true);
  const bar = el('div', 'bar', root);
  const stats = { score: stat(bar, 'score'), papers: stat(bar, 'papers'), delivered: stat(bar, 'delivered'), helmets: stat(bar, 'helmets') };
  const popup = el('div', 'popup', root);
  if (copy.hint) el('div', 'hint', root, copy.hint);

  const [title, titleCard] = overlay(root, 'title');
  el('h1', '', titleCard, 'Paper Route');
  el('p', '', titleCard, 'Deliver the morning paper down Maple Lane. Mind the dog.');
  el('p', 'keys', titleCard, copy.keys);
  const titleBest = el('p', 'best', titleCard);
  el('p', 'cta', titleCard, copy.titleCta);

  const [pause, pauseCard] = overlay(root, 'pause');
  el('h1', '', pauseCard, 'Paused');
  el('p', '', pauseCard, copy.pauseHelp);

  const [end, endCard] = overlay(root, 'end');
  const endHeading = el('h1', '', endCard);
  const table = el('table', '', endCard);
  const cells = { delivered: row(table, 'Deliveries'), accuracy: row(table, 'Accuracy'), score: row(table, 'Score'), best: row(table, 'Best') };
  el('p', 'cta', endCard, copy.endCta);

  if (opts.touch) {
    onTap(title, opts.onStart);
    onTap(end, opts.onStart);
    onTap(pause, opts.onResume);
  }

  const [error, errorCard] = overlay(root, 'error');
  const errorText = el('p', '', errorCard);
  let popupUntil = -1;

  return {
    update(s, street, best, time) {
      const subs = subscribersOf(street);
      setText(stats.score, String(s.score));
      setText(stats.papers, String(s.papers));
      setText(stats.delivered, `${s.delivered}/${subs}`);
      setText(stats.helmets, helmetsText(s.helmets));
      const msg = popupText(s.events);
      if (msg) {
        popup.textContent = msg;
        popupUntil = time + POPUP_SECONDS;
      }
      popup.classList.toggle('on', s.phase === 'riding' && time < popupUntil);
      bar.classList.toggle('on', s.phase !== 'title');
      title.classList.toggle('on', s.phase === 'title');
      setText(titleBest, `Best: ${best}`);
      pause.classList.toggle('on', s.phase === 'riding' && s.paused);
      end.classList.toggle('on', s.phase === 'over');
      if (s.phase === 'over') {
        setText(endHeading, endTitle(s.outcome));
        setText(cells.delivered, `${s.delivered}/${subs}`);
        setText(cells.accuracy, percent(accuracy(s.delivered, s.throws)));
        setText(cells.score, String(s.score));
        setText(cells.best, String(best));
      }
    },
    showError(message) {
      for (const o of [title, pause, end]) o.classList.remove('on');
      errorText.textContent = message;
      error.classList.add('on');
    },
  };
}
