import { describe, expect, it } from 'vitest';
import { toBuffer } from '../../src/core/input';

describe('toBuffer', () => {
  it('maps a click on a scaled canvas to buffer pixels', () => {
    const rect = { left: 10, top: 20, width: 720, height: 540 };
    expect(toBuffer(10, 20, rect, 360, 270)).toEqual([0, 0]);
    expect(toBuffer(370, 290, rect, 360, 270)).toEqual([180, 135]);
  });
});
