import { describe, expect, it } from 'vitest';
import { AIR, GATE, HAZARD_R } from '../../src/sim/constants';
import { borderPines, parseSlope, SlopeError } from '../../src/world/slope';
import { makeSlope, rawSlope } from '../helpers/make-slope';

describe('parseSlope', () => {
  it('parses a full slope', () => {
    const s = makeSlope({
      surfaces: [{ kind: 'packed', rect: [5, 20, 4, 10] }],
      gates: [{ d: 30, c: [6, 10], color: 'blue' }, { d: 40, c: [9, 5], color: 'red' }],
      ramps: [{ d: 60, c: 8 }],
      hazards: [{ kind: 'pine', at: [3, 50] }, { kind: 'rock-s', at: [9, 70] }],
      riders: [{ look: 'skier-red', speed: 3.5, path: [[8, 40], [5, 60]] }],
      flakes: [[8, 55], [8, 57]],
    });
    expect(s.name).toBe('Test Run');
    expect(s.surfaces[0]).toEqual({ kind: 'packed', rect: { c0: 5, d0: 20, c1: 9, d1: 30 } });
    expect(s.gates[1].c).toEqual([5, 9]); // flags are stored low, high
    expect(s.ramps).toEqual([{ d: 60, c: 8 }]);
    expect(s.hazards).toHaveLength(2);
    expect(s.riders[0].path).toEqual([[8, 40], [5, 60]]);
    expect(s.flakes).toEqual([[8, 55], [8, 57]]);
  });

  it.each([
    ['a non-object', 5, /must be an object/],
    ['an empty name', rawSlope({ name: '' }), /name/],
    ['a short length', rawSlope({ length: 30 }), /length/],
    ['a finish past the end', rawSlope({ finish: 120 }), /finish/],
    ['no par', rawSlope({ par: 0 }), /par/],
    ['an off-slope flake', rawSlope({ flakes: [[17, 10]] }), /flakes\[0\].*off the slope/],
    ['a bad surface kind', rawSlope({ surfaces: [{ kind: 'ice', rect: [1, 1, 1, 1] }] }), /surfaces\[0\]\.kind/],
    ['a zero-size surface', rawSlope({ surfaces: [{ kind: 'shade', rect: [1, 1, 0, 1] }] }), /surfaces\[0\].*positive size/],
    ['gate flags too close', rawSlope({ gates: [{ d: 30, c: [6, 7], color: 'blue' }] }), /gates\[0\].*apart/],
    ['gate flags too far', rawSlope({ gates: [{ d: 30, c: [2, 9], color: 'blue' }] }), /gates\[0\].*apart/],
    ['gates out of order', rawSlope({ gates: [{ d: 40, c: [6, 10], color: 'blue' }, { d: 30, c: [6, 10], color: 'red' }] }), /gates\[1\].*increasing d/],
    ['a bad gate colour', rawSlope({ gates: [{ d: 30, c: [6, 10], color: 'green' }] }), /gates\[0\]\.color/],
    ['a ramp off the end', rawSlope({ ramps: [{ d: 118, c: 8 }] }), /ramps\[0\].*off the end/],
    ['an unknown hazard', rawSlope({ hazards: [{ kind: 'yeti', at: [8, 50] }] }), /hazards\[0\]\.kind/],
    ['a hazard in the start area', rawSlope({ hazards: [{ kind: 'pine', at: [8, 5] }] }), /hazards\[0\].*start area/],
    ['a hazard on a ramp', rawSlope({ ramps: [{ d: 60, c: 8 }], hazards: [{ kind: 'rock-l', at: [8.5, 61] }] }), /hazards\[0\].*ramps\[0\]/],
    ['a hazard inside a gate', rawSlope({ gates: [{ d: 30, c: [6, 10], color: 'blue' }], hazards: [{ kind: 'snowman', at: [8, 30.2] }] }), /hazards\[0\].*gates\[0\]/],
    ['a rider with no speed', rawSlope({ riders: [{ look: 'skier-red', speed: 0, path: [[8, 40], [5, 60]] }] }), /riders\[0\].*speed/],
    ['a rider going uphill', rawSlope({ riders: [{ look: 'skier-red', speed: 3, path: [[8, 60], [5, 40]] }] }), /riders\[0\]\.path.*downhill/],
    ['an unknown rider look', rawSlope({ riders: [{ look: 'yeti', speed: 3, path: [[8, 40], [5, 60]] }] }), /riders\[0\]\.look/],
    ['an unknown top-level key', rawSlope({ hazard: [] }), /unknown key "hazard"/],
    ['a rock-l grazing a gate flag', rawSlope({ gates: [{ d: 30, c: [6, 10], color: 'blue' }], hazards: [{ kind: 'rock-l', at: [5.8, 30] }] }), /hazards\[0\].*gates\[0\]/],
    ['a one-point rider path', rawSlope({ riders: [{ look: 'skier-red', speed: 3, path: [[8, 40]] }] }), /riders\[0\]\.path/],
  ])('rejects %s', (_label, raw, msg) => {
    expect(() => parseSlope(raw, { borders: false })).toThrow(SlopeError);
    expect(() => parseSlope(raw, { borders: false })).toThrow(msg);
  });

  it('adds border pines by default', () => {
    const s = parseSlope(rawSlope());
    expect(s.hazards.length).toBeGreaterThan(20);
    expect(s.hazards.every((h) => h.kind === 'pine')).toBe(true);
  });
});

describe('border pines vs ramps and gates', () => {
  it('drops pines that would sit on a ramp or inside a gate', () => {
    const ramps = [{ d: 20, c: 1.5 }];
    const gates = [{ d: 40, c: [2, 6] as const, color: 'blue' as const }];
    const pad = HAZARD_R.pine;
    const onRamp = (c: number, d: number): boolean =>
      Math.abs(c - 1.5) <= AIR.rampHalfWidth + pad && d >= 20 - pad && d <= 20 + AIR.rampLen + pad;
    const inGate = (c: number, d: number): boolean =>
      Math.abs(d - 40) < GATE.lineWindow && c > 2 - pad && c < 6 + pad;
    const all = borderPines(120);
    expect(all.some((h) => onRamp(...h.at) || inGate(...h.at))).toBe(true); // the scenario really collides
    const kept = borderPines(120, ramps, gates);
    expect(kept.length).toBeLessThan(all.length);
    expect(kept.some((h) => onRamp(...h.at) || inGate(...h.at))).toBe(false);
    const s = parseSlope(rawSlope({ ramps: [{ d: 20, c: 1.5 }], gates: [{ d: 40, c: [2, 6], color: 'blue' }] }));
    expect(s.hazards.some((h) => onRamp(...h.at) || inGate(...h.at))).toBe(false);
  });
});

describe('borderPines', () => {
  it('is deterministic and keeps to the powder edges past the start', () => {
    const a = borderPines(200);
    expect(borderPines(200)).toEqual(a);
    for (const h of a) {
      const [c, d] = h.at;
      expect(c < 1.6 || c > 14.4).toBe(true);
      expect(c).toBeGreaterThanOrEqual(0.5);
      expect(c).toBeLessThanOrEqual(15.5);
      expect(d).toBeGreaterThanOrEqual(6);
      expect(d).toBeLessThan(201);
    }
  });
});
