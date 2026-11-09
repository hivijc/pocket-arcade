import { describe, expect, it } from 'vitest';
import { hash2 } from '../../src/core/hash';

describe('hash2', () => {
  it('is deterministic and in [0, 1)', () => {
    for (let i = 0; i < 50; i++) {
      const v = hash2(i, i * 3, 7);
      expect(v).toBe(hash2(i, i * 3, 7));
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
  it('changes with the seed', () => {
    expect(hash2(3, 4, 1)).not.toBe(hash2(3, 4, 2));
  });
});
