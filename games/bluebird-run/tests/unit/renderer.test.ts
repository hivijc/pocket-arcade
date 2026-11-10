import { describe, expect, it } from 'vitest';
import type { Content } from '../../src/content';
import { newRun } from '../../src/game/state';
import { cameraTarget, snapCamera } from '../../src/render/camera';
import { createPalette } from '../../src/render/palette';
import { renderFrame } from '../../src/render/renderer';
import { parseManifest } from '../../src/world/manifest';
import manifestJson from '../../assets/manifest.json';
import paletteJson from '../../assets/palette.json';
import { makeSlope } from '../helpers/make-slope';

/** A 2D context that records the methods called (all no-ops). */
function recorder(): { ctx: CanvasRenderingContext2D; calls: string[] } {
  const calls: string[] = []; // test recorder: mutated on purpose
  const ctx = new Proxy({} as Record<string, unknown>, {
    get: (t, k) => (typeof k === 'string' && k in t ? t[k] : (..._a: unknown[]) => void calls.push(String(k))),
    set: (t, k, v) => { t[k as string] = v; return true; },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

describe('renderFrame', () => {
  it('draws chunks, sprites (as placeholders) and the rider without throwing', () => {
    const slope = makeSlope({
      gates: [{ d: 12, c: [6, 10], color: 'red' }], ramps: [{ d: 20, c: 8 }], hazards: [{ kind: 'snowman', at: [7, 15] }],
      riders: [{ look: 'skier-green', speed: 3, path: [[8, 14], [8, 40]] }], flakes: [[8, 9]],
    });
    const content: Content = { slope, manifest: parseManifest(manifestJson), palette: createPalette(paletteJson), sprites: new Map(), rider: null };
    const state = { ...newRun(slope), phase: 'riding' as const, riders: [0] };
    const { ctx, calls } = recorder();
    renderFrame(ctx, {
      content, state, cam: snapCamera(cameraTarget(8, 4)), visible: [0, 1], chunk: () => ({}) as CanvasImageSource,
      time: 0.5, width: 360, height: 270, track: [[8, 3, 0], [8, 3.5, 1]], particles: [{ c: 8, d: 5, z: 0.2, vc: 0, vd: 0, vz: 0, life: 0.4, max: 0.5 }],
    });
    expect(calls.filter((c) => c === 'drawImage')).toHaveLength(2);
    expect(calls.filter((c) => c === 'fillRect').length).toBeGreaterThan(10);
    expect(calls).toContain('stroke');
  });
});
