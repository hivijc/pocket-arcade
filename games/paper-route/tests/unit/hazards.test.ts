import { describe, expect, it } from 'vitest';
import type { Vec2 } from '../../src/core/geometry';
import { newBike } from '../../src/sim/bike';
import { DOG, STEP } from '../../src/sim/constants';
import { carHits, dogBites, dogTakesTreat, inPuddle, inSpray, newDog, sitDog, sprinklerOn, stepDog, type Dog } from '../../src/sim/hazards';

const home: Vec2 = [12, 50];
const bikeAt = (c: number, s: number) => ({ ...newBike(), c, s });

function run(dog: Dog, bike: ReturnType<typeof bikeAt>, seconds: number): Dog {
  let d = dog;
  for (let i = 0; i < Math.round(seconds / STEP); i++) d = stepDog(d, home, bike, STEP);
  return d;
}

describe('dog', () => {
  it('waits at home until the bike is within the trigger distance', () => {
    expect(stepDog(newDog(home), home, bikeAt(7, 40), STEP).mode).toBe('home');
    expect(stepDog(newDog(home), home, bikeAt(7, 50 - DOG.trigger + 0.5), STEP).mode).toBe('chase');
  });
  it('chases toward the bike at its run speed', () => {
    const d = run({ ...newDog(home), mode: 'chase' }, bikeAt(12, 40), 1);
    expect(d.mode).toBe('chase');
    expect(d.c).toBeCloseTo(12);
    expect(d.s).toBeCloseTo(50 - DOG.speed, 1);
  });
  it('gives up after the chase time, trots home, and never chases again', () => {
    const tired = run({ ...newDog(home), mode: 'chase' }, bikeAt(12, 20), DOG.chaseTime + STEP);
    expect(tired.mode).toBe('return');
    const back = run(tired, bikeAt(12, 49), 20);
    expect(back).toMatchObject({ c: 12, s: 50, mode: 'done' });
    expect(stepDog(back, home, bikeAt(12, 49), STEP).mode).toBe('done');
  });
  it('sits for good after a treat', () => {
    const d = sitDog({ ...newDog(home), mode: 'chase' });
    expect(run(d, bikeAt(12, 49), 1)).toEqual(d);
  });
  it('bites only while chasing and touching the bike', () => {
    const chasing: Dog = { c: 7.2, s: 20, mode: 'chase', timer: 0 };
    expect(dogBites(chasing, bikeAt(7, 20))).toBe(true);
    expect(dogBites({ ...chasing, mode: 'return' }, bikeAt(7, 20))).toBe(false);
    expect(dogBites(chasing, bikeAt(7, 22))).toBe(false);
  });
  it('takes a treat that lands close, unless it is already done or sitting', () => {
    const d = newDog(home);
    expect(dogTakesTreat(d, { c: 12.3, s: 50.2, z: 0 })).toBe(true);
    expect(dogTakesTreat(d, { c: 13, s: 51, z: 0 })).toBe(false);
    expect(dogTakesTreat({ ...d, mode: 'done' }, { c: 12, s: 50, z: 0 })).toBe(false);
  });
});

describe('other hazards', () => {
  it('runs sprinklers 1.5 s on, 1.5 s off', () => {
    expect(sprinklerOn(0)).toBe(true);
    expect(sprinklerOn(1.4)).toBe(true);
    expect(sprinklerOn(1.6)).toBe(false);
    expect(sprinklerOn(3.1)).toBe(true);
  });
  it('sprays the bike only inside the spray box while on', () => {
    const spray = { c0: 3.5, s0: 64, c1: 5.5, s1: 69 };
    expect(inSpray(spray, bikeAt(4.5, 66), 0.5)).toBe(true);
    expect(inSpray(spray, bikeAt(4.5, 66), 2)).toBe(false);
    expect(inSpray(spray, bikeAt(7, 66), 0.5)).toBe(false);
  });
  it('hits a parked car by its box plus the bike radius', () => {
    expect(carHits([5.6, 30], bikeAt(6.3, 30))).toBe(true);
    expect(carHits([5.6, 30], bikeAt(6.6, 30))).toBe(false);
    expect(carHits([5.6, 30], bikeAt(5.6, 31.3))).toBe(true);
    expect(carHits([5.6, 30], bikeAt(5.6, 31.5))).toBe(false);
  });
  it('detects a puddle under the bike', () => {
    expect(inPuddle([7, 45], bikeAt(7.3, 45.2))).toBe(true);
    expect(inPuddle([7, 45], bikeAt(8, 45))).toBe(false);
  });
});
