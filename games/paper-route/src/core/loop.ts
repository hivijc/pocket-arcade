/** Returns a function that converts frame time into a whole number of fixed steps, carrying the remainder. */
export function createStepper(stepSeconds: number, maxSteps = 12): (dt: number) => number {
  let acc = 0;
  return (dt: number) => {
    acc += Math.max(0, dt);
    const n = Math.min(maxSteps, Math.floor(acc / stepSeconds + 1e-9));
    acc = n === maxSteps ? 0 : Math.max(0, acc - n * stepSeconds);
    return n;
  };
}

/**
 * Calls `frame(dt)` every animation frame (dt in seconds, capped at 0.25). Returns a stop function,
 * which is safe to call from inside `frame`.
 */
export function startLoop(frame: (dt: number) => void): () => void {
  let last = performance.now();
  let id = 0;
  let running = true;
  const tick = (now: number) => {
    const dt = Math.min(0.25, (now - last) / 1000);
    last = now;
    frame(dt);
    if (running) id = requestAnimationFrame(tick);
  };
  id = requestAnimationFrame(tick);
  return () => {
    running = false;
    cancelAnimationFrame(id);
  };
}
