import { parseSlope, type Slope } from '../../src/world/slope';

/** A valid, empty 120-tile slope as raw JSON, with fields overridden. */
export const rawSlope = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  name: 'Test Run', length: 120, finish: 100, par: 30,
  surfaces: [], gates: [], ramps: [], hazards: [], riders: [], flakes: [], ...over,
});

/** Parsed test slope. Border pines are off unless asked for, so physics tests see only what they list. */
export const makeSlope = (over: Record<string, unknown> = {}, borders = false): Slope => parseSlope(rawSlope(over), { borders });
