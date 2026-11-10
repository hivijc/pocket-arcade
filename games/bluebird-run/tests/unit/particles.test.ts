import { describe, expect, it } from 'vitest';
import { MAX_PARTICLES, puff, spawnFor, spray, stepParticles } from '../../src/render/particles';
import { newBoard } from '../../src/sim/board';

describe('particles', () => {
  it('throws spray to the outside of a hard carve at speed only', () => {
    const fast = { ...newBoard(8, 10), heading: 60, speed: 6 };
    const ps = spray(fast, 3);
    expect(ps).toHaveLength(3);
    expect(ps.every((p) => p.vc < 0)).toBe(true); // carving toward +c throws snow to −c
    expect(spray({ ...fast, heading: 20 }, 3)).toEqual([]);
    expect(spray({ ...fast, speed: 2 }, 3)).toEqual([]);
  });
  it('puffs ten particles from a burst', () => {
    expect(puff(6, 50, 1)).toHaveLength(10);
  });
  it('falls, settles on the snow and fades out', () => {
    let ps = puff(6, 50, 1);
    ps = stepParticles(ps, 0.1);
    expect(ps.every((p) => p.life < p.max)).toBe(true);
    for (let i = 0; i < 30; i++) ps = stepParticles(ps, 0.1);
    expect(ps).toEqual([]);
  });
  it('spawns from events and the board, capped', () => {
    const b = { ...newBoard(8, 10), heading: 70, speed: 7 };
    const out = spawnFor([], b, [{ type: 'burst', at: [6, 50] }, { type: 'crash', what: 'pine' }], 0);
    expect(out.length).toBe(10 + 10 + 3);
    expect(spawnFor([], b, [], 0, false)).toEqual([]);
    const full = Array.from({ length: MAX_PARTICLES }, () => out[0]);
    expect(spawnFor(full, b, [], 0)).toHaveLength(MAX_PARTICLES);
  });
});
