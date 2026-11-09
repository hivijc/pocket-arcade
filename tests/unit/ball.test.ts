import { describe, expect, it } from 'vitest';
import { isMoving, restingBall, step, strike, type Ball } from '../../src/physics/ball';
import { simulateShot } from '../../src/physics/simulate';
import { BALL_R, FRICTION, MAX_PUTT_SPEED } from '../../src/physics/constants';
import { makeHole } from '../helpers/makeHole';
import type { Hole } from '../../src/world/hole';

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
    const b = strike(restingBall(hole, [2.5, 2.5]), Math.PI / 2, 2);
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
    const a = runSteps(downhill, strike(restingBall(downhill, [2.5, 2.5]), 0, 0.2), 60);
    const b = runSteps(flat, strike(restingBall(flat, [2.5, 2.5]), 0, 0.2), 60);
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
    let ball = strike(restingBall(hole, [3, 2.5]), 0, 0.5);
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

  it('bounces off a round prop', () => {
    const hole = makeHole({ props: [{ sprite: 'post', at: [6, 2.5] }] });
    const r = simulateShot(hole, restingBall(hole, [3, 2.5]), 0, 0.5);
    expect(r.events).toContain('wall');
    expect(r.ball.x).toBeLessThan(6);
  });

  it('never passes through a wall at full speed', () => {
    const hole = makeHole({ width: 6, cup: [4.5, 0.5] });
    let ball = strike(restingBall(hole, [3, 2.5]), 0, 1);
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
    let ball = strike(restingBall(ramp, [1.5, 2.5]), 0, 1);
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
