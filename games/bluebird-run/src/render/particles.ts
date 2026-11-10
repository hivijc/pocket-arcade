import { hash2 } from '../core/hash';
import type { GameEvent } from '../game/events';
import { toRad, type Board } from '../sim/board';
import { BOARD } from '../sim/constants';

export interface Particle {
  readonly c: number;
  readonly d: number;
  readonly z: number;
  readonly vc: number;
  readonly vd: number;
  readonly vz: number;
  readonly life: number;
  readonly max: number;
}

export const MAX_PARTICLES = 120;
const GRAVITY = 6;

const rnd = (seed: number, i: number, k: number): number => hash2(seed, i, k);

/** Snow thrown off the board's outside edge on a hard carve at speed. */
export function spray(b: Board, seed: number): Particle[] {
  if (Math.abs(b.heading) < BOARD.sprayFrom || b.speed < BOARD.spraySpeed) return [];
  const out = -Math.sign(b.heading);
  const r = toRad(b.heading);
  return [0, 1, 2].map((i) => ({
    c: b.c, d: b.d, z: 0.1,
    vc: out * (1.5 + rnd(seed, i, 1) * 1.5),
    vd: Math.cos(r) * b.speed * 0.6 + (rnd(seed, i, 2) - 0.5),
    vz: 1.5 + rnd(seed, i, 3) * 1.5,
    life: 0.5, max: 0.5,
  }));
}

/** A ring of snow from a burst snowman or a crash. */
export function puff(c: number, d: number, seed: number): Particle[] {
  return Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * Math.PI * 2 + rnd(seed, i, 4);
    const v = 1 + rnd(seed, i, 5) * 1.5;
    return { c, d, z: 0.3, vc: Math.cos(a) * v, vd: Math.sin(a) * v, vz: 2 + rnd(seed, i, 6) * 2, life: 0.8, max: 0.8 };
  });
}

export function stepParticles(ps: readonly Particle[], dt: number): Particle[] {
  return ps.flatMap((p) => {
    const life = p.life - dt;
    if (life <= 0) return [];
    const z = Math.max(0, p.z + p.vz * dt);
    const grounded = z === 0;
    return [{
      ...p, life, z,
      c: p.c + (grounded ? 0 : p.vc * dt), d: p.d + (grounded ? 0 : p.vd * dt),
      vz: grounded ? 0 : p.vz - GRAVITY * dt,
    }];
  });
}

/**
 * New particles: puffs for burst/crash events, plus carve spray from the board unless `withSpray` is false
 * (the frame loop sprays every third sim step and adds event puffs once a frame). Capped at MAX_PARTICLES.
 */
export function spawnFor(ps: readonly Particle[], b: Board, events: readonly GameEvent[], seed: number, withSpray = true): Particle[] {
  const puffs = events.flatMap((e, i) => {
    if (e.type === 'burst') return puff(e.at[0], e.at[1], seed + i);
    if (e.type === 'crash' || e.type === 'wipeout') return puff(b.c, b.d, seed + i + 50);
    return [];
  });
  const fresh = [...puffs, ...(!withSpray || b.air || b.tumble > 0 ? [] : spray(b, seed))];
  return [...ps, ...fresh].slice(-MAX_PARTICLES);
}
