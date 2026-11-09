import { describe, expect, it } from 'vitest';
import { isMoving, restingBall, step, strike, type Ball, type BallEvent } from '../../src/physics/ball';
import { simulateShot } from '../../src/physics/simulate';
import { BALL_R, FRICTION, MAX_PUTT_SPEED, SLOPE_ACCEL } from '../../src/physics/constants';
import { gradientAt } from '../../src/physics/terrain';
import { makeHole } from '../helpers/makeHole';
import { parseHole, type Hole } from '../../src/world/hole';
import { parseManifest } from '../../src/world/manifest';
import manifestJson from '../../assets/manifest.json';
import hole1Json from '../../src/world/holes/01.json';
import hole3Json from '../../src/world/holes/03.json';

const speed = (b: Ball) => Math.hypot(b.vx, b.vy);

function runSteps(hole: Hole, ball: Ball, n: number): Ball {
  let b = ball;
  for (let i = 0; i < n; i++) b = step(b, hole).ball;
  return b;
}

describe('strike and rest', () => {
  it('a resting ball does not move and emits nothing', () => {
    const hole = makeHole();
    const ball = restingBall(hole, [2.5, 2.5]);
    const r = step(ball, hole);
    expect(r.ball).toBe(ball);
    expect(r.events).toEqual([]);
    expect(isMoving(ball)).toBe(false);
  });

  it('strike sets velocity from angle and power, clamped to 0..1', () => {
    const hole = makeHole();
    const b = strike(restingBall(hole, [2.5, 2.5]), hole, Math.PI / 2, 2);
    expect(b.vx).toBeCloseTo(0);
    expect(b.vy).toBeCloseTo(MAX_PUTT_SPEED);
  });
});

describe('rolling', () => {
  it('stops on flat green after about v²/(2·friction)', () => {
    const hole = makeHole();
    const r = simulateShot(hole, restingBall(hole, [2.5, 2.5]), 0, 0.5);
    const v = 0.5 * MAX_PUTT_SPEED;
    expect(r.outcome).toBe('stopped');
    expect(r.ball.x - 2.5).toBeCloseTo((v * v) / (2 * FRICTION.G), 0);
    expect(Math.abs(r.ball.x - 2.5 - (v * v) / (2 * FRICTION.G))).toBeLessThan(0.1);
  });

  it('rough stops the ball sooner than green', () => {
    const rough = makeHole({ rows: ['GGGGGGGGGGGGGGGGGGGG', 'GGGGGGGGGGGGGGGGGGGG', 'GGRRRRRRRRRRRRRRRRRR', 'GGGGGGGGGGGGGGGGGGGG', 'GGGGGGGGGGGGGGGGGGGG'] });
    const green = makeHole();
    const a = simulateShot(rough, restingBall(rough, [1.5, 2.5]), 0, 0.5);
    const b = simulateShot(green, restingBall(green, [1.5, 2.5]), 0, 0.5);
    expect(a.ball.x).toBeLessThan(b.ball.x);
  });

  it('rolls further downhill than on the flat', () => {
    const downhill = makeHole({ heightOf: (x) => -2 * x });
    const flat = makeHole();
    const a = runSteps(downhill, strike(restingBall(downhill, [2.5, 2.5]), downhill, 0, 0.2), 60);
    const b = runSteps(flat, strike(restingBall(flat, [2.5, 2.5]), flat, 0, 0.2), 60);
    expect(a.x).toBeGreaterThan(b.x);
  });

  it('stays put on a gentle slope where friction wins', () => {
    const gentle = makeHole({ heightOf: (x) => x });
    const r = simulateShot(gentle, restingBall(gentle, [2.5, 2.5]), 0, 0.3);
    expect(r.outcome).toBe('stopped');
    expect(step(r.ball, gentle).ball).toBe(r.ball);
  });
});

