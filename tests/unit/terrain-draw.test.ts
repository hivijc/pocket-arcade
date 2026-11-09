import { describe, expect, it } from 'vitest';
import { shadeColor, tileShade } from '../../src/render/terrain-draw';

describe('tileShade', () => {
  it('is neutral on flat rough', () => {
    expect(tileShade(0, 0, 0, 0, 'R')).toBe(1);
  });
  it('lights faces that rise to +x and darkens faces that fall', () => {
    expect(tileShade(0.5, 0, 0, 0, 'R')).toBeGreaterThan(1);
    expect(tileShade(-0.5, 0, 0, 0, 'R')).toBeLessThan(1);
  });
  it('stripes the green like a mown lawn', () => {
    expect(tileShade(0, 0, 0, 0, 'G')).not.toBe(tileShade(0, 0, 1, 0, 'G'));
  });
  it('stays within bounds', () => {
    expect(tileShade(10, 0, 0, 0, 'R')).toBeLessThanOrEqual(1.4);
    expect(tileShade(-10, 0, 0, 0, 'R')).toBeGreaterThanOrEqual(0.6);
  });
});

describe('shadeColor', () => {
  it('scales and clamps channels', () => {
    expect(shadeColor([100, 200, 250], 1.2)).toBe('rgb(120,240,255)');
  });
});
