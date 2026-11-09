import { describe, expect, it } from 'vitest';
import { isCleanLanding, trickName, trickOf } from '../../src/sim/tricks';

describe('isCleanLanding', () => {
  it.each([[0, true], [30, true], [35, true], [36, false], [90, false], [145, true], [180, true], [216, false], [360, true], [-180, true], [-200, true], [-250, false]])(
    'spin %s° → %s', (spin, clean) => {
      expect(isCleanLanding(spin)).toBe(clean);
    },
  );
});

describe('trickOf', () => {
  it('is null for a plain landing', () => {
    expect(trickOf(10, 0.1)).toBeNull();
  });
  it('scores 150 per 180° of spin in either direction', () => {
    expect(trickOf(360, 0)).toEqual({ halves: 2, grabbed: false, points: 300, name: '360' });
    expect(trickOf(-170, 0)).toEqual({ halves: 1, grabbed: false, points: 150, name: '180' });
  });
  it('needs 0.3 s of grab for the grab bonus', () => {
    expect(trickOf(0, 0.29)).toBeNull();
    expect(trickOf(0, 0.3)).toEqual({ halves: 0, grabbed: true, points: 200, name: 'Grab' });
    expect(trickOf(180, 0.5)).toEqual({ halves: 1, grabbed: true, points: 350, name: '180 Grab' });
  });
  it('adds a ×1.5 style bonus for 360° or more with a grab', () => {
    expect(trickOf(540, 0.4)).toEqual({ halves: 3, grabbed: true, points: 975, name: '540 Grab' });
  });
  it('names tricks', () => {
    expect(trickName(4, false)).toBe('720');
    expect(trickName(0, true)).toBe('Grab');
  });
});
