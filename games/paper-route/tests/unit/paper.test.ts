import { describe, expect, it } from 'vitest';
import { newBike } from '../../src/sim/bike';
import { STEP, TOSS } from '../../src/sim/constants';
import { hasLanded, heightAt, mailboxHit, paperPos, porchHit, stepPaper, throwPaper, type Paper } from '../../src/sim/paper';
import { parseStreet } from '../../src/world/street';
import { rawStreet } from '../helpers/make-street';

const street = parseStreet(rawStreet());
const bikeAt = (c: number, s: number) => ({ ...newBike(), c, s });

function fly(p: Paper, seconds: number): Paper {
  let out = p;
  for (let i = 0; i < Math.round(seconds / STEP); i++) out = stepPaper(out, STEP);
  return out;
}

describe('flight', () => {
  it('has self-consistent toss constants (lands at height 0 after `flight` seconds)', () => {
    const t = TOSS.flight;
    expect(Math.abs(TOSS.h0 + TOSS.vz * t - (TOSS.gravity * t * t) / 2)).toBeLessThan(0.01);
    expect(heightAt(0)).toBeCloseTo(TOSS.h0);
    expect(heightAt(t / 2)).toBeGreaterThan(1.2);
  });
  it('lands `reach` tiles to the left, carried forward at the bike speed', () => {
    const p = fly(throwPaper(bikeAt(6, 10), 'L'), TOSS.flight);
    expect(hasLanded(p)).toBe(true);
    const pos = paperPos(p);
    expect(pos.c).toBeCloseTo(2.5, 5);
    expect(pos.s).toBeCloseTo(10 + 3 * TOSS.flight, 5);
    expect(pos.z).toBe(0);
  });
  it('lands to the right for a right toss', () => {
    expect(paperPos(fly(throwPaper(bikeAt(8, 10), 'R'), 1)).c).toBeCloseTo(11.5, 5);
  });
  it('is still flying halfway', () => {
    const p = fly(throwPaper(bikeAt(6, 10), 'L'), 0.3);
    expect(hasLanded(p)).toBe(false);
    expect(paperPos(p).z).toBeGreaterThan(1);
  });
});

describe('hits', () => {
  it('hits a mailbox only below the mailbox top', () => {
    expect(mailboxHit(street.lots, { c: 3.6, s: 10, z: 0.5 })?.index).toBe(0);
    expect(mailboxHit(street.lots, { c: 3.6, s: 10, z: 1.2 })).toBeUndefined();
    expect(mailboxHit(street.lots, { c: 3.0, s: 10, z: 0.5 })).toBeUndefined();
  });
  it('hits a porch rectangle', () => {
    expect(porchHit(street.lots, { c: 2.5, s: 11.8, z: 0 })?.index).toBe(0);
    expect(porchHit(street.lots, { c: 11.5, s: 9, z: 0 })?.index).toBe(1);
    expect(porchHit(street.lots, { c: 2.5, s: 14, z: 0 })).toBeUndefined();
  });
  it('a toss timed for the mailbox drops into it mid-flight', () => {
    // From c 6 the paper reaches the mailbox's c (3.6) after 0.41 s, about 1.23 tiles further along.
    let p = throwPaper(bikeAt(6, 10 - 1.23), 'L');
    let hit: number | undefined;
    while (!hasLanded(p) && hit === undefined) {
      p = stepPaper(p, STEP);
      hit = mailboxHit(street.lots, paperPos(p))?.index;
    }
    expect(hit).toBe(0);
  });
});
