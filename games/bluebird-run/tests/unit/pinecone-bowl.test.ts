import { describe, expect, it } from 'vitest';
import { parseSlope } from '../../src/world/slope';
import slopeJson from '../../src/world/slopes/pinecone-bowl.json';

describe('Pinecone Bowl', () => {
  it('is a valid, full course', () => {
    const s = parseSlope(slopeJson);
    expect(s.name).toBe('Pinecone Bowl');
    expect(s.gates.length).toBeGreaterThanOrEqual(15);
    expect(s.ramps.length).toBeGreaterThanOrEqual(4);
    expect(s.riders.length).toBeGreaterThanOrEqual(3);
    expect(s.flakes.length).toBeGreaterThanOrEqual(20);
  });
});
