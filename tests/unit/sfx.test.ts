import { describe, expect, it } from 'vitest';
import { ambienceFor, audioTransition, puttPitch, puttVolume, rollSpeedOf, rollVolume, shouldPlayAudio, soundsFor } from '../../src/audio/sfx-math';

describe('sound mapping', () => {
  it('putt volume and pitch rise with power and clamp', () => {
    expect(puttVolume(0)).toBeLessThan(puttVolume(1));
    expect(puttVolume(5)).toBe(puttVolume(1));
    expect(puttPitch(1)).toBeGreaterThan(puttPitch(0));
    expect(puttPitch(Number.NaN)).toBe(puttPitch(0));
  });
  it('rolling gets louder with speed and is silent at rest', () => {
    expect(rollVolume(0)).toBe(0);
    expect(rollVolume(3)).toBeGreaterThan(rollVolume(1));
    expect(rollVolume(100)).toBe(rollVolume(6));
  });
  it('birds by day, crickets by dusk and night', () => {
    expect(ambienceFor('morning')).toBe('birds');
    expect(ambienceFor('day')).toBe('birds');
    expect(ambienceFor('dusk')).toBe('crickets');
    expect(ambienceFor('night')).toBe('crickets');
  });
  it('maps ball events to one sound each per frame', () => {
    expect(soundsFor(['wall', 'wall', 'lip', 'holed'])).toEqual(['wall', 'plink']);
    expect(soundsFor(['water'])).toEqual(['splash']);
    expect(soundsFor(['land', 'stopped'])).toEqual(['land']);
    expect(soundsFor([])).toEqual([]);
  });
});

describe('audio pausing', () => {
  it('plays only while the game runs and the page is visible', () => {
    expect(shouldPlayAudio(false, false)).toBe(true);
    expect(shouldPlayAudio(true, false)).toBe(false);
    expect(shouldPlayAudio(false, true)).toBe(false);
    expect(shouldPlayAudio(true, true)).toBe(false);
  });
  it('suspends or resumes only when playability changes', () => {
    expect(audioTransition(true, false)).toBe('suspend');
    expect(audioTransition(false, true)).toBe('resume');
    expect(audioTransition(true, true)).toBeNull();
    expect(audioTransition(false, false)).toBeNull();
  });
  it('rolls only for a grounded rolling ball in an unpaused game', () => {
    const ball = { vx: 3, vy: 4, airborne: false };
    expect(rollSpeedOf({ phase: { kind: 'rolling', t: 1 }, paused: false, ball })).toBe(5);
    expect(rollSpeedOf({ phase: { kind: 'rolling', t: 1 }, paused: true, ball })).toBe(0);
    expect(rollSpeedOf({ phase: { kind: 'rolling', t: 1 }, paused: false, ball: { ...ball, airborne: true } })).toBe(0);
    expect(rollSpeedOf({ phase: { kind: 'aiming' }, paused: false, ball })).toBe(0);
  });
});
