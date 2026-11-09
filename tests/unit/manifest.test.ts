import { describe, expect, it } from 'vitest';
import { parseManifest } from '../../src/world/manifest';

const placeholder = { color: '#fff', w: 4, h: 8 };

describe('parseManifest', () => {
  it('accepts circle, box and no footprint', () => {
    const m = parseManifest({
      post: { footprint: { kind: 'circle', r: 0.3 }, placeholder },
      crate: { footprint: { kind: 'box', w: 1, d: 2 }, placeholder },
      flower: { placeholder },
    });
    expect(m.post.footprint).toEqual({ kind: 'circle', r: 0.3 });
    expect(m.crate.footprint).toEqual({ kind: 'box', w: 1, d: 2 });
    expect(m.flower.footprint).toBeUndefined();
    expect(m.flower.placeholder).toEqual(placeholder);
  });

  it('rejects a non-object', () => {
    expect(() => parseManifest([])).toThrow(/manifest: must be an object/);
  });

  it('rejects a sprite with neither image nor placeholder', () => {
    expect(() => parseManifest({ post: {} })).toThrow(/post needs an image or a placeholder/);
  });

  it('rejects a bad placeholder', () => {
    expect(() => parseManifest({ post: { placeholder: { color: 1, w: 4, h: 8 } } })).toThrow(/post\.placeholder needs color, w, h/);
  });

  it('rejects a bad footprint', () => {
    expect(() => parseManifest({ post: { footprint: { kind: 'circle', r: -1 }, placeholder } })).toThrow(/post\.footprint must be/);
    expect(() => parseManifest({ post: { footprint: 'round', placeholder } })).toThrow(/post\.footprint must be an object/);
  });

  it('accepts an image, sway and light', () => {
    const m = parseManifest({
      lamp: { image: { src: 'lamp.png', anchor: [8, 40] }, light: { radius: 2.5 } },
      bush: { placeholder, sway: true },
    });
    expect(m.lamp.image).toEqual({ src: 'lamp.png', anchor: [8, 40] });
    expect(m.lamp.light).toEqual({ radius: 2.5 });
    expect(m.lamp.sway).toBe(false);
    expect(m.lamp.placeholder).toBeUndefined();
    expect(m.bush.sway).toBe(true);
  });

  it('rejects bad image, sway or light fields', () => {
    expect(() => parseManifest({ a: { image: { src: '../x.png', anchor: [0, 0] } } })).toThrow(/a\.image needs src/);
    expect(() => parseManifest({ a: { image: { src: 'x.png', anchor: [0] } } })).toThrow(/a\.image needs src/);
    expect(() => parseManifest({ a: { placeholder, sway: 'yes' } })).toThrow(/a\.sway must be true or false/);
    expect(() => parseManifest({ a: { placeholder, light: { radius: 0 } } })).toThrow(/a\.light needs a positive radius/);
  });
});
