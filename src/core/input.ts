export type InputEvent =
  | { readonly type: 'aimAt'; readonly sx: number; readonly sy: number }
  | { readonly type: 'press' | 'release' | 'retry' | 'escape' }
  /** A touch/pen slingshot drag, in client pixels from where it went down to where it is now. */
  | { readonly type: 'drag'; readonly start: readonly [number, number]; readonly current: readonly [number, number] }
  /** The slingshot finger lifted (`dragEnd`) or the browser took the pointer away (`dragCancel`). */
  | { readonly type: 'dragEnd' | 'dragCancel' };

export interface Rect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export function toBuffer(clientX: number, clientY: number, rect: Rect, bufW: number, bufH: number): [number, number] {
  return [((clientX - rect.left) * bufW) / rect.width, ((clientY - rect.top) * bufH) / rect.height];
}

/** Touch and pen pointers play by slingshot drag; the mouse keeps hover-aim and hold-to-charge. */
export function isSlingshotPointer(pointerType: string): boolean {
  return pointerType === 'touch' || pointerType === 'pen';
}

/** Whether an event counts as user activation, which browsers require before audio may start. */
export function isUserActivation(type: string, pointerType = ''): boolean {
  if (type === 'keydown' || type === 'touchend' || type === 'mousedown') return true;
  if (type === 'pointerdown') return pointerType === 'mouse';
  if (type === 'pointerup') return pointerType !== 'mouse' && pointerType !== '';
  return false;
}

type Push = (e: InputEvent) => void;
type Detach = () => void;

function attachMouse(canvas: HTMLCanvasElement, bufW: number, bufH: number, push: Push): Detach {
  const onMove = (e: MouseEvent) => {
    const [sx, sy] = toBuffer(e.clientX, e.clientY, canvas.getBoundingClientRect(), bufW, bufH);
    push({ type: 'aimAt', sx, sy });
  };
  const onDown = (e: MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    push({ type: 'press' });
  };
  const onUp = (e: MouseEvent) => {
    if (e.button === 0) push({ type: 'release' });
  };
  window.addEventListener('mousemove', onMove);
  canvas.addEventListener('mousedown', onDown);
  window.addEventListener('mouseup', onUp);
  return () => {
    window.removeEventListener('mousemove', onMove);
    canvas.removeEventListener('mousedown', onDown);
    window.removeEventListener('mouseup', onUp);
  };
}

/** One slingshot pointer at a time; preventDefault on pointerdown also stops the browser's emulated mouse events. */
function attachSlingshot(surface: HTMLElement, push: Push): Detach {
  let active: { id: number; start: readonly [number, number] } | null = null;
  const onDown = (e: PointerEvent) => {
    if (!isSlingshotPointer(e.pointerType) || active) return;
    e.preventDefault();
    active = { id: e.pointerId, start: [e.clientX, e.clientY] };
    surface.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: PointerEvent) => {
    if (active?.id !== e.pointerId) return;
    e.preventDefault();
    push({ type: 'drag', start: active.start, current: [e.clientX, e.clientY] });
  };
  const end = (type: 'dragEnd' | 'dragCancel') => (e: PointerEvent) => {
    if (active?.id !== e.pointerId) return;
    active = null;
    push({ type });
  };
  const onUp = end('dragEnd');
  const onCancel = end('dragCancel');
  surface.addEventListener('pointerdown', onDown);
  surface.addEventListener('pointermove', onMove);
  surface.addEventListener('pointerup', onUp);
  surface.addEventListener('pointercancel', onCancel);
  return () => {
    surface.removeEventListener('pointerdown', onDown);
    surface.removeEventListener('pointermove', onMove);
    surface.removeEventListener('pointerup', onUp);
    surface.removeEventListener('pointercancel', onCancel);
  };
}

function attachKeys(push: Push): Detach {
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'Space') {
      e.preventDefault();
      if (!e.repeat) push({ type: 'press' });
    } else if (e.code === 'KeyR' && !e.repeat) {
      push({ type: 'retry' });
    } else if (e.code === 'Escape' && !e.repeat) {
      push({ type: 'escape' });
    }
  };
  const onKeyUp = (e: KeyboardEvent) => {
    if (e.code === 'Space') push({ type: 'release' });
  };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  return () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
  };
}

/**
 * Listens for mouse, touch/pen and keyboard input and reports it as InputEvents. Touch/pen drags are taken on
 * `dragSurface` (the whole stage, so a drag can start in the letterbox around the canvas). Returns a detach function.
 */
export function attachInput(canvas: HTMLCanvasElement, bufW: number, bufH: number, push: Push, dragSurface: HTMLElement = canvas): Detach {
  const detach = [attachMouse(canvas, bufW, bufH, push), attachSlingshot(dragSurface, push), attachKeys(push)];
  return () => detach.forEach((d) => d());
}
