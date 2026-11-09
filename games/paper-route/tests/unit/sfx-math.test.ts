import { describe, expect, it } from 'vitest';
import { soundsFor } from '../../src/audio/sfx-math';

describe('soundsFor', () => {
  it('maps events to sounds, each once, in order', () => {
    expect(soundsFor([
      { type: 'toss' }, { type: 'toss' },
      { type: 'deliver', hit: 'mailbox', lot: 0, points: 500 },
      { type: 'deliver', hit: 'porch', lot: 1, points: 250 },
      { type: 'wrong', lot: 2, points: -100 },
      { type: 'splash' }, { type: 'spray' }, { type: 'finish', bonus: 0 },
    ])).toEqual(['toss', 'ding', 'thwack', 'bark', 'splash', 'fanfare']);
  });
  it('plays nothing for no events', () => {
    expect(soundsFor([])).toEqual([]);
  });
});
