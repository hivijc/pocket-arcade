import { describe, expect, it } from 'vitest';
import { chimePitch, cuesFor, swishFor } from '../../src/audio/sfx-math';
import { newRun } from '../../src/game/state';
import { ollie } from '../../src/sim/air';
import { makeSlope } from '../helpers/make-slope';

describe('cues', () => {
  it('maps events to sounds, once each per frame', () => {
    expect(cuesFor([{ type: 'flake' }, { type: 'flake' }, { type: 'ollie' }])).toEqual([{ sound: 'tick' }, { sound: 'pop' }]);
    expect(cuesFor([{ type: 'land', trick: { halves: 1, grabbed: false, points: 150, name: '180' } }])).toEqual([{ sound: 'thud' }, { sound: 'sparkle' }]);
    expect(cuesFor([{ type: 'crash', what: 'pine' }, { type: 'wipeout' }])).toEqual([{ sound: 'crunch' }]);
    expect(cuesFor([{ type: 'miss' }, { type: 'burst', at: [1, 1] }])).toEqual([]);
    expect(cuesFor([{ type: 'beep', n: 2 }, { type: 'go' }, { type: 'finish', time: 1, bonus: 0 }])).toEqual([{ sound: 'beep' }, { sound: 'go' }, { sound: 'sting' }]);
  });
  it('steps the gate chime up a semitone per streak, capped at an octave', () => {
    expect(chimePitch(1)).toBeCloseTo(660);
    expect(chimePitch(2)).toBeCloseTo(660 * 2 ** (1 / 12));
    expect(chimePitch(40)).toBeCloseTo(1320);
    expect(cuesFor([{ type: 'gate', points: 100, streak: 1 }])).toEqual([{ sound: 'chime', pitch: 660 }]);
  });
});

describe('swish', () => {
  const slope = makeSlope();
  const riding = { ...newRun(slope), phase: 'riding' as const };
  it('is silent off the snow or outside a run', () => {
    expect(swishFor({ ...riding, board: ollie({ ...riding.board, speed: 6 }) }).level).toBe(0);
    expect(swishFor({ ...riding, phase: 'title' }).level).toBe(0);
    expect(swishFor({ ...riding, paused: true, board: { ...riding.board, speed: 8, heading: 60 } }).level).toBe(0);
  });
  it('grows with speed and lean, and brightens with lean', () => {
    const slow = swishFor({ ...riding, board: { ...riding.board, speed: 2, heading: 10 } });
    const hard = swishFor({ ...riding, board: { ...riding.board, speed: 8, heading: 70 } });
    expect(hard.level).toBeGreaterThan(slow.level);
    expect(hard.cutoff).toBeGreaterThan(slow.cutoff);
    expect(hard.level).toBeLessThanOrEqual(0.35);
  });
});
