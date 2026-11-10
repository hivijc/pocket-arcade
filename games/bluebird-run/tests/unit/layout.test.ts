import { describe, expect, it } from 'vitest';
import { canvasScale, portraitScale } from '../../src/ui/layout';

describe('canvasScale', () => {
  it('uses whole-pixel steps on desktop', () => {
    expect(canvasScale(1440, 900, 360, 270, false)).toBe(3);
    expect(canvasScale(1000, 900, 360, 270, false)).toBe(2);
    expect(canvasScale(500, 400, 360, 270, false)).toBe(1);
    expect(canvasScale(300, 200, 360, 270, false)).toBe(1);
  });

  it('on touch, keeps whole steps from 2x up', () => {
    expect(canvasScale(1180, 820, 360, 270, true)).toBe(3);
    expect(canvasScale(800, 1200, 360, 270, true)).toBe(2);
  });

  it('on touch below 2x, fills the limiting side with a fractional scale', () => {
    expect(canvasScale(390, 844, 360, 270, true)).toBeCloseTo(390 / 360);
    expect(canvasScale(844, 390, 360, 270, true)).toBeCloseTo(390 / 270);
    expect(canvasScale(320, 568, 360, 270, true)).toBeCloseTo(320 / 360);
  });
});

describe('portraitScale', () => {
  it('fills about 58% of a tall phone screen, cropping the sides', () => {
    expect(portraitScale(375, 812, 360, 270)).toBeCloseTo((0.58 * 812) / 270);
    expect(portraitScale(390, 664, 360, 270)).toBeCloseTo((0.58 * 664) / 270);
  });
  it('never crops below 200 buffer pixels across', () => {
    expect(portraitScale(320, 1400, 360, 270)).toBeCloseTo(320 / 200);
  });
  it('never shrinks below fitting the width', () => {
    expect(portraitScale(390, 400, 360, 270)).toBeCloseTo(390 / 360);
  });
});
