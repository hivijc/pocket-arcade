import { describe, expect, it } from 'vitest';
import { canCrash, crash, newBike, NO_CONTROLS, slowDown, stepBike, type Bike, type Controls } from '../../src/sim/bike';
import { CRASH, RIDE_C, SPEED, START, STEP } from '../../src/sim/constants';

function ride(b: Bike, ctl: Controls, seconds: number): Bike {
  let out = b;
  for (let i = 0; i < Math.round(seconds / STEP); i++) out = stepBike(out, ctl, STEP);
  return out;
}

describe('bike', () => {
  it('starts at the start line at cruise speed', () => {
    expect(newBike()).toEqual({ c: START.c, s: START.s, speed: SPEED.cruise, lean: 0, slow: 0, wobble: 0, invuln: 0 });
  });
  it('rolls forward on its own at cruise speed', () => {
    const b = ride(newBike(), NO_CONTROLS, 1);
    expect(b.s).toBeCloseTo(START.s + SPEED.cruise, 5);
    expect(b.c).toBe(START.c);
  });
  it('speeds up and brakes smoothly', () => {
    expect(ride(newBike(), { steer: 0, pedal: 1 }, 0.25).speed).toBeCloseTo(3.75, 5);
    expect(ride(newBike(), { steer: 0, pedal: 1 }, 2).speed).toBe(SPEED.max);
    expect(ride(newBike(), { steer: 0, pedal: -1 }, 2).speed).toBe(SPEED.min);
  });
  it('drifts across, leans, and stays on the sidewalks and road', () => {
    const b = ride(newBike(), { steer: 1, pedal: 0 }, 0.5);
    expect(b.c).toBeCloseTo(START.c + 2, 5);
    expect(b.lean).toBe(1);
    expect(ride(newBike(), { steer: 1, pedal: 0 }, 5).c).toBe(RIDE_C[1]);
    expect(ride(newBike(), { steer: -1, pedal: 0 }, 5).c).toBe(RIDE_C[0]);
  });
  it('is held to the slow speed while slowed, even when pedalling', () => {
    const b = ride(slowDown(newBike(), 1), { steer: 0, pedal: 1 }, 0.5);
    expect(b.speed).toBe(2);
    expect(b.slow).toBeCloseTo(0.5, 5);
  });
  it('crashes into a wobble with no steering, then blinks', () => {
    const c = crash(newBike());
    expect(c.wobble).toBe(CRASH.wobble);
    expect(c.invuln).toBe(CRASH.wobble + CRASH.invuln);
    expect(canCrash(c)).toBe(false);
    const w = ride(c, { steer: 1, pedal: 1 }, 0.5);
    expect(w.c).toBe(START.c);
    expect(w.lean).toBe(0);
    expect(w.speed).toBeLessThan(SPEED.cruise);
    expect(canCrash(ride(c, NO_CONTROLS, 3))).toBe(true);
  });
  it('never mutates its input', () => {
    const b = newBike();
    stepBike(b, { steer: 1, pedal: 1 }, STEP);
    crash(b);
    slowDown(b, 1);
    expect(b).toEqual(newBike());
  });
});
