import { describe, expect, it } from 'vitest';
import { isSlingshotPointer, isUserActivation, toBuffer } from '../../src/core/input';

describe('toBuffer', () => {
  it('maps a click on a scaled canvas to buffer pixels', () => {
    const rect = { left: 10, top: 20, width: 720, height: 540 };
    expect(toBuffer(10, 20, rect, 360, 270)).toEqual([0, 0]);
    expect(toBuffer(370, 290, rect, 360, 270)).toEqual([180, 135]);
  });
});

describe('isSlingshotPointer', () => {
  it('uses the slingshot for touch and pen, not mouse', () => {
    expect(isSlingshotPointer('touch')).toBe(true);
    expect(isSlingshotPointer('pen')).toBe(true);
    expect(isSlingshotPointer('mouse')).toBe(false);
    expect(isSlingshotPointer('')).toBe(false);
  });
});

describe('isUserActivation', () => {
  it('counts the events browsers accept for unlocking audio', () => {
    expect(isUserActivation('keydown')).toBe(true);
    expect(isUserActivation('touchend')).toBe(true);
    expect(isUserActivation('pointerdown', 'mouse')).toBe(true);
    expect(isUserActivation('pointerup', 'touch')).toBe(true);
    expect(isUserActivation('pointerup', 'pen')).toBe(true);
  });

  it('does not count a touch pointerdown or a mouse pointerup', () => {
    expect(isUserActivation('pointerdown', 'touch')).toBe(false);
    expect(isUserActivation('pointerup', 'mouse')).toBe(false);
    expect(isUserActivation('mousemove')).toBe(false);
  });
});
