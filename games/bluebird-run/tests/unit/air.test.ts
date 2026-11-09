import { describe, expect, it } from 'vitest';
import {
  airHeight, canOllie, crossedLip, groundZ, hasLanded, launch, ollie, rampAirtime, stepAir, touchDown,
} from '../../src/sim/air';
import { crash, newBoard, type Board } from '../../src/sim/board';
import { STEP } from '../../src/sim/constants';

const fly = (b: Board, seconds: number, turn = 0, jump = false): Board => {
  let out = b;
  for (let i = 0; i < Math.round(seconds / STEP); i++) out = stepAir(out, { turn, jump }, STEP);
  return out;
};

describe('ollie', () => {
  it('takes off from the ground only', () => {
    const b = { ...newBoard(8, 20), speed: 5 };
    const up = ollie(b);
    expect(up.air).toMatchObject({ kind: 'ollie', duration: 0.45, peak: 0.5, base: 0, t: 0, spin: 0, grab: 0 });
    expect(ollie(up)).toBe(up);
    expect(ollie(crash(b))).toEqual(crash(b));
    expect(canOllie({ ...b, regrab: 0.1 })).toBe(false);
  });
  it('arcs up to 0.5 tiles and lands after 0.45 s', () => {
    const up = ollie({ ...newBoard(8, 20), speed: 5 });
    expect(fly(up, 0.225).z).toBeCloseTo(0.5, 1);
    expect(hasLanded(fly(up, 0.2))).toBe(false);
    expect(hasLanded(fly(up, 0.46))).toBe(true);
  });
});

describe('ramps', () => {
  const ramp = { d: 50, c: 8 };
  it('stays longer in the air the faster you hit the lip', () => {
    expect(rampAirtime(3)).toBeCloseTo(0.8);
    expect(rampAirtime(8)).toBeCloseTo(1.3);
    const air = launch({ ...newBoard(8, 53), speed: 8 }).air!;
    expect(air).toMatchObject({ kind: 'ramp', base: 0.5 });
    expect(air.peak).toBeCloseTo(0.25 * 1.3 * 8);
  });
  it('detects crossing the lip only inside the ramp width', () => {
    const at = (c: number, d: number) => ({ ...newBoard(c, d), speed: 6 });
    expect(crossedLip(ramp, 52.9, at(8, 53.05))).toBe(true);
    expect(crossedLip(ramp, 52.9, at(10.5, 53.05))).toBe(false);
    expect(crossedLip(ramp, 53.1, at(8, 53.2))).toBe(false);
  });
  it('raises the snow along the ramp', () => {
    expect(groundZ([ramp], 8, 49)).toBe(0);
    expect(groundZ([ramp], 8, 51.5)).toBeCloseTo(0.25);
    expect(groundZ([ramp], 12, 51.5)).toBe(0);
  });
});

describe('air step', () => {
  it('starts at the base height, eases down to 0 and moves with take-off speed', () => {
    const a = launch({ ...newBoard(8, 53), speed: 6 }).air!;
    expect(airHeight(a)).toBeCloseTo(0.5);
    expect(airHeight({ ...a, t: a.duration })).toBeCloseTo(0);
    const b = fly(launch({ ...newBoard(8, 53), speed: 6 }), 0.5);
    expect(b.d).toBeCloseTo(56, 1);
    expect(b.speed).toBe(6);
  });
  it('spins at 540°/s with full turn input and builds grab time while jump is held', () => {
    const b = fly(launch({ ...newBoard(8, 53), speed: 8 }), 0.5, -1, true);
    expect(b.air!.spin).toBeCloseTo(-270, 0);
    expect(b.air!.grab).toBeCloseTo(0.5, 1);
    expect(b.air!.grabbing).toBe(true);
    expect(fly(b, STEP, 0, false).air!.grabbing).toBe(false);
  });
  it('touches down on the snow with a short regrab delay', () => {
    const b = touchDown(fly(ollie({ ...newBoard(8, 20), speed: 5 }), 0.5));
    expect(b.air).toBeNull();
    expect(b.z).toBe(0);
    expect(b.regrab).toBe(0.15);
  });
});