describe('collisions', () => {
  it('bounces off a wall keeping about 70% of its speed', () => {
    const hole = makeHole({ width: 6, cup: [4.5, 0.5] });
    let ball = strike(restingBall(hole, [3, 2.5]), hole, 0, 0.5);
    for (let i = 0; i < 1000; i++) {
      const r = step(ball, hole);
      if (r.events.includes('wall')) {
        expect(r.ball.vx).toBeLessThan(0);
        const ratio = speed(r.ball) / speed(ball);
        expect(ratio).toBeGreaterThan(0.65);
        expect(ratio).toBeLessThan(0.71);
        return;
      }
      ball = r.ball;
    }
    throw new Error('never hit the wall');
  });

  it('a ball the slope presses against a wall does not spam wall events', () => {
    const hole = makeHole({ width: 6, depth: 8, cup: [1.5, 0.5], heightOf: (x) => -2 * x });
    let ball: Ball = { ...restingBall(hole, [6 - BALL_R, 1]), vy: 3 };
    let walls = 0, contactSteps = 0;
    for (let i = 0; i < 600 && isMoving(ball); i++) {
      const r = step(ball, hole);
      walls += r.events.filter((e) => e === 'wall').length;
      if (r.ball.x >= 6 - BALL_R - 1e-9) contactSteps++;
      ball = r.ball;
    }
    expect(contactSteps).toBeGreaterThan(5); // it really was pressed against the wall step after step
    expect(walls).toBeLessThanOrEqual(1);
  });

  it('bounces off a round prop', () => {
    const hole = makeHole({ props: [{ sprite: 'post', at: [6, 2.5] }] });
    const r = simulateShot(hole, restingBall(hole, [3, 2.5]), 0, 0.5);
    expect(r.events).toContain('wall');
    expect(r.ball.x).toBeLessThan(6);
  });

  it('never passes through a wall at full speed', () => {
    const hole = makeHole({ width: 6, cup: [4.5, 0.5] });
    let ball = strike(restingBall(hole, [3, 2.5]), hole, 0, 1);
    for (let i = 0; i < 300; i++) {
      ball = step(ball, hole).ball;
      expect(ball.x).toBeLessThanOrEqual(6 - BALL_R + 1e-9);
    }
  });
});

describe('cup', () => {
  it('drops in when slow enough', () => {
    const hole = makeHole({ cup: [6.5, 2.5] });
    const r = simulateShot(hole, restingBall(hole, [5.5, 2.5]), 0, 0.3);
    expect(r.outcome).toBe('holed');
    expect([r.ball.x, r.ball.y]).toEqual([6.5, 2.5]);
    expect(isMoving(r.ball)).toBe(false);
  });

  /** Rolls a ball toward the cup at (6.5, 2.5) from just outside its radius; returns every event until it rests. */
  function cupPass(speedIn: number, offset: number): BallEvent[] {
    const hole = makeHole({ cup: [6.5, 2.5] });
    let ball: Ball = { ...restingBall(hole, [6.3, 2.5 + offset]), vx: speedIn };
    const events: BallEvent[] = [];
    for (let i = 0; i < 2000 && isMoving(ball); i++) {
      const r = step(ball, hole);
      events.push(...r.events);
      ball = r.ball;
    }
    return events;
  }

  it.each([['dead-centre', 0], ['off-centre', 0.1]])('an entry at 2.4 tiles/s lips out and is not holed (%s)', (_n, offset) => {
    const events = cupPass(2.4, offset);
    expect(events).not.toContain('holed');
    expect(events.filter((e) => e === 'lip')).toHaveLength(1);
  });

  it('an entry just below the capture speed is holed', () => {
    const events = cupPass(2.1, 0.05);
    expect(events).toContain('holed');
    expect(events).not.toContain('lip');
  });

  it('lips out when too fast', () => {
    const hole = makeHole({ cup: [6.5, 2.5] });
    const r = simulateShot(hole, restingBall(hole, [3.5, 2.5]), 0, 1);
    expect(r.events).toContain('lip');
    expect(r.outcome).toBe('stopped');
    expect(r.ball.x).toBeGreaterThan(10);
  });
});

describe('hazards and hops', () => {
  it('water ends the shot with a water event', () => {
    const rows = ['GGGGGGGGGGGGGGGGGGGG', 'GGGGGGGGGGGGGGGGGGGG', 'GGGGGGWWWWGGGGGGGGGG', 'GGGGGGGGGGGGGGGGGGGG', 'GGGGGGGGGGGGGGGGGGGG'];
    const hole = makeHole({ rows });
    expect(simulateShot(hole, restingBall(hole, [1.5, 2.5]), 0, 0.6).outcome).toBe('water');
  });

  it('a ball outside the grid or with a broken value counts as water', () => {
    const hole = makeHole();
    const out: Ball = { ...restingBall(hole, [2.5, 2.5]), x: -1, vx: -1 };
    expect(step(out, hole).events).toContain('water');
    const broken: Ball = { ...restingBall(hole, [2.5, 2.5]), vx: Number.NaN };
    expect(step(broken, hole).events).toContain('water');
  });

  it('launches off a ramp lip and lands', () => {
    const ramp = makeHole({ heightOf: (x) => (x === 5 ? 2 : x === 6 ? 4 : 0) });
    let ball = strike(restingBall(ramp, [1.5, 2.5]), ramp, 0, 1);
    let sawAirborne = false;
    let landed = false;
    for (let i = 0; i < 2000 && isMoving(ball); i++) {
      const r = step(ball, ramp);
      sawAirborne ||= r.ball.airborne;
      landed ||= r.events.includes('land');
      ball = r.ball;
    }
    expect(sawAirborne).toBe(true);
    expect(landed).toBe(true);
  });
});

