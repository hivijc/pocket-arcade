export type InputEvent =
  | { readonly type: 'aimAt'; readonly sx: number; readonly sy: number }
  | { readonly type: 'press' | 'release' | 'retry' | 'escape' };

export interface Rect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export function toBuffer(clientX: number, clientY: number, rect: Rect, bufW: number, bufH: number): [number, number] {
  return [((clientX - rect.left) * bufW) / rect.width, ((clientY - rect.top) * bufH) / rect.height];
}

/** Listens for mouse and keyboard input and reports it as InputEvents. Returns a detach function. */
export function attachInput(canvas: HTMLCanvasElement, bufW: number, bufH: number, push: (e: InputEvent) => void): () => void {
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
  window.addEventListener('mousemove', onMove);
  canvas.addEventListener('mousedown', onDown);
  window.addEventListener('mouseup', onUp);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  return () => {
    window.removeEventListener('mousemove', onMove);
    canvas.removeEventListener('mousedown', onDown);
    window.removeEventListener('mouseup', onUp);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
  };
}
