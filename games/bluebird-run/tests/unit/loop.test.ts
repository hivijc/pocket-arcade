import { describe, expect, it } from 'vitest';
import { createStepper } from '../../src/core/loop';

describe('createStepper', () => {
  it('turns elapsed time into whole fixed steps', () => {
    const steps = createStepper(1 / 120);
    expect(steps(1 / 60)).toBe(2);
  });
  it('carries leftover time to the next frame', () => {
    const steps = createStepper(1 / 120);
    expect(steps(1 / 240)).toBe(0);
    expect(steps(1 / 240)).toBe(1);
  });
  it('caps the steps after a long pause', () => {
    const steps = createStepper(1 / 120, 12);
    expect(steps(5)).toBe(12);
    expect(steps(1 / 120)).toBe(1);
  });
  it('ignores negative time', () => {
    expect(createStepper(1 / 120)(-1)).toBe(0);
  });
});
