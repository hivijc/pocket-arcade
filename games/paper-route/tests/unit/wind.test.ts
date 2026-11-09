import { describe, expect, it } from 'vitest';
import { WIND_FPS, windStep } from '../../src/render/wind';

describe('windStep', () => {
  it('alternates 0 and 1 at WIND_FPS', () => {
    expect(windStep(0)).toBe(0);
    expect(windStep(1 / WIND_FPS)).toBe(1);
    expect(windStep(2 / WIND_FPS)).toBe(0);
  });
  it('never goes negative', () => {
    expect(windStep(-0.01)).toBeGreaterThanOrEqual(0);
  });
});
