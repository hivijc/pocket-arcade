import type { Sound } from './sfx-math';

/** Sound effects only: there is deliberately no background music or ambience. */
export interface Sfx {
  /** Call from a user gesture: browsers only allow audio to start after one. Returns true once the context is running. */
  unlock(): boolean;
  play(sound: Sound): void;
}

interface Graph {
  readonly ac: AudioContext;
  readonly master: GainNode;
  readonly noise: AudioBuffer;
}

const SILENT: Sfx = { unlock: () => true, play() {} };

function noiseBuffer(ac: AudioContext): AudioBuffer {
  const buf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const ch = buf.getChannelData(0);
  // In-place fill of a fresh audio buffer: allowed per-frame-buffer mutation.
  for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
  return buf;
}

function envelope(g: Graph, t: number, vol: number, dur: number): GainNode {
  const env = g.ac.createGain();
  env.gain.setValueAtTime(vol, t);
  env.gain.exponentialRampToValueAtTime(0.001, t + dur);
  env.connect(g.master);
  return env;
}

function tone(g: Graph, freq: number, dur: number, type: OscillatorType, vol: number, at = 0, slideTo?: number): void {
  const t = g.ac.currentTime + at;
  const osc = g.ac.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  osc.connect(envelope(g, t, vol, dur));
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function hiss(g: Graph, dur: number, type: BiquadFilterType, freq: number, vol: number, at = 0): void {
  const t = g.ac.currentTime + at;
  const src = g.ac.createBufferSource();
  const filter = g.ac.createBiquadFilter();
  src.buffer = g.noise;
  filter.type = type;
  filter.frequency.value = freq;
  src.connect(filter).connect(envelope(g, t, vol, dur));
  src.start(t);
  src.stop(t + dur + 0.02);
}

const RECIPES: Readonly<Record<Sound, (g: Graph) => void>> = {
  toss: (g) => hiss(g, 0.12, 'bandpass', 1800, 0.25),
  thwack: (g) => { hiss(g, 0.08, 'lowpass', 900, 0.5); tone(g, 140, 0.1, 'triangle', 0.3); },
  ding: (g) => { tone(g, 1320, 0.5, 'sine', 0.3); tone(g, 1980, 0.35, 'sine', 0.12, 0.02); },
  bark: (g) => { tone(g, 520, 0.09, 'square', 0.15, 0, 300); tone(g, 480, 0.1, 'square', 0.15, 0.14, 260); },
  splash: (g) => hiss(g, 0.35, 'highpass', 1200, 0.3),
  crash: (g) => { hiss(g, 0.4, 'lowpass', 600, 0.6); tone(g, 90, 0.35, 'sawtooth', 0.25, 0, 40); },
  pickup: (g) => [660, 880, 1100].forEach((f, i) => tone(g, f, 0.12, 'square', 0.1, i * 0.06)),
  dry: (g) => tone(g, 200, 0.05, 'square', 0.08),
  land: (g) => hiss(g, 0.05, 'lowpass', 500, 0.2),
  fanfare: (g) => [523, 659, 784, 1047].forEach((f, i) => tone(g, f, 0.25, 'triangle', 0.2, i * 0.12)),
};

/** Browsers can leave a context suspended after creation; ask it to run. Returns true when it already is. */
function resumeIfSuspended(g: Graph): boolean {
  if (g.ac.state === 'running') return true;
  if (g.ac.state === 'suspended') void g.ac.resume().catch(() => undefined);
  return false;
}

export function createSfx(): Sfx {
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return SILENT;
  let graph: Graph | null = null;
  return {
    unlock() {
      if (graph) return resumeIfSuspended(graph);
      try {
        const ac = new AC();
        const master = ac.createGain();
        master.gain.value = 0.7;
        master.connect(ac.destination);
        graph = { ac, master, noise: noiseBuffer(ac) };
      } catch (err) {
        console.warn('Audio is unavailable:', err);
        return true; // nothing to retry
      }
      return resumeIfSuspended(graph);
    },
    play(sound) {
      if (!graph) return;
      resumeIfSuspended(graph);
      try {
        RECIPES[sound](graph);
      } catch (err) {
        console.warn(`Sound "${sound}" failed:`, err);
      }
    },
  };
}
