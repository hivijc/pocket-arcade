import { describe, expect, it } from 'vitest';
import { canvasScale, isUserActivation, knobOffset, mergeControls, STICK, stickControls } from '../../src/core/touch';

describe('stickControls', () => {
  it('is neutral inside the dead zone', () => {
    expect(stickControls(0, 0)).toEqual({ steer: 0, pedal: 0 });
    expect(stickControls(STICK.dead - 1, -(STICK.dead - 1))).toEqual({ steer: 0, pedal: 0 });
  });
  it('steers with sideways thumb travel', () => {
    expect(stickControls(-30, 0)).toEqual({ steer: -1, pedal: 0 });
    expect(stickControls(30, 4)).toEqual({ steer: 1, pedal: 0 });
  });
  it('pedals faster when pushed up and brakes when pulled down (screen y grows downward)', () => {
    expect(stickControls(0, -30)).toEqual({ steer: 0, pedal: 1 });
    expect(stickControls(0, 30)).toEqual({ steer: 0, pedal: -1 });
  });
  it('steers and pedals together on a diagonal', () => {
    expect(stickControls(25, -25)).toEqual({ steer: 1, pedal: 1 });
  });
});

describe('knobOffset', () => {
  it('follows the thumb inside the ring', () => {
    expect(knobOffset(10, -5)).toEqual([10, -5]);
  });
  it('is clamped to the ring radius, keeping the direction', () => {
    const [x, y] = knobOffset(STICK.max * 3, 0);
    expect(x).toBeCloseTo(STICK.max);
    expect(y).toBeCloseTo(0);
    const [dx, dy] = knobOffset(100, 100);
    expect(Math.hypot(dx, dy)).toBeCloseTo(STICK.max);
  });
});

describe('mergeControls', () => {
  it('lets either source drive each axis, keyboard first when both press', () => {
    expect(mergeControls({ steer: 0, pedal: 1 }, { steer: -1, pedal: 0 })).toEqual({ steer: -1, pedal: 1 });
    expect(mergeControls({ steer: 1, pedal: 0 }, { steer: -1, pedal: -1 })).toEqual({ steer: 1, pedal: -1 });
    expect(mergeControls({ steer: 0, pedal: 0 }, { steer: 0, pedal: 0 })).toEqual({ steer: 0, pedal: 0 });
  });
});

describe('canvasScale', () => {
  it('uses whole-pixel steps on desktops', () => {
    expect(canvasScale(1280, 800, 360, 270, false)).toBe(2);
    expect(canvasScale(390, 844, 360, 270, false)).toBe(1);
  });
  it('fills the limiting side on small touch screens', () => {
    expect(canvasScale(390, 844, 360, 270, true)).toBeCloseTo(390 / 360);
    expect(canvasScale(844, 390, 360, 270, true)).toBeCloseTo(390 / 270);
  });
  it('goes back to whole steps on big touch screens', () => {
    expect(canvasScale(1024, 1366, 360, 270, true)).toBe(2);
  });
});

describe('isUserActivation', () => {
  it('counts the events browsers accept for starting audio', () => {
    expect(isUserActivation('keydown')).toBe(true);
    expect(isUserActivation('touchend')).toBe(true);
    expect(isUserActivation('pointerup', 'touch')).toBe(true);
    expect(isUserActivation('pointerdown', 'mouse')).toBe(true);
    expect(isUserActivation('pointerdown', 'touch')).toBe(false);
    expect(isUserActivation('pointerup', 'mouse')).toBe(false);
  });
});
