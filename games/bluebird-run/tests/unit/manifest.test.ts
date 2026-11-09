import { describe, expect, it } from 'vitest';
import manifestJson from '../../assets/manifest.json';
import { ManifestError, parseManifest } from '../../src/world/manifest';

describe('parseManifest', () => {
  it('parses placeholders and images, defaulting frames to 1 and fps to 8', () => {
    const m = parseManifest({
      a: { placeholder: { color: '#ff0000', w: 4, h: 6 } },
      b: { image: { src: 'b.png', anchor: [3, 7] } },
      c: { image: { src: 'c.png', anchor: [2, 3], frames: 4, fps: 12 } },
    });
    expect(m.a.placeholder).toEqual({ color: '#ff0000', w: 4, h: 6 });
    expect(m.b.image).toEqual({ src: 'b.png', anchor: [3, 7], frames: 1, fps: 8 });
    expect(m.c.image).toEqual({ src: 'c.png', anchor: [2, 3], frames: 4, fps: 12 });
  });
  it.each([
    ['a non-object', 3, /must be an object/],
    ['an empty def', { a: {} }, /a needs an image or a placeholder/],
    ['a bad placeholder', { a: { placeholder: { color: '#f00' } } }, /a\.placeholder/],
    ['a path in src', { a: { image: { src: '../x.png', anchor: [0, 0] } } }, /a\.image/],
    ['zero frames', { a: { image: { src: 'a.png', anchor: [0, 0], frames: 0 } } }, /a\.image\.frames/],
  ])('rejects %s', (_l, raw, msg) => {
    expect(() => parseManifest(raw)).toThrow(ManifestError);
    expect(() => parseManifest(raw)).toThrow(msg);
  });
  it('parses the game manifest, which has every sprite the slope and renderer use', () => {
    const m = parseManifest(manifestJson);
    for (const name of ['pine', 'rock-s', 'rock-l', 'snowman', 'flag-blue', 'flag-red', 'ramp', 'flake', 'hut', 'banner',
      'skier-red', 'skier-green', 'boarder-purple']) {
      expect(m[name], name).toBeDefined();
    }
  });
});
