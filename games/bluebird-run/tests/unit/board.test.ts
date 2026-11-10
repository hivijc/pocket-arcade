import { describe, expect, it } from 'vitest';
import {
  canCrash, carveBrake, crash, facing, inPowder, newBoard, stepGround, stepTumble, turnHeading, type Board, type Controls,
} from '../../src/sim/board';
import { STEP } from '../../src/sim/constants';

const ride = (b: Board, seconds: number, controls: Controls = { turn: 0, jump: false }): Board => {
  let out = b;
  for (let i = 0; i < Math.round(seconds / STEP); i++) out = stepGround(out, controls, STEP);
  return out;
};

describe('heading', () => {
  it('turns at 150°/s and clamps at ±75', () => {
    expect(turnHeading(0, 1, 0.1)).toBeCloseTo(15);
    expect(turnHeading(0, -0.5, 0.1)).toBeCloseTo(-7.5);
    expect(turnHeading(70, 1, 0.1)).toBe(75);
    expect(turnHeading(-70, -1, 0.1)).toBe(-75);
  });
  it('straightens at 40°/s with no input, stopping exactly at 0', () => {
    expect(turnHeading(10, 0, 0.1)).toBeCloseTo(6);
    expect(turnHeading(-1, 0, 0.1)).toBe(0);
  });
});

describe('speed', () => {
  it('accelerates straight down toward a top speed of 8 tiles/s', () => {
    const b = ride(newBoard(8, 10), 12);
    expect(b.speed).toBeGreaterThan(7.9);
    expect(b.speed).toBeLessThanOrEqual(8);
  });
  it('never drops below 1 tile/s', () => {
    expect(ride(newBoard(8, 10), 0.1).speed).toBeGreaterThanOrEqual(1);
  });
  it('brakes on a hard carve', () => {
    expect(carveBrake(30)).toBe(0);
    expect(carveBrake(75)).toBeCloseTo(4);
    const fast = { ...newBoard(8, 10), speed: 8, heading: 75 };
    expect(ride(fast, 3, { turn: 1, jump: false }).speed).toBeLessThan(2);
  });
  it('is slow in deep powder at the edges', () => {
    expect(inPowder(1)).toBe(true);
    expect(inPowder(8)).toBe(false);
    expect(inPowder(15)).toBe(true);
    expect(ride(newBoard(1, 10), 12).speed).toBeLessThan(3);
  });
});

describe('movement', () => {
  it('moves downhill, and toward larger c when heading right', () => {
    const b = ride({ ...newBoard(8, 10), speed: 4, heading: 30 }, 0.5, { turn: 0.0001, jump: false });
    expect(b.d).toBeGreaterThan(10);
    expect(b.c).toBeGreaterThan(8);
  });
  it('keeps the rider on the slope', () => {
    const right = ride({ ...newBoard(15, 10), heading: 75, speed: 6 }, 2, { turn: 1, jump: false });
    const left = ride({ ...newBoard(1, 10), heading: -75, speed: 6 }, 2, { turn: -1, jump: false });
    expect(right.c).toBe(15.6);
    expect(left.c).toBe(0.4);
  });
});

describe('control clamping', () => {
  it('treats turn 2 like turn 1', () => {
    expect(turnHeading(0, 2, 0.1)).toBeCloseTo(15);
    expect(turnHeading(0, -3, 0.1)).toBeCloseTo(-15);
  });
});

describe('crash', () => {
  it('tumbles, slides to a stop, then stands up facing downhill with invulnerability', () => {
    const hit = crash({ ...newBoard(8, 50), speed: 6, heading: 40 });
    expect(hit.tumble).toBe(1.2);
    expect(canCrash(hit)).toBe(false);
    let b = hit;
    for (let i = 0; i < 80; i++) b = stepTumble(b, STEP);
    expect(b.tumble).toBe(0);
    expect(b.heading).toBe(0);
    expect(b.speed).toBe(0);
    expect(b.invuln).toBe(1.5);
    expect(b.d).toBeGreaterThan(50);
    expect(canCrash(ride(b, 1.6))).toBe(true);
  });
  it('does not re-arm invulnerability once the tumble is over', () => {
    const b = { ...newBoard(8, 50), speed: 2, invuln: 0.3 };
    expect(stepTumble(b, STEP)).toBe(b);
  });
  it('reports facing as heading plus any spin', () => {
    const b = newBoard(8, 10);
    expect(facing({ ...b, heading: 20 })).toBe(20);
    expect(facing({ ...b, heading: 20, air: { kind: 'ollie', t: 0, duration: 1, peak: 1, base: 0, spin: 180, grab: 0, grabbing: false } })).toBe(200);
  });
});
