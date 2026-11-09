import { distance, type Vec2 } from '../core/geometry';
import { inRect, type Rect } from '../world/street';
import type { Bike } from './bike';
import { BIKE_R, CAR_HALF, DOG, PUDDLE, SPRINKLER } from './constants';
import type { PaperPos } from './paper';

/** home → chase → return → done; a treat at any point before done → sit. */
export type DogMode = 'home' | 'chase' | 'return' | 'sit' | 'done';

export interface Dog {
  readonly c: number;
  readonly s: number;
  readonly mode: DogMode;
  /** Seconds spent chasing. */
  readonly timer: number;
}

export const newDog = (home: Vec2): Dog => ({ c: home[0], s: home[1], mode: 'home', timer: 0 });

function moveToward(from: Vec2, to: Vec2, step: number): Vec2 {
  const d = distance(from, to);
  if (d <= step) return to;
  return [from[0] + ((to[0] - from[0]) * step) / d, from[1] + ((to[1] - from[1]) * step) / d];
}

export function stepDog(dog: Dog, home: Vec2, bike: Bike, dt: number): Dog {
  switch (dog.mode) {
    case 'home':
      return Math.abs(bike.s - home[1]) < DOG.trigger ? { ...dog, mode: 'chase', timer: 0 } : dog;
    case 'chase': {
      const timer = dog.timer + dt;
      if (timer >= DOG.chaseTime) return { ...dog, mode: 'return', timer };
      const [c, s] = moveToward([dog.c, dog.s], [bike.c, bike.s], DOG.speed * dt);
      return { c, s, mode: 'chase', timer };
    }
    case 'return': {
      const [c, s] = moveToward([dog.c, dog.s], home, DOG.homeSpeed * dt);
      return { ...dog, c, s, mode: c === home[0] && s === home[1] ? 'done' : 'return' };
    }
    default:
      return dog;
  }
}

export const sitDog = (dog: Dog): Dog => ({ ...dog, mode: 'sit' });

export const dogBites = (dog: Dog, bike: Bike): boolean =>
  dog.mode === 'chase' && distance([dog.c, dog.s], [bike.c, bike.s]) < DOG.r + BIKE_R;

export const dogTakesTreat = (dog: Dog, pos: PaperPos): boolean =>
  (dog.mode === 'home' || dog.mode === 'chase' || dog.mode === 'return') && distance([dog.c, dog.s], [pos.c, pos.s]) <= DOG.treatR;

const PERIOD = SPRINKLER.on + SPRINKLER.off;
export const sprinklerOn = (time: number): boolean => ((time % PERIOD) + PERIOD) % PERIOD < SPRINKLER.on;

export const inSpray = (spray: Rect, bike: Bike, time: number): boolean => sprinklerOn(time) && inRect(spray, bike.c, bike.s);

export const carHits = (at: Vec2, bike: Bike): boolean =>
  Math.abs(bike.c - at[0]) < CAR_HALF[0] + BIKE_R && Math.abs(bike.s - at[1]) < CAR_HALF[1] + BIKE_R;

export const inPuddle = (at: Vec2, bike: Bike): boolean => distance(at, [bike.c, bike.s]) < PUDDLE.r;
