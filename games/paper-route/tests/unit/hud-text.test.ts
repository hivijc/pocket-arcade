import { describe, expect, it } from 'vitest';
import { endTitle, helmetsText, hudCopy, percent, popupText } from '../../src/ui/hud-text';

describe('hud text', () => {
  it('shows helmets left as filled and empty pips', () => {
    expect(helmetsText(3)).toBe('●●●');
    expect(helmetsText(1)).toBe('●○○');
    expect(helmetsText(0)).toBe('○○○');
  });
  it('titles the end card by outcome', () => {
    expect(endTitle('finished')).toBe('Route complete!');
    expect(endTitle('wiped')).toBe('Wiped out!');
  });
  it('formats accuracy as a whole percent', () => {
    expect(percent(0.756)).toBe('76%');
  });
  it('flashes the latest scoring event of the frame', () => {
    expect(popupText([])).toBeNull();
    expect(popupText([{ type: 'toss' }])).toBeNull();
    expect(popupText([{ type: 'deliver', hit: 'porch', lot: 0, points: 250 }])).toBe('+250');
    expect(popupText([{ type: 'deliver', hit: 'mailbox', lot: 0, points: 500 }])).toBe('Mailbox! +500');
    expect(popupText([{ type: 'deliver', hit: 'porch', lot: 0, points: 250 }, { type: 'wrong', lot: 1, points: -100 }])).toBe('Hey! -100');
    expect(popupText([{ type: 'treat', points: 50 }])).toBe('Good dog! +50');
    expect(popupText([{ type: 'pickup' }])).toBe('+5 papers');
    expect(popupText([{ type: 'crash' }])).toBe('Ouch!');
  });
});

describe('hud copy', () => {
  it('speaks keys on desktop and taps on touch screens', () => {
    expect(hudCopy(false).titleCta).toBe('Press Enter to ride');
    expect(hudCopy(true).titleCta).toBe('Tap to ride');
    expect(hudCopy(true).endCta).toBe('Tap to ride again');
    expect(hudCopy(true).pauseHelp).toMatch(/Tap to keep riding/);
    expect(hudCopy(true).hint).toBe('');
    expect(hudCopy(true).keys).toMatch(/stick/);
  });
});
