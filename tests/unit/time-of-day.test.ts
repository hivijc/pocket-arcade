import { describe, expect, it } from 'vitest';
import { PHASES, PHASE_IDS, gradeColor, phaseAt, phaseFor } from '../../src/render/time-of-day';

describe('phaseAt', () => {
  it.each([
    [4, 'night'], [5, 'morning'], [9, 'morning'], [10, 'day'], [16, 'day'],
    [17, 'dusk'], [19, 'dusk'], [20, 'night'], [0, 'night'], [23, 'night'],
  ])('%i:00 is %s', (hour, phase) => {
    expect(phaseAt(hour)).toBe(phase);
  });
});

describe('phaseFor', () => {
  it('uses ?phase= when valid', () => {
    expect(phaseFor('?phase=night', 12)).toBe('night');
    expect(phaseFor('?x=1&phase=dusk', 12)).toBe('dusk');
  });
  it('falls back to the clock', () => {
    expect(phaseFor('', 12)).toBe('day');
    expect(phaseFor('?phase=noon', 12)).toBe('day');
  });
});

describe('grades', () => {
  it('day leaves colours unchanged', () => {
    expect(gradeColor([10, 200, 90], PHASES.day.grade)).toEqual([10, 200, 90]);
  });
  it('night darkens and cools', () => {
    const [r, g, b] = gradeColor([200, 200, 200], PHASES.night.grade);
    expect(r).toBeLessThan(200);
    expect(b).toBeGreaterThan(r);
  });
  it('clamps to 0..255', () => {
    expect(gradeColor([255, 255, 255], PHASES.morning.grade).every((v) => v <= 255)).toBe(true);
  });
  it('lamps light only at dusk and night', () => {
    expect(PHASE_IDS.filter((id) => PHASES[id].lamps)).toEqual(['dusk', 'night']);
  });
});
