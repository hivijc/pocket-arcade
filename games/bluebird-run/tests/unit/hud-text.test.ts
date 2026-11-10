import { describe, expect, it } from 'vitest';
import { newRun } from '../../src/game/state';
import { clockText, countdownText, endRows, popupText, streakText } from '../../src/ui/hud-text';
import { makeSlope } from '../helpers/make-slope';

describe('hud text', () => {
  it('formats the run clock in tenths, rounding down', () => {
    expect(clockText(0)).toBe('0:00.0');
    expect(clockText(5.29)).toBe('0:05.2');
    expect(clockText(59.96)).toBe('0:59.9');
    expect(clockText(62)).toBe('1:02.0');
  });
  it('shows the countdown number, then Go!', () => {
    expect(countdownText(2.4)).toBe('3');
    expect(countdownText(0.2)).toBe('1');
    expect(countdownText(0)).toBe('Go!');
  });
  it('shows a streak from two gates up', () => {
    expect(streakText(1)).toBe('');
    expect(streakText(4)).toBe('×4');
  });
  it('flashes the latest notable event', () => {
    const trick = { halves: 2, grabbed: true, points: 525, name: '360 Grab' };
    expect(popupText([{ type: 'flake' }, { type: 'land', trick }])).toBe('360 Grab! +525');
    expect(popupText([{ type: 'land', trick: null }])).toBeNull();
    expect(popupText([{ type: 'wipeout' }])).toBe('Wipeout!');
    expect(popupText([{ type: 'crash', what: 'pine' }])).toBe('Ouch!');
    expect(popupText([{ type: 'gate', points: 200, streak: 3 }])).toBe('Gate streak ×3');
    expect(popupText([{ type: 'gate', points: 100, streak: 1 }])).toBeNull();
    expect(popupText([{ type: 'finish', time: 60, bonus: 600 }])).toBe('Finish! +600');
  });
  it('lists the end-card rows', () => {
    const slope = makeSlope({ gates: [{ d: 30, c: [6, 10], color: 'blue' }], flakes: [[8, 20], [8, 22]] });
    const s = { ...newRun(slope), score: 1450, finishTime: 64.32, gates: { next: 1, streak: 1, passed: 1 }, flakes: [1],
      bestTrick: { halves: 1, grabbed: false, points: 150, name: '180' } };
    expect(endRows(s, slope, 2000)).toEqual([
      ['Score', '1450'], ['Time', '1:04.3'], ['Gates', '1/1'], ['Best trick', '180 +150'], ['Snowflakes', '1/2'], ['Best', '2000'],
    ]);
    expect(endRows({ ...s, bestTrick: null }, slope, 0)[3]).toEqual(['Best trick', '—']);
  });
});