describe('no spurious hops', () => {
  /** Steps until the ball rests; true if it ever left the ground. */
  function everAirborne(hole: Hole, ball: Ball): boolean {
    let b = ball;
    for (let i = 0; i < 5000 && isMoving(b); i++) {
      b = step(b, hole).ball;
      if (b.airborne) return true;
    }
    return false;
  }

  it('a ball struck downhill from rest on a slope stays grounded', () => {
    const hole = parseHole(hole1Json, parseManifest(manifestJson), 'holes/01.json');
    const struck = strike(restingBall(hole, [5.5, 3.5]), hole, Math.PI, 0.9);
    expect(step(struck, hole).ball.airborne).toBe(false);
    expect(everAirborne(hole, struck)).toBe(false);
  });

  it('strike sets vz to the ground rise rate along the new velocity', () => {
    const slope = makeHole({ heightOf: (x) => x });
    const b = strike(restingBall(slope, [2.5, 2.5]), slope, Math.PI, 0.5);
    const [gx, gy] = [0.25, 0];
    expect(b.vz).toBeCloseTo(gx * b.vx + gy * b.vy);
  });

  it('a ball bouncing off a wall on a slope does not launch', () => {
    const hole = makeHole({ width: 6, cup: [4.5, 0.5], heightOf: (x) => x });
    const ball = strike(restingBall(hole, [3, 2.5]), hole, 0, 0.8);
    let b = ball, hitWall = false;
    for (let i = 0; i < 5000 && isMoving(b); i++) {
      const r = step(b, hole);
      hitWall ||= r.events.includes('wall');
      b = r.ball;
      expect(b.airborne).toBe(false);
    }
    expect(hitWall).toBe(true);
  });
});

describe('slopes steeper than friction', () => {
  const slopeAccel = (hole: Hole, b: Ball) => SLOPE_ACCEL * Math.hypot(...gradientAt(hole, b.x, b.y));

  it('hole 3: a ball that turns back on the ramp rolls back down instead of parking', () => {
    const hole = parseHole(hole3Json, parseManifest(manifestJson), 'holes/03.json');
    const r = simulateShot(hole, restingBall(hole, hole.tee), 0, 0.6);
    expect(['stopped', 'water', 'holed']).toContain(r.outcome);
    if (r.outcome === 'stopped') {
      expect(r.ball.x).toBeLessThan(4); // back on the flat before the ramp
      expect(slopeAccel(hole, r.ball)).toBeLessThan(FRICTION.G);
    }
  });

  it('a slow uphill strike onto a steep ramp rolls back and stops on the flat', () => {
    const hole = makeHole({ heightOf: (x) => (x >= 10 ? 2 * (x - 10) : 0) });
    const r = simulateShot(hole, restingBall(hole, [8.5, 2.5]), 0, 0.4);
    expect(r.outcome).toBe('stopped');
    expect(r.ball.x).toBeLessThan(10);
    expect(slopeAccel(hole, r.ball)).toBeLessThan(FRICTION.G);
  });

  it('on a slope that is steep everywhere the ball ends against the downhill wall, never mid-slope', () => {
    const hole = makeHole({ heightOf: (x) => 2 * x });
    const r = simulateShot(hole, restingBall(hole, [10.5, 2.5]), 0, 0.2);
    expect(r.outcome).toBe('stopped');
    expect(r.ball.x).toBeCloseTo(BALL_R, 2);
  });

  it('a zero-power shot on a steep slope rolls down instead of reporting a stop where it sits', () => {
    const hole = makeHole({ heightOf: (x) => 2 * x });
    const r = simulateShot(hole, restingBall(hole, [10.5, 2.5]), 0, 0);
    expect(r.outcome).toBe('stopped');
    expect(r.ball.x).toBeCloseTo(BALL_R, 2);
  });

  it('a ball never ends a step with zero velocity where the slope beats friction', () => {
    const hole = makeHole({ heightOf: (x) => 2 * x });
    let b = strike(restingBall(hole, [10.5, 2.5]), hole, 0, 0.2);
    for (let i = 0; i < 2000; i++) {
      b = step(b, hole).ball;
      if (b.x > 1) expect(isMoving(b)).toBe(true);
      else break;
    }
  });
});

describe('simulateShot', () => {
  it('is deterministic', () => {
    const hole = makeHole({ props: [{ sprite: 'post', at: [8, 2.4] }] });
    const from = restingBall(hole, [1.5, 2.5]);
    expect(simulateShot(hole, from, 0.05, 0.8)).toEqual(simulateShot(hole, from, 0.05, 0.8));
  });

  it('a zero-power shot stops immediately', () => {
    const hole = makeHole();
    expect(simulateShot(hole, restingBall(hole, [2.5, 2.5]), 0, 0).outcome).toBe('stopped');
  });

  it('reports a timeout when the time limit is too short', () => {
    const hole = makeHole();
    expect(simulateShot(hole, restingBall(hole, [2.5, 2.5]), 0, 1, 0.05).outcome).toBe('timeout');
  });
});
