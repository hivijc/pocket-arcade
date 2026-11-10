import { knobOffset, stickControls } from '../core/touch';
import { NO_CONTROLS, type Controls } from '../sim/bike';
import type { Side } from '../world/street';

export interface TouchCallbacks {
  onToss(side: Side): void;
  onPause(): void;
}

export interface TouchControls {
  /** Current steer/pedal from the thumb stick. */
  controls(): Controls;
  /** The pad and buttons only take touches while a run is live and unpaused. */
  setActive(active: boolean): void;
}

interface Thumb {
  readonly id: number;
  readonly x: number;
  readonly y: number;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, parent: HTMLElement, text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = className;
  e.textContent = text;
  parent.append(e);
  return e;
}

function button(parent: HTMLElement, className: string, label: string, text: string, onPress: () => void): HTMLButtonElement {
  const b = el('button', className, parent, text);
  b.type = 'button';
  b.setAttribute('aria-label', label);
  // Act on the press, not the click: a toss has to land the instant the thumb hits.
  b.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    b.classList.add('down');
    onPress();
  });
  const up = () => b.classList.remove('down');
  b.addEventListener('pointerup', up);
  b.addEventListener('pointercancel', up);
  b.addEventListener('pointerleave', up);
  return b;
}

/**
 * Phone controls: a floating thumb stick on the left half (sideways steers, up/down sets speed) and two toss buttons
 * on the right, ↖ for the left-hand yards and ↘ for the right-hand ones, matching where they sit on screen.
 */
export function createTouchControls(root: HTMLElement, cb: TouchCallbacks): TouchControls {
  const box = el('div', 'touch-controls', root);
  const zone = el('div', 'stick-zone', box);
  zone.setAttribute('aria-label', 'Steer: drag sideways, up to speed up, down to brake');
  el('div', 'stick-hint', zone, 'drag to steer');
  const ring = el('div', 'stick-ring', zone);
  const knob = el('div', 'stick-knob', ring);
  const tosses = el('div', 'toss-pad', box);
  button(tosses, 'toss toss-left', 'Toss left', '↖', () => cb.onToss('L'));
  button(tosses, 'toss toss-right', 'Toss right', '↘', () => cb.onToss('R'));
  button(box, 'pause-btn', 'Pause', 'II', () => cb.onPause());

  // Live gesture state for this one control surface: mutated on purpose.
  let thumb: Thumb | null = null;
  let current: Controls = NO_CONTROLS;

  const release = () => {
    thumb = null;
    current = NO_CONTROLS;
    ring.classList.remove('on');
  };
  zone.addEventListener('pointerdown', (e) => {
    if (thumb) return;
    e.preventDefault();
    thumb = { id: e.pointerId, x: e.clientX, y: e.clientY };
    zone.setPointerCapture?.(e.pointerId);
    ring.style.left = `${e.clientX}px`;
    ring.style.top = `${e.clientY}px`;
    knob.style.transform = 'translate(-50%, -50%)';
    ring.classList.add('on');
    zone.classList.add('used');
  });
  zone.addEventListener('pointermove', (e) => {
    if (thumb?.id !== e.pointerId) return;
    const dx = e.clientX - thumb.x;
    const dy = e.clientY - thumb.y;
    current = stickControls(dx, dy);
    const [kx, ky] = knobOffset(dx, dy);
    knob.style.transform = `translate(calc(-50% + ${kx}px), calc(-50% + ${ky}px))`;
  });
  const end = (e: PointerEvent) => {
    if (thumb?.id === e.pointerId) release();
  };
  zone.addEventListener('pointerup', end);
  zone.addEventListener('pointercancel', end);

  return {
    controls: () => current,
    setActive(active) {
      if (box.classList.contains('on') === active) return;
      box.classList.toggle('on', active);
      if (!active) release();
    },
  };
}
