import { describe, expect, it } from 'vitest';
import { parseSlope } from '../../src/world/slope';
import slopeJson from '../../src/world/slopes/pinecone-bowl.json';
import { carefulBot, playRun, straightBot } from '../helpers/bot';

const slope = parseSlope(slopeJson);

describe('Pinecone Bowl is ridable', () => {
  it('a careful line reaches the finish with no crashes', () => {
    const { final, crashes } = playRun(slope, carefulBot);
    expect(crashes, JSON.stringify(crashes)).toEqual([]);
    expect(final.phase).toBe('over');
    expect(final.finishTime).not.toBeNull();
    expect(final.finishTime!).toBeLessThan(120);
    expect(final.gates.passed).toBeGreaterThan(0);
  });
  it('pointing straight down hits something, so the hazards matter', () => {
    const { crashes } = playRun(slope, straightBot);
    expect(crashes.length).toBeGreaterThan(0);
  });
});
