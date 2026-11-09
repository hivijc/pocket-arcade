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

  it('rejects a missing placeholder', () => {
    expect(() => parseManifest({ post: {} })).toThrow(/post\.placeholder is required/);
  });

  it('rejects a bad placeholder', () => {
    expect(() => parseManifest({ post: { placeholder: { color: 1, w: 4, h: 8 } } })).toThrow(/post\.placeholder needs color, w, h/);
  });

  it('rejects a bad footprint', () => {
    expect(() => parseManifest({ post: { footprint: { kind: 'circle', r: -1 }, placeholder } })).toThrow(/post\.footprint must be/);
    expect(() => parseManifest({ post: { footprint: 'round', placeholder } })).toThrow(/post\.footprint must be an object/);
  });
});
